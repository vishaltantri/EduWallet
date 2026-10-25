import { NextResponse } from "next/server";
import { findUserByEmail, updateUser } from "@/lib/stores";
import {
  createJWT,
  decryptLegacyPrivateKey,
  encryptForCustody,
  encryptPrivateKey,
  randomToken,
  verifyPassword,
} from "@/lib/crypto";
import { toPublicUser, type StoredUser } from "@/lib/models";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    sweepRateLimits();
    const limit = rateLimit(clientKey(request, "login"), 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { email, password } = await request.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await migrateWalletCustody(user, password);
    await updateUser(user.id, { lastLoginAt: new Date().toISOString() });

    return NextResponse.json({
      token: createJWT({ userId: user.id, role: user.role }),
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Accounts created before wallet custody existed cannot sign certificates,
 * because the only copy of their key is sealed under a password the server
 * never keeps. Login is the one moment the password is available, so re-seal
 * the wallet then — transparently, exactly once per account.
 */
async function migrateWalletCustody(user: StoredUser, password: string) {
  if (user.custody && user.keySalt) return;

  try {
    const sealed = {
      encrypted: user.encryptedPrivateKey,
      iv: user.iv,
      authTag: user.authTag,
    };
    const privateKey = decryptLegacyPrivateKey(sealed, password);
    const keySalt = randomToken(16);
    const resealed = encryptPrivateKey(privateKey, password, keySalt);

    await updateUser(user.id, {
      encryptedPrivateKey: resealed.encrypted,
      iv: resealed.iv,
      authTag: resealed.authTag,
      keySalt,
      custody: encryptForCustody(privateKey),
    });
  } catch (error) {
    console.warn("[auth] wallet custody migration skipped:", error);
  }
}
