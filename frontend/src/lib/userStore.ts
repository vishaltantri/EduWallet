import { Wallet } from "ethers";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "university";
  passwordHash: string;
  walletAddress: string;
  encryptedPrivateKey: string; // AES-256-GCM encrypted
  iv: string;
  authTag: string;
  createdAt: string;
}

const DB_PATH = path.join(process.cwd(), "data", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "eduwallet-dev-secret-change-in-production";

// ─── Ensure data directory exists ───
function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, "[]");
  }
}

// ─── Read/Write Users ───
export function getUsers(): StoredUser[] {
  ensureDataDir();
  const data = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(data);
}

export function saveUsers(users: StoredUser[]) {
  ensureDataDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): StoredUser | undefined {
  return getUsers().find((u) => u.id === id);
}

export function findUserByWallet(address: string): StoredUser | undefined {
  return getUsers().find((u) => u.walletAddress.toLowerCase() === address.toLowerCase());
}

// ─── Password Hashing (using Node crypto, no bcrypt needed) ───
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === testHash;
}

// ─── Wallet Encryption ───
// Each user's private key is encrypted with a derived key from their password
// This means even if the server is compromised, keys are protected
function deriveEncryptionKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, "eduwallet-key-derivation", 10000, 32, "sha256");
}

export function encryptPrivateKey(
  privateKey: string,
  password: string
): { encrypted: string; iv: string; authTag: string } {
  const key = deriveEncryptionKey(password);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

export function decryptPrivateKey(
  encrypted: string,
  iv: string,
  authTag: string,
  password: string
): string {
  const key = deriveEncryptionKey(password);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── JWT Helpers ───
export function createJWT(payload: object): string {
  // Simple JWT implementation using Node crypto (no external deps)
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split(".");
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Create New User ───
export function createUser(
  name: string,
  email: string,
  password: string,
  role: "student" | "university"
): { user: StoredUser; token: string } {
  // Generate Ethereum wallet
  const wallet = Wallet.createRandom();

  // Encrypt private key with user's password
  const { encrypted, iv, authTag } = encryptPrivateKey(wallet.privateKey, password);

  const user: StoredUser = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    role,
    passwordHash: hashPassword(password),
    walletAddress: wallet.address,
    encryptedPrivateKey: encrypted,
    iv,
    authTag,
    createdAt: new Date().toISOString(),
  };

  const users = getUsers();
  users.push(user);
  saveUsers(users);

  const token = createJWT({ userId: user.id, role: user.role });

  return { user, token };
}
