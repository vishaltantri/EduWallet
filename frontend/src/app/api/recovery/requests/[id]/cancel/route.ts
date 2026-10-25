import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { findRecoveryRequestById } from "@/lib/stores";
import { cancelRecovery, toPublicRecoveryRequest } from "@/lib/recoveryService";

/** The account holder's veto, available for the whole cooldown window. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { id } = await params;
    const stored = await findRecoveryRequestById(id);
    if (!stored) return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });

    const result = await cancelRecovery({ actor: user, request: stored });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: "Recovery request cancelled",
      request: toPublicRecoveryRequest(result.value),
    });
  } catch (error) {
    console.error("Recovery cancel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
