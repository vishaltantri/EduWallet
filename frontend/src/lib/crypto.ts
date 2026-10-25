/**
 * Password hashing, session tokens, and wallet-key custody.
 *
 * Every user wallet is stored twice over:
 *
 *   • `encryptedPrivateKey` — AES-256-GCM under a key derived from the user's
 *     password. Nobody but the user can open this, not even the server.
 *   • `custodyKey`          — AES-256-GCM under the server master key. This is
 *     what lets the backend sign a credential on an institution's behalf at
 *     issuance time, when the password is not in hand (only a session token).
 *
 * That second copy is what makes real issuer signatures possible without
 * asking a registrar to re-enter their password for every certificate.
 */

import * as crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "eduwallet-dev-secret-change-in-production";
const MASTER_KEY_SOURCE = process.env.WALLET_MASTER_KEY || `${JWT_SECRET}:wallet-custody`;

export interface SealedSecret {
  encrypted: string;
  iv: string;
  authTag: string;
}

// ─── Password Hashing ───────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return timingSafeEqual(hash, testHash);
  } catch {
    return false;
  }
}

/** Length-safe constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

// ─── Symmetric Encryption ───────────────────────────────────────────────────

function seal(plaintext: string, key: Buffer): SealedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
  return { encrypted, iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex") };
}

function open(sealed: SealedSecret, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "hex"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "hex"));
  return decipher.update(sealed.encrypted, "hex", "utf8") + decipher.final("utf8");
}

/**
 * Derive a per-user encryption key from their password.
 *
 * The salt is per-user rather than a global constant so that two people who
 * pick the same password do not end up with the same derived key.
 */
function derivePasswordKey(password: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(password, `eduwallet-key-derivation:${salt}`, 100000, 32, "sha256");
}

function masterKey(): Buffer {
  return crypto.createHash("sha256").update(MASTER_KEY_SOURCE).digest();
}

export function encryptPrivateKey(privateKey: string, password: string, salt: string): SealedSecret {
  return seal(privateKey, derivePasswordKey(password, salt));
}

export function decryptPrivateKey(sealed: SealedSecret, password: string, salt: string): string {
  return open(sealed, derivePasswordKey(password, salt));
}

/**
 * Open a wallet sealed by the pre-migration scheme: a globally constant salt
 * and 10k PBKDF2 iterations. Used once, at login, to re-seal legacy accounts
 * under the current scheme.
 */
export function decryptLegacyPrivateKey(sealed: SealedSecret, password: string): string {
  const legacyKey = crypto.pbkdf2Sync(password, "eduwallet-key-derivation", 10000, 32, "sha256");
  return open(sealed, legacyKey);
}

export function encryptForCustody(privateKey: string): SealedSecret {
  return seal(privateKey, masterKey());
}

export function decryptFromCustody(sealed: SealedSecret): string {
  return open(sealed, masterKey());
}

// ─── Session Tokens ─────────────────────────────────────────────────────────

export const TOKEN_TTL_SECONDS = 86400;

export function createJWT(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS })
  );
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    if (!timingSafeEqual(signature, sign(`${header}.${body}`))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

function sign(data: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
