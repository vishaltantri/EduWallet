import { NextRequest, NextResponse } from "next/server";
import { getCredentials } from "@/app/api/credentials/issue/route";

// GET /api/credentials/student/[address]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const creds = getCredentials();
    const studentCreds = creds.filter(
      (c) => c.studentAddress.toLowerCase() === address.toLowerCase()
    );

    return NextResponse.json({ credentials: studentCreds });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
