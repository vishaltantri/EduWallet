import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import { getCredentials, getVerificationEvents } from "@/lib/stores";

// GET /api/credentials/issuer/[address]
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    const auth = await requireRole(request, "university");
    if (isErrorResult(auth)) return auth.response;

    if (auth.user.walletAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: "You can only view credentials issued by your institution" },
        { status: 403 }
      );
    }

    const [credentials, events] = await Promise.all([getCredentials(), getVerificationEvents()]);
    const issued = credentials.filter(
      (credential) => credential.issuerAddress.toLowerCase() === address.toLowerCase()
    );

    const verificationCounts = new Map<string, number>();
    for (const event of events) {
      verificationCounts.set(event.credentialId, (verificationCounts.get(event.credentialId) ?? 0) + 1);
    }

    return NextResponse.json({
      credentials: issued
        .map((credential) => ({
          ...credential,
          verificationCount: verificationCounts.get(credential.id) ?? 0,
        }))
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
