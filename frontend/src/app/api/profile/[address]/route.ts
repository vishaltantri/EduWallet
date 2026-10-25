import { NextResponse } from "next/server";
import { findUserByWallet, getCredentialsForUser } from "@/lib/stores";
import { resolveOutcome } from "@/lib/verification";

/**
 * Public credential profile for a wallet address — a verifiable résumé.
 *
 * Only active, signature-valid credentials are listed: a public profile is a
 * claim about someone, so anything revoked or unverifiable stays off it.
 * The address is already public on-chain, but the email never appears here.
 */
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Not a valid wallet address" }, { status: 400 });
    }

    const holder = await findUserByWallet(address);

    if (!holder || holder.role !== "student") {
      return NextResponse.json({ error: "No credential holder at this address" }, { status: 404 });
    }

    const owned = (await getCredentialsForUser(holder))
      // resolveOutcome, not the raw signature flag: a credential whose body no
      // longer matches its signed hash is "tampered" even though the signature
      // itself still recovers to the issuer.
      .filter((credential) => resolveOutcome(credential) === "valid")
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

    return NextResponse.json({
      holder: {
        name: holder.name,
        walletAddress: holder.walletAddress,
        memberSince: holder.createdAt,
        // Signals that an old link still resolves after a social recovery.
        requestedAddress: address,
        recovered: holder.walletAddress.toLowerCase() !== address.toLowerCase(),
      },
      credentials: owned.map((credential) => ({
        id: credential.id,
        tokenId: credential.tokenId,
        degreeType: credential.degreeType,
        major: credential.major,
        grade: credential.grade,
        institutionName: credential.institutionName,
        issuedAt: credential.issuedAt,
        anchored: Boolean(credential.anchored),
      })),
    });
  } catch (error) {
    console.error("Profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
