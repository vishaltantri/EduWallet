import * as nodeCrypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TOKEN_TTL_SECONDS,
  createJWT,
  decryptFromCustody,
  decryptLegacyPrivateKey,
  decryptPrivateKey,
  encryptForCustody,
  encryptPrivateKey,
  hashPassword,
  randomToken,
  verifyJWT,
  verifyPassword,
} from "@/lib/crypto";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe("password hashing", () => {
  it("accepts the right password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("Correct horse battery", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("salts each hash so the same password stores differently", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toEqual(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
    expect(verifyPassword("x", ":")).toBe(false);
  });
});

describe("wallet key sealing", () => {
  it("round-trips a key under the password-derived key", () => {
    const sealed = encryptPrivateKey(KEY, "pw", "salt-1");
    expect(sealed.encrypted).not.toContain(KEY.slice(2));
    expect(decryptPrivateKey(sealed, "pw", "salt-1")).toBe(KEY);
  });

  it("will not open with the wrong password or the wrong salt", () => {
    const sealed = encryptPrivateKey(KEY, "pw", "salt-1");
    expect(() => decryptPrivateKey(sealed, "wrong", "salt-1")).toThrow();
    expect(() => decryptPrivateKey(sealed, "pw", "salt-2")).toThrow();
  });

  it("gives two users with the same password different ciphertext", () => {
    const a = encryptPrivateKey(KEY, "shared", "salt-a");
    const b = encryptPrivateKey(KEY, "shared", "salt-b");
    expect(a.encrypted).not.toEqual(b.encrypted);
  });

  it("detects tampering with the ciphertext through the GCM auth tag", () => {
    const sealed = encryptPrivateKey(KEY, "pw", "salt-1");
    const flipped = {
      ...sealed,
      encrypted: sealed.encrypted.slice(0, -2) + (sealed.encrypted.endsWith("00") ? "11" : "00"),
    };
    expect(() => decryptPrivateKey(flipped, "pw", "salt-1")).toThrow();
  });

  it("round-trips under the server custody key", () => {
    const sealed = encryptForCustody(KEY);
    expect(decryptFromCustody(sealed)).toBe(KEY);
  });

  it("still opens a key sealed by the legacy scheme", () => {
    // Sealed the way pre-migration accounts were: global salt, 10k rounds.
    const crypto = nodeCrypto;
    const legacyKey = crypto.pbkdf2Sync("pw", "eduwallet-key-derivation", 10000, 32, "sha256");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", legacyKey, iv);
    const encrypted = cipher.update(KEY, "utf8", "hex") + cipher.final("hex");

    const sealed = {
      encrypted,
      iv: iv.toString("hex"),
      authTag: cipher.getAuthTag().toString("hex"),
    };
    expect(decryptLegacyPrivateKey(sealed, "pw")).toBe(KEY);
  });
});

describe("session tokens", () => {
  it("round-trips a payload", () => {
    const token = createJWT({ userId: "u-1", role: "student" });
    const payload = verifyJWT(token);
    expect(payload?.userId).toBe("u-1");
    expect(payload?.role).toBe("student");
  });

  it("sets an expiry one TTL in the future", () => {
    const payload = verifyJWT(createJWT({ userId: "u-1" }));
    const now = Math.floor(Date.now() / 1000);
    expect(Number(payload?.exp) - Number(payload?.iat)).toBe(TOKEN_TTL_SECONDS);
    expect(Number(payload?.exp)).toBeGreaterThan(now);
  });

  it("rejects a token whose payload was edited", () => {
    const token = createJWT({ userId: "u-1", role: "student" });
    const [header, , signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: "u-2", role: "university", exp: 9999999999 })
    ).toString("base64url");
    expect(verifyJWT(`${header}.${forgedBody}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with an unexpected algorithm claim", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ userId: "u-1", exp: 9999999999 })).toString(
      "base64url"
    );
    expect(verifyJWT(`${header}.${body}.`)).toBeNull();
  });

  it("rejects malformed and empty tokens", () => {
    expect(verifyJWT("")).toBeNull();
    expect(verifyJWT("a.b")).toBeNull();
    expect(verifyJWT("not-a-token")).toBeNull();
  });

  it("rejects an expired token", () => {
    // Forge an expired-but-correctly-signed token the way the signer would.
    const crypto = nodeCrypto;
    const secret = process.env.JWT_SECRET || "eduwallet-dev-secret-change-in-production";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const past = Math.floor(Date.now() / 1000) - 10;
    const body = Buffer.from(JSON.stringify({ userId: "u-1", iat: past - 60, exp: past })).toString(
      "base64url"
    );
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");

    expect(verifyJWT(`${header}.${body}.${signature}`)).toBeNull();
  });
});

describe("randomToken", () => {
  it("produces url-safe tokens that do not repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken(18)));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
