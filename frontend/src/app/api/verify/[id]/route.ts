import { NextResponse } from "next/server";
import { originLabel } from "@/lib/auth";
import { findCredentialById, recordVerification } from "@/lib/stores";
import { buildVerification, resolveOutcome } from "@/lib/verification";

// GET /api/verify/[id] — public, no authentication required.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const credential = await findCredentialById(id);

    if (!credential) {
      return NextResponse.json({ error: "Credential not found", outcome: "not_found" }, { status: 404 });
    }

    // Snapshot the count before logging this check, so the response reads
    // "verified 3 times before" rather than counting the caller's own visit.
    const response = await buildVerification(credential);

    await recordVerification({
      credentialId: credential.id,
      outcome: resolveOutcome(credential),
      origin: originLabel(request),
    });

    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
