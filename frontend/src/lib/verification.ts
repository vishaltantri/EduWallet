import { checkIntegrity } from "./credential";
import { chainSettings, verifyCertificateOnChain } from "./blockchain";
import { getVerificationsFor } from "./stores";
import type { StoredCredential, VerificationOutcome } from "./models";

export interface VerificationResponse {
  outcome: VerificationOutcome;
  isValid: boolean;
  id: string;
  tokenId: number;
  studentName: string;
  studentAddress: string;
  degreeType: string;
  major: string;
  grade?: string;
  completionDate?: string;
  institutionName: string;
  issuerAddress: string;
  issuedAt: string;
  ipfsHash: string;
  revokedAt?: string;
  revocationReason?: string;
  anonymized: boolean;

  integrity: {
    signed: boolean;
    contentIntact: boolean;
    signatureValid: boolean;
    credentialHash?: string;
    recoveredSigner?: string;
  };

  anchor: {
    anchored: boolean;
    txHash?: string;
    explorerUrl?: string;
    note?: string;
    onChainMatches?: boolean;
  };

  /** How many times this credential has been checked before now. */
  priorVerifications: number;
  shareLink?: {
    label: string;
    expiresAt: string | null;
  };
}

/**
 * Decide the single-word answer a verifier actually wants.
 *
 * "tampered" outranks "revoked": a document whose contents no longer match
 * its signature is a forgery question, not an administrative one.
 */
export function resolveOutcome(credential: StoredCredential): VerificationOutcome {
  const integrity = checkIntegrity(credential);
  if (integrity.signed && (!integrity.contentIntact || !integrity.signatureValid)) return "tampered";
  if (!credential.isValid) return "revoked";
  return "valid";
}

export async function buildVerification(
  credential: StoredCredential,
  options: { anonymized?: boolean; shareLabel?: string; shareExpiresAt?: string | null } = {}
): Promise<VerificationResponse> {
  const integrity = checkIntegrity(credential);
  const outcome = resolveOutcome(credential);
  const settings = chainSettings();
  const anonymized = Boolean(options.anonymized);

  let onChainMatches: boolean | undefined;
  if (credential.anchored && settings.configured) {
    // The contract assigns its own token ID; fall back to the local one only
    // for records issued before that was tracked.
    const onChain = await verifyCertificateOnChain(credential.chainTokenId ?? credential.tokenId);
    if (onChain) {
      onChainMatches =
        String(onChain.student).toLowerCase() === credential.studentAddress.toLowerCase() &&
        String(onChain.issuer).toLowerCase() === credential.issuerAddress.toLowerCase();
    }
  }

  const priorVerifications = (await getVerificationsFor(credential.id)).length;

  return {
    outcome,
    isValid: outcome === "valid",
    id: credential.id,
    tokenId: credential.tokenId,
    studentName: anonymized ? "Withheld by credential holder" : credential.studentName,
    studentAddress: anonymized ? "0x" + "•".repeat(38) : credential.studentAddress,
    degreeType: credential.degreeType,
    major: credential.major,
    grade: credential.grade,
    completionDate: credential.completionDate,
    institutionName: credential.institutionName,
    issuerAddress: credential.issuerAddress,
    issuedAt: credential.issuedAt,
    ipfsHash: credential.ipfsHash,
    revokedAt: credential.revokedAt,
    revocationReason: credential.revocationReason,
    anonymized,
    integrity: {
      signed: integrity.signed,
      contentIntact: integrity.contentIntact,
      signatureValid: integrity.signatureValid,
      credentialHash: integrity.credentialHash,
      recoveredSigner: anonymized ? undefined : integrity.recoveredSigner,
    },
    anchor: {
      anchored: Boolean(credential.anchored),
      txHash: credential.txHash,
      explorerUrl: credential.txHash ? `${settings.explorerBase}/tx/${credential.txHash}` : undefined,
      note: credential.anchored ? undefined : credential.anchorError,
      onChainMatches,
    },
    priorVerifications,
    shareLink: options.shareLabel
      ? { label: options.shareLabel, expiresAt: options.shareExpiresAt ?? null }
      : undefined,
  };
}
