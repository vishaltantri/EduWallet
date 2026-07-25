import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CRED_PATH = path.join(process.cwd(), "data", "credentials.json");

function getCredentials() {
  if (!fs.existsSync(CRED_PATH)) return [];
  return JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
}

// GET /api/credentials/issuer/[address]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const creds = getCredentials();
    const issuerCreds = creds.filter(
      (c: { issuerAddress: string }) => c.issuerAddress.toLowerCase() === address.toLowerCase()
    );

    return NextResponse.json({ credentials: issuerCreds });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
