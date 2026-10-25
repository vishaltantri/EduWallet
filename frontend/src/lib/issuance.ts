/**
 * The issuance pipeline, shared by single and bulk certificate issuance.
 *
 * Order matters. Each step is allowed to fail softly *except* signing the
 * content commitment, which is what makes the certificate verifiable:
 *
 *   1. resolve + validate the student
 *   2. pin metadata to IPFS        (soft — falls back to a local digest)
 *   3. allocate a token ID         (hard — atomic counter)
 *   4. hash + sign the credential  (core)
 *   5. anchor on Polygon           (soft — recorded as "pending anchor")
 */

import { v4 as uuidv4 } from "uuid";
import { decryptFromCustody } from "./crypto";
import { signCredential } from "./credential";
import {
  anchorCertificate,
  ensureIssuerOnboarded,
  isChainConfigured,
  registerCredentialOnChain,
} from "./blockchain";
import { uploadJSONToIPFS } from "./ipfs";
import { allocateTokenId, addCredential, findUserByEmail } from "./stores";
import { institutionNameFor, type StoredCredential, type StoredUser } from "./models";

export interface IssuanceRequest {
  studentEmail: string;
  studentName: string;
  degreeType: string;
  major: string;
  grade?: string;
  completionDate?: string;
}

export type IssuanceResult =
  | { ok: true; credential: StoredCredential; warnings: string[] }
  | { ok: false; error: string; status: number };

export const DEGREE_TYPES = [
  "Bachelor of Science",
  "Bachelor of Arts",
  "Bachelor of Technology",
  "Bachelor of Commerce",
  "Master of Science",
  "Master of Arts",
  "Master of Technology",
  "Master of Business Administration",
  "Doctor of Philosophy",
  "Postgraduate Diploma",
  "Diploma",
  "Certificate",
  "Micro-credential",
  "Professional Certification",
] as const;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function normalizeIssuance(input: Partial<IssuanceRequest>): IssuanceRequest {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return {
    studentEmail: text(input.studentEmail).toLowerCase(),
    studentName: text(input.studentName),
    degreeType: text(input.degreeType),
    major: text(input.major),
    grade: text(input.grade) || undefined,
    completionDate: text(input.completionDate) || undefined,
  };
}

export function validateIssuance(request: IssuanceRequest): string | null {
  if (!request.studentEmail || !request.studentName || !request.degreeType || !request.major) {
    return "Student email, name, degree type and major are all required";
  }
  if (!EMAIL_PATTERN.test(request.studentEmail)) {
    return `"${request.studentEmail}" is not a valid email address`;
  }
  if (request.studentName.length > 120 || request.major.length > 120) {
    return "Student name and major must be under 120 characters";
  }
  if (request.completionDate && Number.isNaN(Date.parse(request.completionDate))) {
    return "Completion date must be a valid date";
  }
  return null;
}

