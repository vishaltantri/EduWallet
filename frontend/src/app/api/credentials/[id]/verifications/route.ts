import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { findCredentialById, getVerificationsFor } from "@/lib/stores";
import { ownsAddress } from "@/lib/models";

/** Verification history for a credential. Holder and issuer only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { id } = await params;
    const credential = await findCredentialById(id);
    if (!credential) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

    const permitted =
      ownsAddress(user, credential.studentAddress) ||
      ownsAddress(user, credential.issuerAddress);
    if (!permitted) {
      return NextResponse.json({ error: "Not your credential" }, { status: 403 });
    }

    const events = await getVerificationsFor(id);
    return NextResponse.json({ total: events.length, events: events.slice(0, 50) });
  } catch (error) {
    console.error("Verification log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
