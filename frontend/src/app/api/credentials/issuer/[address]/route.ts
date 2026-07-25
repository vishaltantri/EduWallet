import { NextRequest, NextResponse } from "next/server";
import { getCredentials } from "@/app/api/credentials/issue/route";

// GET /api/credentials/issuer/[address]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
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
