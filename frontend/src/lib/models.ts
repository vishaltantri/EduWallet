import type { SealedSecret } from "./crypto";

export type UserRole = "student" | "university";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Display name of the issuing institution. University accounts only. */
  institutionName?: string;
  passwordHash: string;
  walletAddress: string;

  /** Wallet key sealed with a key derived from the user's password. */
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
  /** Per-user salt for the password-derived key. Absent on legacy accounts. */
  keySalt?: string;

  /** Wallet key sealed with the server master key, for issuance signing. */
  custody?: SealedSecret;

  /**
   * Which address the sealed key material above actually controls.
   *
   * Normally the same as `walletAddress`. After a social recovery they differ:
   * the account moves to an address the holder controls externally, while the
   * sealed copy still opens the original wallet — the one that owns the
   * already-minted soulbound tokens. Recording it keeps wallet export honest
   * instead of failing an address comparison.
   */
  keyWalletAddress?: string;

  createdAt: string;
  lastLoginAt?: string;

  /**
   * Wallet addresses this account held before a social recovery, newest
   * first. Credentials are signed over the address they were issued to, so a
   * recovered account keeps resolving its old certificates rather than
   * orphaning them.
   */
  previousWalletAddresses?: string[];
}

/** Every address an account has ever held, current first, all lowercase. */
export function walletHistory(user: StoredUser): string[] {
  return [user.walletAddress, ...(user.previousWalletAddresses ?? [])].map((address) =>
    address.toLowerCase()
  );
}

export function ownsAddress(user: StoredUser, address: string): boolean {
  return walletHistory(user).includes(address.trim().toLowerCase());
}

export interface StoredCredential {
  id: string;
  tokenId: number;
  studentAddress: string;
  studentName: string;
  studentEmail: string;
  issuerAddress: string;
  issuerEmail: string;
  degreeType: string;
  major: string;
  institutionName: string;
  ipfsHash: string;
  issuedAt: string;
  isValid: boolean;

  /** Optional academic detail captured at issuance. */
  grade?: string;
  completionDate?: string;

  /** keccak256 over the canonical credential payload. */
  credentialHash?: string;
  /** EIP-191 signature of `credentialHash` by the issuer's wallet. */
  issuerSignature?: string;

  /** Polygon anchoring, when contracts are reachable. */
  anchored?: boolean;
  txHash?: string;
  anchorError?: string;
  /** Transaction that mirrored the credential into CredentialRegistry. */
  registryTxHash?: string;
  /**
   * Token ID assigned by the contract. The contract keeps its own counter, so
   * it need not equal the local `tokenId`; on-chain lookups must use this one.
   */
  chainTokenId?: number;

  /** Revocation. */
  revokedAt?: string;
  revocationReason?: string;
}

export type VerificationOutcome = "valid" | "revoked" | "not_found" | "tampered";

export interface VerificationEvent {
  id: string;
  credentialId: string;
  verifiedAt: string;
  outcome: VerificationOutcome;
  /** Coarse origin hint (country/city header or "unknown"), never a raw IP. */
  origin: string;
  /** Set when the lookup came through a share link. */
  shareToken?: string;
}

export interface ShareLink {
  token: string;
  credentialId: string;
  ownerId: string;
  label: string;
  createdAt: string;
  /** ISO timestamp, or null for a link that never expires. */
  expiresAt: string | null;
  /** Hide the student's legal name and wallet from the verifier. */
  anonymized: boolean;
  revoked: boolean;
  viewCount: number;
  lastViewedAt?: string;
}

export interface RecoveryConfiguration {
  studentId: string;
  guardianEmails: string[];
  guardianAddresses: string[];
  threshold: number;
  configuredAt: string;
  /** Transaction that registered the guardian set on RecoveryManager. */
  txHash?: string;
  /** Why the guardian set could not be anchored, when it could not. */
  chainError?: string;
}

export type RecoveryRequestStatus = "pending" | "executed" | "cancelled" | "expired";

export interface RecoveryApproval {
  guardianId: string;
  guardianEmail: string;
  guardianAddress: string;
  approvedAt: string;
  /** Transaction that mirrored this approval on-chain, when there was one. */
  txHash?: string;
}

/**
 * An in-flight account recovery.
 *
 * Mirrors RecoveryManager's request struct so the off-chain record and the
 * on-chain one tell the same story: the initiating guardian counts as the
 * first approval, a 24-hour cooldown runs from initiation, and the request
 * lapses after seven days.
 */
export interface StoredRecoveryRequest {
  id: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  /** The address being recovered from, captured when the request opened. */
  fromAddress: string;
  /** The destination the student will control afterwards. */
  newAddress: string;
  threshold: number;
  guardianAddresses: string[];
  initiatedByEmail: string;
  initiatedAt: string;
  approvals: RecoveryApproval[];
  status: RecoveryRequestStatus;
  executedAt?: string;
  closedAt?: string;
  initiateTxHash?: string;
  executeTxHash?: string;
  /** Last chain error seen while mirroring this request. */
  chainError?: string;
}

/** Shape returned to the browser. Never includes key material. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  walletAddress: string;
  institutionName?: string;
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletAddress: user.walletAddress,
    institutionName: institutionNameFor(user),
  };
}

/** Legacy accounts were created before institutions had their own name. */
export function institutionNameFor(user: StoredUser): string | undefined {
  if (user.role !== "university") return undefined;
  return user.institutionName?.trim() || `${user.name}'s Institution`;
}
