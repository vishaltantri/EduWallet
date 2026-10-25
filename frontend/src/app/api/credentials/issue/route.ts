import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import { issueCredential, normalizeIssuance } from "@/lib/issuance";

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, "university");
    if (isErrorResult(auth)) return auth.response;

    const body = await request.json();
    const result = await issueCredential(auth.user, normalizeIssuance(body));

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: "Certificate issued and cryptographically signed",
      tokenId: result.credential.tokenId,
      warnings: result.warnings,
      credential: result.credential,
    });
  } catch (error) {
    console.error("Issue error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
