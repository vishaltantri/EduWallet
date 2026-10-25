import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { findRecoveryRequestById } from "@/lib/stores";
import { executeRecovery, toPublicRecoveryRequest } from "@/lib/recoveryService";

/**
 * Complete the migration: the account moves to the new wallet address and
 * keeps resolving its existing certificates through the old one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { id } = await params;
    const stored = await findRecoveryRequestById(id);
    if (!stored) return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });

    const result = await executeRecovery({ actor: user, request: stored });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: `Account recovered to ${result.value.migratedTo}`,
      migratedTo: result.value.migratedTo,
      request: toPublicRecoveryRequest(result.value.request),
    });
  } catch (error) {
    console.error("Recovery execute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
