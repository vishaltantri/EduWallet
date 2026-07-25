import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CRED_PATH = path.join(process.cwd(), "data", "credentials.json");

function getCredentials() {
  if (!fs.existsSync(CRED_PATH)) return [];
  return JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
}

// GET /api/verify/[tokenId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId } = await params;
    const id = parseInt(tokenId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    const creds = getCredentials();
    const credential = creds.find((c: { tokenId: number }) => c.tokenId === id);

    if (!credential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    return NextResponse.json({
      isValid: credential.isValid,
      tokenId: credential.tokenId,
      studentName: credential.studentName,
      degreeType: credential.degreeType,
      major: credential.major,
      institutionName: credential.institutionName,
      issuerAddress: credential.issuerAddress,
      studentAddress: credential.studentAddress,
      issuedAt: credential.issuedAt,
      ipfsHash: credential.ipfsHash,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
