import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import { issueCredential, parseIssuanceCsv } from "@/lib/issuance";

const MAX_BULK_ROWS = 100;

/**
 * Bulk issuance from CSV.
 *
 * Rows are validated up-front and issued one at a time; a failure on row 7
 * does not roll back rows 1-6, so the response reports per-row outcomes
 * rather than a single pass/fail.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, "university");
    if (isErrorResult(auth)) return auth.response;

    const { csv, dryRun } = await request.json();
    if (typeof csv !== "string" || !csv.trim()) {
      return NextResponse.json({ error: "Paste or upload a CSV first" }, { status: 400 });
    }

    const { rows, errors } = parseIssuanceCsv(csv);

    if (rows.length > MAX_BULK_ROWS) {
      return NextResponse.json(
        { error: `Bulk issuance is limited to ${MAX_BULK_ROWS} rows per upload` },
        { status: 400 }
      );
    }

    if (dryRun) {
      return NextResponse.json({ dryRun: true, parsed: rows.length, rows, errors });
    }

    if (!rows.length) {
      return NextResponse.json({ error: "No valid rows to issue", errors }, { status: 400 });
    }

    const issued: { email: string; tokenId: number; id: string }[] = [];
    const failed: { email: string; reason: string }[] = [...errors.map((reason) => ({ email: "—", reason }))];

    for (const row of rows) {
      const result = await issueCredential(auth.user, row);
      if (result.ok) {
        issued.push({
          email: row.studentEmail,
          tokenId: result.credential.tokenId,
          id: result.credential.id,
        });
      } else {
        failed.push({ email: row.studentEmail, reason: result.error });
      }
    }

    return NextResponse.json({
      message: `Issued ${issued.length} of ${rows.length} certificates`,
      issued,
      failed,
    });
  } catch (error) {
    console.error("Bulk issue error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
