import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getCredentialsForUser, getVerificationEvents } from "@/lib/stores";
import { checkIntegrity } from "@/lib/credential";
import { ownsAddress } from "@/lib/models";

// GET /api/credentials/student/[address]
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    // A recovered account asks under its new address while its certificates
    // still name the old one, so authorisation and lookup both span the
    // account's whole wallet history.
    if (!ownsAddress(user, address)) {
      return NextResponse.json({ error: "You can only view your own credentials" }, { status: 403 });
    }

    const [owned, events] = await Promise.all([
      getCredentialsForUser(user),
      getVerificationEvents(),
    ]);

    const verificationCounts = new Map<string, number>();
    for (const event of events) {
      verificationCounts.set(event.credentialId, (verificationCounts.get(event.credentialId) ?? 0) + 1);
    }

    return NextResponse.json({
      credentials: owned
        .map((credential) => ({
          ...credential,
          verificationCount: verificationCounts.get(credential.id) ?? 0,
          integrity: checkIntegrity(credential),
        }))
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