export async function issueCredential(
  issuer: StoredUser,
  input: IssuanceRequest
): Promise<IssuanceResult> {
  const validationError = validateIssuance(input);
  if (validationError) return { ok: false, error: validationError, status: 400 };

  const student = await findUserByEmail(input.studentEmail);
  if (!student) {
    return {
      ok: false,
      error: `No EduWallet account for ${input.studentEmail}. The student must register first.`,
      status: 404,
    };
  }
  if (student.role !== "student") {
    return { ok: false, error: `${input.studentEmail} is an institution account, not a student`, status: 400 };
  }

  const warnings: string[] = [];
  const institutionName = institutionNameFor(issuer) ?? issuer.name;
  const issuedAt = new Date().toISOString();

  let ipfsHash: string;
  try {
    ipfsHash = await uploadJSONToIPFS({
      name: `${input.degreeType} in ${input.major}`,
      description: `Soulbound academic credential issued to ${input.studentName} by ${institutionName}.`,
      attributes: [
        { trait_type: "Student Name", value: input.studentName },
        { trait_type: "Degree Type", value: input.degreeType },
        { trait_type: "Major", value: input.major },
        { trait_type: "Institution", value: institutionName },
        ...(input.grade ? [{ trait_type: "Grade", value: input.grade }] : []),
        ...(input.completionDate ? [{ trait_type: "Completion Date", value: input.completionDate }] : []),
        { trait_type: "Issued Date", value: issuedAt },
      ],
    });
  } catch {
    ipfsHash = `local-${uuidv4().replace(/-/g, "")}`;
    warnings.push("IPFS pinning unavailable — metadata stored locally for this certificate.");
  }

  const tokenId = await allocateTokenId();

  const credential: StoredCredential = {
    id: uuidv4(),
    tokenId,
    studentAddress: student.walletAddress,
    studentName: input.studentName,
    studentEmail: student.email,
    issuerAddress: issuer.walletAddress,
    issuerEmail: issuer.email,
    degreeType: input.degreeType,
    major: input.major,
    grade: input.grade,
    completionDate: input.completionDate,
    institutionName,
    ipfsHash,
    issuedAt,
    isValid: true,
  };

  const signature = await signCredential(credential, issuer);
  if (signature) {
    credential.credentialHash = signature.credentialHash;
    credential.issuerSignature = signature.issuerSignature;
  } else {
    warnings.push(
      "This certificate could not be signed — sign out and back in to re-key your institution wallet."
    );
  }

  if (isChainConfigured() && issuer.custody) {
    try {
      // The certificate contract is `onlyIssuer`, and an institution's wallet
      // is generated at registration — so it has to be authorized and funded
      // before its first mint, or `issueCertificate` reverts with NotIssuer.
      const onboarding = await ensureIssuerOnboarded(issuer.walletAddress, institutionName);
      if (onboarding.error) throw new Error(onboarding.error);

      const issuerKey = decryptFromCustody(issuer.custody);
      const anchor = await anchorCertificate(
        issuerKey,
        student.walletAddress,
        `ipfs://${ipfsHash}`
      );
      credential.anchored = anchor.anchored;
      credential.txHash = anchor.txHash;
      credential.anchorError = anchor.error;
      credential.chainTokenId = anchor.tokenId;

      if (anchor.anchored && anchor.tokenId !== undefined) {
        // Mirror the credential's academic detail into the registry, so the
        // on-chain record is searchable by student and issuer rather than
        // being an opaque metadata URI.
        const registryTx = await registerCredentialOnChain(
          issuerKey,
          anchor.tokenId,
          student.walletAddress,
          input.studentName,
          input.degreeType,
          input.major,
          ipfsHash
        );
        credential.registryTxHash = registryTx ?? undefined;
      }

      if (!anchor.anchored) {
        warnings.push("Polygon anchoring is pending — the certificate is signed and verifiable now.");
      }
    } catch (error) {
      credential.anchored = false;
      credential.anchorError = error instanceof Error ? error.message : "Anchoring failed";
      warnings.push(`Polygon anchoring did not complete: ${credential.anchorError}`);
    }
  } else {
    credential.anchored = false;
    credential.anchorError = isChainConfigured()
      ? "This institution's wallet is not available for signing — sign out and back in"
      : "Chain anchoring is not configured for this environment";
  }

  await addCredential(credential);
  return { ok: true, credential, warnings };
}

/**
 * Parse a bulk-issuance CSV.
 *
 * Accepts a header row in any column order; `email`, `name`, `degree` and
 * `major` are required, `grade` and `completion_date` optional.
 */
export function parseIssuanceCsv(csv: string): { rows: IssuanceRequest[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV needs a header row and at least one certificate row"] };
  }

  const header = splitCsvLine(lines[0]).map((column) => column.toLowerCase().replace(/\s+/g, "_"));
  const aliases: Record<string, string> = {
    student_email: "email",
    student_name: "name",
    degree_type: "degree",
    field_of_study: "major",
    completion: "completion_date",
  };
  const columns = header.map((column) => aliases[column] ?? column);

  for (const required of ["email", "name", "degree", "major"]) {
    if (!columns.includes(required)) errors.push(`Missing required column: ${required}`);
  }
  if (errors.length) return { rows: [], errors };

  const rows: IssuanceRequest[] = [];
  lines.slice(1).forEach((line, index) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    columns.forEach((column, columnIndex) => {
      record[column] = values[columnIndex]?.trim() ?? "";
    });

    const request = normalizeIssuance({
      studentEmail: record.email,
      studentName: record.name,
      degreeType: record.degree,
      major: record.major,
      grade: record.grade,
      completionDate: record.completion_date,
    });

    const problem = validateIssuance(request);
    if (problem) errors.push(`Row ${index + 2}: ${problem}`);
    else rows.push(request);
  });

  return { rows, errors };
}

/** Minimal CSV field splitter with support for quoted values containing commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
