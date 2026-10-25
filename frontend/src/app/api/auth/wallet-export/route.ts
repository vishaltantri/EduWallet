import { NextResponse } from "next/server";
import { Wallet } from "ethers";
import { authenticate } from "@/lib/auth";
import { decryptLegacyPrivateKey, decryptPrivateKey, verifyPassword } from "@/lib/crypto";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

/**
 * Hand the user the private key to their own wallet.
 *
 * The standard criticism of a custodial education wallet is that the holder
 * never really owns the credential. This is the escape hatch: the copy of the
 * key sealed under the user's password is opened here, with the password
 * re-entered, and returned once. Nothing is stored, logged, or emailed.
 */
export async function POST(request: Request) {
  try {
    sweepRateLimits();
    const limit = rateLimit(clientKey(request, "wallet-export"), 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many export attempts. Please wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { password } = await request.json();
    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Your password is required" }, { status: 400 });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "That password is not correct" }, { status: 401 });
    }

    const sealed = {
      encrypted: user.encryptedPrivateKey,
      iv: user.iv,
      authTag: user.authTag,
    };

    let privateKey: string;
    try {
      privateKey = user.keySalt
        ? decryptPrivateKey(sealed, password, user.keySalt)
        : decryptLegacyPrivateKey(sealed, password);
    } catch {
      return NextResponse.json(
        { error: "This wallet could not be unsealed. Sign out and back in, then try again." },
        { status: 500 }
      );
    }

    // After a social recovery the sealed key opens the account's previous
    // wallet, not its current one — and that previous wallet is what holds
    // the already-minted certificates, so it is still worth handing over.
    const keyAddress = user.keyWalletAddress ?? user.walletAddress;
    if (new Wallet(privateKey).address.toLowerCase() !== keyAddress.toLowerCase()) {
      return NextResponse.json({ error: "Wallet key mismatch — please contact support" }, { status: 500 });
    }

    const recovered = keyAddress.toLowerCase() !== user.walletAddress.toLowerCase();
    return NextResponse.json(
      {
        walletAddress: keyAddress,
        privateKey,
        currentWalletAddress: user.walletAddress,
        note: recovered
          ? "This is the key to the wallet your certificates were issued to. Your account has since been recovered to a different address, which you already control."
          : undefined,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Wallet export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
