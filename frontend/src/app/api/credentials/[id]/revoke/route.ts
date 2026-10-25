import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import { findCredentialById, updateCredential } from "@/lib/stores";
import { decryptFromCustody } from "@/lib/crypto";
import { isChainConfigured, revokeCertificateOnChain } from "@/lib/blockchain";

/**
 * Revoke a certificate.
 *
 * The signature and content hash are deliberately left intact: the document
 * really was issued, and a verifier should be able to see a genuine but
 * withdrawn credential rather than one that simply vanishes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, "university");
    if (isErrorResult(auth)) return auth.response;

    const { id } = await params;
    const credential = await findCredentialById(id);
    if (!credential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }
    if (credential.issuerAddress.toLowerCase() !== auth.user.walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the issuing institution can revoke this certificate" },
        { status: 403 }
      );
    }
    if (!credential.isValid) {
      return NextResponse.json({ error: "This certificate is already revoked" }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return NextResponse.json({ error: "A revocation reason is required" }, { status: 400 });
    }

    let chainNote: string | undefined;
    if (isChainConfigured() && auth.user.custody && credential.anchored) {
      const result = await revokeCertificateOnChain(
        decryptFromCustody(auth.user.custody),
        credential.chainTokenId ?? credential.tokenId
      );
      chainNote = result.anchored
        ? `Revocation anchored on-chain (${result.txHash})`
        : `Off-chain revocation recorded; chain update pending: ${result.error}`;
    }

    const updated = await updateCredential(id, {
      isValid: false,
      revokedAt: new Date().toISOString(),
      revocationReason: reason.slice(0, 280),
    });

    return NextResponse.json({ message: "Certificate revoked", chainNote, credential: updated });
  } catch (error) {
    console.error("Revoke error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
