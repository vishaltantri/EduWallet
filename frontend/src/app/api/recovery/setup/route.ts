import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, findUserById, findUserByEmail } from "@/lib/userStore";
import { getRecoveryConfiguration, saveRecoveryConfiguration } from "@/lib/recoveryStore";

function getAuthenticatedStudent(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const payload = verifyJWT(authHeader.slice(7));
  const user = payload && typeof payload.userId === "string" ? findUserById(payload.userId) : undefined;
  return user?.role === "student" ? user : null;
}

// GET /api/recovery/setup
export async function GET(request: NextRequest) {
  const user = getAuthenticatedStudent(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ configuration: getRecoveryConfiguration(user.id) || null });
}

// POST /api/recovery/setup
export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedStudent(request);
    if (!user) {
      return NextResponse.json({ error: "Only students can configure recovery" }, { status: 403 });
    }

    const { guardianEmails, threshold } = await request.json();

    if (!guardianEmails || !Array.isArray(guardianEmails) || guardianEmails.length < 2) {
      return NextResponse.json({ error: "Minimum 2 guardians required" }, { status: 400 });
    }

    if (guardianEmails.length > 5) {
      return NextResponse.json({ error: "Maximum 5 guardians allowed" }, { status: 400 });
    }

    if (!Number.isInteger(threshold) || threshold < 2 || threshold > guardianEmails.length) {
      return NextResponse.json({ error: `Threshold must be between 2 and ${guardianEmails.length}` }, { status: 400 });
    }

    // Verify all guardians exist and are university staff
    const normalizedEmails = guardianEmails.map((email) =>
      typeof email === "string" ? email.trim().toLowerCase() : ""
    );
    if (normalizedEmails.some((email) => !/^\S+@\S+\.\S+$/.test(email))) {
      return NextResponse.json({ error: "Each guardian must have a valid email address" }, { status: 400 });
    }
    if (new Set(normalizedEmails).size !== normalizedEmails.length) {
      return NextResponse.json({ error: "Each guardian can only be added once" }, { status: 400 });
    }

    for (const email of normalizedEmails) {
      const guardian = findUserByEmail(email);
      if (!guardian) {
        return NextResponse.json({ error: `Guardian not found: ${email}` }, { status: 404 });
      }
      if (guardian.role !== "university") {
        return NextResponse.json({ error: `${email} is not university staff` }, { status: 400 });
      }
    }

    saveRecoveryConfiguration({
      studentId: user.id,
      guardianEmails: normalizedEmails,
      guardianAddresses: normalizedEmails.map((email) => findUserByEmail(email)!.walletAddress),
      threshold,
      configuredAt: new Date().toISOString(),
    });

    // Contract submission is intentionally handled separately: this prototype
    // has no server-side transaction signer configured for student wallets.
    return NextResponse.json({
      message: "Guardians configured successfully",
      guardians: normalizedEmails.length,
      threshold,
    });
  } catch (error) {
    console.error("Recovery setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
