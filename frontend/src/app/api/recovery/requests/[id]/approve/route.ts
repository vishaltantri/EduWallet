import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { findRecoveryRequestById } from "@/lib/stores";
import { approveRecovery, toPublicRecoveryRequest } from "@/lib/recoveryService";

/** Record a guardian's approval, on-chain where possible. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    if (user.role !== "university") {
      return NextResponse.json({ error: "Only guardian institutions can approve" }, { status: 403 });
    }

    const { id } = await params;
    const stored = await findRecoveryRequestById(id);
    if (!stored) return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });

    const result = await approveRecovery({ guardian: user, request: stored });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: "Approval recorded",
      request: toPublicRecoveryRequest(result.value),
    });
  } catch (error) {
    console.error("Recovery approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
