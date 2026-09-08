import { NextRequest, NextResponse } from "next/server";
import { getCredentials } from "@/app/api/credentials/issue/route";
import { findUserById, verifyJWT } from "@/lib/userStore";

// GET /api/credentials/issuer/[address]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJWT(authorization.slice(7));
    const user = payload && typeof payload.userId === "string" ? findUserById(payload.userId) : undefined;
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (user.role !== "university" || user.walletAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "You can only view credentials issued by your institution" }, { status: 403 });
    }

    const creds = getCredentials();
    const issuerCreds = creds.filter(
      (c) => c.issuerAddress.toLowerCase() === address.toLowerCase()
    );

    return NextResponse.json({ credentials: issuerCreds });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
