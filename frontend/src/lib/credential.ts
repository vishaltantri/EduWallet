/**
 * Credential integrity: canonical hashing, issuer signatures, and W3C
 * Verifiable Credential export.
 *
 * The chain is the anchor of last resort, but a certificate is only worth
 * something if a verifier can prove two things offline:
 *
 *   1. the content has not been edited since issuance  (content hash)
 *   2. it really came from the issuing institution     (EIP-191 signature)
 *
 * Both hold without an RPC connection, so verification still works when the
 * Polygon endpoint is unreachable — the page just downgrades the "anchored on
 * Polygon" claim instead of failing outright.
 */

import { Wallet, getBytes, keccak256, toUtf8Bytes, verifyMessage } from "ethers";
import { decryptFromCustody } from "./crypto";
import type { StoredCredential, StoredUser } from "./models";

export interface IntegrityReport {
  /** Recomputed hash matches the one recorded at issuance. */
  contentIntact: boolean;
  /** Signature recovers to the issuer's wallet address. */
  signatureValid: boolean;
  /** Signed at all — legacy rows predate the signing scheme. */
  signed: boolean;
  recoveredSigner?: string;
  credentialHash?: string;
}

/**
 * Deterministic byte representation of the facts a verifier cares about.
 *
 * Field order is fixed and explicit: JSON key order is not a stable contract,
 * so the payload is built as an ordered list of `key=value` pairs instead.
 */
export function canonicalPayload(credential: StoredCredential): string {
  const fields: [string, string][] = [
    ["tokenId", String(credential.tokenId)],
    ["studentAddress", credential.studentAddress.toLowerCase()],
    ["studentName", credential.studentName],
    ["studentEmail", credential.studentEmail.toLowerCase()],
    ["issuerAddress", credential.issuerAddress.toLowerCase()],
    ["institutionName", credential.institutionName],
    ["degreeType", credential.degreeType],
    ["major", credential.major],
    ["grade", credential.grade ?? ""],
    ["completionDate", credential.completionDate ?? ""],
    ["ipfsHash", credential.ipfsHash],
    ["issuedAt", credential.issuedAt],
  ];
  return fields.map(([key, value]) => `${key}=${value}`).join("\n");
}

export function credentialHash(credential: StoredCredential): string {
  return keccak256(toUtf8Bytes(canonicalPayload(credential)));
}

/**
 * Sign a credential with the issuer's custodied wallet key.
 *
 * Returns `null` when the issuer predates key custody (legacy account that has
 * not logged in since the migration) — issuance still succeeds, the credential
 * is just marked unsigned rather than silently claiming a signature.
 */
export async function signCredential(
  credential: StoredCredential,
  issuer: StoredUser
): Promise<{ credentialHash: string; issuerSignature: string } | null> {
  if (!issuer.custody) return null;

  try {
    const privateKey = decryptFromCustody(issuer.custody);
    const wallet = new Wallet(privateKey);
    const hash = credentialHash(credential);
    const issuerSignature = await wallet.signMessage(getBytes(hash));
    return { credentialHash: hash, issuerSignature };
  } catch (error) {
    console.error("[credential] signing failed:", error);
    return null;
  }
}

export function checkIntegrity(credential: StoredCredential): IntegrityReport {
  const recomputed = credentialHash(credential);

  if (!credential.credentialHash || !credential.issuerSignature) {
    return { contentIntact: false, signatureValid: false, signed: false, credentialHash: recomputed };
  }

  const contentIntact = recomputed === credential.credentialHash;

  let recoveredSigner: string | undefined;
  let signatureValid = false;
  try {
    recoveredSigner = verifyMessage(getBytes(credential.credentialHash), credential.issuerSignature);
    signatureValid = recoveredSigner.toLowerCase() === credential.issuerAddress.toLowerCase();
  } catch {
    signatureValid = false;
  }

  return {
    contentIntact,
    signatureValid,
    signed: true,
    recoveredSigner,
    credentialHash: credential.credentialHash,
  };
}

// ─── W3C Verifiable Credential export ───────────────────────────────────────

/**
 * Render the credential as a W3C VC Data Model 2.0 document with an
 * EthereumEip712/EIP-191 style proof. Interoperable with wallets and
 * credential viewers that speak the standard, and a portable offline copy for
 * the student.
 */
export function toVerifiableCredential(
  credential: StoredCredential,
  options: { baseUrl: string; anonymized?: boolean }
) {
  const subject: Record<string, unknown> = {
    id: `did:pkh:eip155:80002:${credential.studentAddress}`,
    type: "Student",
    hasCredential: {
      type: ["EducationalOccupationalCredential"],
      name: `${credential.degreeType} in ${credential.major}`,
      credentialCategory: credential.degreeType,
      educationalLevel: credential.degreeType,
      about: credential.major,
      ...(credential.grade ? { grade: credential.grade } : {}),
      ...(credential.completionDate ? { dateCompleted: credential.completionDate } : {}),
    },
  };

  if (options.anonymized) {
    subject.id = "did:example:anonymous";
    subject.name = "Withheld by credential holder";
  } else {
    subject.name = credential.studentName;
  }

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://schema.org/",
    ],
    id: `${options.baseUrl}/verify/${credential.id}`,
    type: ["VerifiableCredential", "EducationalOccupationalCredentialCredential"],
    issuer: {
      id: `did:pkh:eip155:80002:${credential.issuerAddress}`,
      name: credential.institutionName,
    },
    validFrom: credential.issuedAt,
    credentialStatus: {
      id: `${options.baseUrl}/api/verify/${credential.id}`,
      type: "EduWalletStatusList2026",
      status: credential.isValid ? "active" : "revoked",
      ...(credential.revokedAt ? { revokedAt: credential.revokedAt } : {}),
      ...(credential.revocationReason ? { statusReason: credential.revocationReason } : {}),
    },
    credentialSubject: subject,
    evidence: [
      {
        type: "IPFSDocument",
        id: `ipfs://${credential.ipfsHash}`,
      },
      ...(credential.txHash
        ? [{ type: "BlockchainAnchor", chain: "polygon-amoy", transactionHash: credential.txHash }]
        : []),
    ],
    proof: credential.issuerSignature
      ? {
          type: "EcdsaSecp256k1Signature2019",
          created: credential.issuedAt,
          proofPurpose: "assertionMethod",
          verificationMethod: `did:pkh:eip155:80002:${credential.issuerAddress}#blockchainAccountId`,
          messageHash: credential.credentialHash,
          proofValue: credential.issuerSignature,
        }
      : undefined,
  };
}
