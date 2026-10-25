import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import { getCredentials, getVerificationEvents } from "@/lib/stores";
import { checkIntegrity } from "@/lib/credential";

const MONTHS_SHOWN = 6;

/** Issuance and verification analytics for one institution. */
export async function GET(request: Request) {
  try {
    const auth = await requireRole(request, "university");
    if (isErrorResult(auth)) return auth.response;

    const wallet = auth.user.walletAddress.toLowerCase();
    const [allCredentials, allEvents] = await Promise.all([getCredentials(), getVerificationEvents()]);
    const credentials = allCredentials.filter((c) => c.issuerAddress.toLowerCase() === wallet);
    const ownedIds = new Set(credentials.map((c) => c.id));
    const events = allEvents.filter((event) => ownedIds.has(event.credentialId));

    // Issuance volume for the trailing six months, oldest first.
    const buckets: { month: string; label: string; issued: number }[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      buckets.push({
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("en-US", { month: "short" }),
        issued: 0,
      });
    }
    const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.month, index]));
    for (const credential of credentials) {
      const key = credential.issuedAt.slice(0, 7);
      const index = bucketIndex.get(key);
      if (index !== undefined) buckets[index].issued += 1;
    }

    const byDegree = new Map<string, number>();
    for (const credential of credentials) {
      byDegree.set(credential.degreeType, (byDegree.get(credential.degreeType) ?? 0) + 1);
    }

    const verificationsByCredential = new Map<string, number>();
    for (const event of events) {
      verificationsByCredential.set(
        event.credentialId,
        (verificationsByCredential.get(event.credentialId) ?? 0) + 1
      );
    }

    const mostVerified = credentials
      .map((credential) => ({
        id: credential.id,
        tokenId: credential.tokenId,
        studentName: credential.studentName,
        degreeType: credential.degreeType,
        major: credential.major,
        verifications: verificationsByCredential.get(credential.id) ?? 0,
      }))
      .filter((entry) => entry.verifications > 0)
      .sort((a, b) => b.verifications - a.verifications)
      .slice(0, 5);

    const signedCount = credentials.filter((credential) => checkIntegrity(credential).signatureValid).length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      totals: {
        issued: credentials.length,
        active: credentials.filter((credential) => credential.isValid).length,
        revoked: credentials.filter((credential) => !credential.isValid).length,
        anchored: credentials.filter((credential) => credential.anchored).length,
        signed: signedCount,
        verifications: events.length,
        verificationsLast30Days: events.filter(
          (event) => new Date(event.verifiedAt).getTime() >= thirtyDaysAgo
        ).length,
        uniqueStudents: new Set(credentials.map((c) => c.studentAddress.toLowerCase())).size,
      },
      issuanceByMonth: buckets,
      degreeMix: [...byDegree.entries()]
        .map(([degreeType, count]) => ({ degreeType, count }))
        .sort((a, b) => b.count - a.count),
      mostVerified,
      recentVerifications: events.slice(0, 12).map((event) => {
        const credential = credentials.find((item) => item.id === event.credentialId);
        return {
          ...event,
          studentName: credential?.studentName ?? "—",
          degreeType: credential?.degreeType ?? "—",
        };
      }),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
