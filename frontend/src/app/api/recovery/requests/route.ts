import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import {
  getRecoveryRequestsForGuardian,
  getRecoveryRequestsForStudent,
} from "@/lib/stores";
import { initiateRecovery, toPublicRecoveryRequest } from "@/lib/recoveryService";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

/**
 * Recovery requests visible to the caller.
 *
 * A student sees requests against their own account — that is how they find
 * out about one in time to cancel it. An institution sees requests for every
 * account that nominated them as a guardian.
 */
export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const requests =
      user.role === "student"
        ? await getRecoveryRequestsForStudent(user.id)
        : await getRecoveryRequestsForGuardian(user.walletAddress);

    const now = Date.now();
    return NextResponse.json(
      {
        role: user.role,
        requests: requests
          .map((item) => toPublicRecoveryRequest(item, now))
          .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt)),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Recovery list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Open a recovery request. Guardians only — never the account itself. */
export async function POST(request: Request) {
  try {
    sweepRateLimits();
    const limit = rateLimit(clientKey(request, "recovery-initiate"), 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many recovery requests from this network. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    if (user.role !== "university") {
      return NextResponse.json(
        { error: "Only an institution acting as a guardian can start a recovery" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await initiateRecovery({
      guardian: user,
      studentEmail: typeof body.studentEmail === "string" ? body.studentEmail : "",
      newAddress: typeof body.newAddress === "string" ? body.newAddress : "",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message:
        "Recovery request opened. It needs the remaining guardian approvals and a 24-hour safety delay.",
      request: toPublicRecoveryRequest(result.value),
    });
  } catch (error) {
    console.error("Recovery initiate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
