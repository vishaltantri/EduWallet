import { NextResponse } from "next/server";
import { originLabel } from "@/lib/auth";
import {
  findCredentialById,
  findShareLink,
  isShareLinkActive,
  recordVerification,
  updateShareLink,
} from "@/lib/stores";
import { buildVerification, resolveOutcome } from "@/lib/verification";

// GET /api/verify/share/[token] — public resolution of a scoped share link.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const link = await findShareLink(token);

    if (!link) {
      return NextResponse.json({ error: "This verification link does not exist", outcome: "not_found" }, { status: 404 });
    }
    if (!isShareLinkActive(link)) {
      return NextResponse.json(
        {
          error: link.revoked
            ? "The credential holder revoked this verification link"
            : "This verification link has expired",
          outcome: "not_found",
          expired: !link.revoked,
        },
        { status: 410 }
      );
    }

    const credential = await findCredentialById(link.credentialId);
    if (!credential) {
      return NextResponse.json({ error: "Credential not found", outcome: "not_found" }, { status: 404 });
    }

    const response = await buildVerification(credential, {
      anonymized: link.anonymized,
      shareLabel: link.label,
      shareExpiresAt: link.expiresAt,
    });

    await Promise.all([
      recordVerification({
        credentialId: credential.id,
        outcome: resolveOutcome(credential),
        origin: originLabel(request),
        shareToken: link.token,
      }),
      updateShareLink(link.token, {
        viewCount: link.viewCount + 1,
        lastViewedAt: new Date().toISOString(),
      }),
    ]);

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Share verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
