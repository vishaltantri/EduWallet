import { NextResponse } from "next/server";
import { Wallet } from "ethers";
import { authenticate } from "@/lib/auth";
import {
  createJWT,
  decryptLegacyPrivateKey,
  decryptPrivateKey,
  encryptForCustody,
  encryptPrivateKey,
  hashPassword,
  randomToken,
  verifyPassword,
} from "@/lib/crypto";
import { updateUser } from "@/lib/stores";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Change the signed-in user's password.
 *
 * The wallet key is sealed under a key derived from the password, so a
 * password change is not just a hash swap: the key has to be opened with the
 * old password and re-sealed under the new one in the same request. Doing the
 * hash first and the re-seal second would leave an account that can sign in
 * but can no longer open its own wallet, so the re-seal is computed before
 * anything is written and both are written together.
 */
export async function POST(request: Request) {
  try {
    sweepRateLimits();
    const limit = rateLimit(clientKey(request, "password-change"), 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Your current password and a new password are both required" },
        { status: 400 }
      );
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "Your new password must be different from your current one" },
        { status: 400 }
      );
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "That current password is not correct" }, { status: 401 });
    }

    const sealed = {
      encrypted: user.encryptedPrivateKey,
      iv: user.iv,
      authTag: user.authTag,
    };

    let privateKey: string;
    try {
      privateKey = user.keySalt
        ? decryptPrivateKey(sealed, currentPassword, user.keySalt)
        : decryptLegacyPrivateKey(sealed, currentPassword);
    } catch {
      return NextResponse.json(
        { error: "Your wallet could not be unsealed, so the password was not changed." },
        { status: 500 }
      );
    }

    // Refuse rather than write a password that would orphan the wallet.
    const keyAddress = user.keyWalletAddress ?? user.walletAddress;
    if (new Wallet(privateKey).address.toLowerCase() !== keyAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Wallet key mismatch — the password was not changed." },
        { status: 500 }
      );
    }

    const keySalt = randomToken(16);
    const resealed = encryptPrivateKey(privateKey, newPassword, keySalt);

    await updateUser(user.id, {
      passwordHash: hashPassword(newPassword),
      encryptedPrivateKey: resealed.encrypted,
      iv: resealed.iv,
      authTag: resealed.authTag,
      keySalt,
      // Preserve whichever custody state the account already had: a recovered
      // account has none, and must not silently regain one.
      custody: user.custody ? encryptForCustody(privateKey) : undefined,
    });

    // Existing tokens stay valid until they expire — they are signed over the
    // user id, not the password — so issue a fresh one and let the client
    // replace what it holds.
    return NextResponse.json(
      {
        message: "Password changed",
        token: createJWT({ userId: user.id, role: user.role }),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
