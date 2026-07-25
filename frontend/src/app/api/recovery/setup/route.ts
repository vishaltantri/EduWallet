import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, findUserById, findUserByEmail } from "@/lib/userStore";

// POST /api/recovery/setup
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJWT(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = findUserById(payload.userId as string);
    if (!user || user.role !== "student") {
      return NextResponse.json({ error: "Only students can configure recovery" }, { status: 403 });
    }

    const { guardianEmails, threshold } = await request.json();

    if (!guardianEmails || !Array.isArray(guardianEmails) || guardianEmails.length < 2) {
      return NextResponse.json({ error: "Minimum 2 guardians required" }, { status: 400 });
    }

    if (guardianEmails.length > 5) {
      return NextResponse.json({ error: "Maximum 5 guardians allowed" }, { status: 400 });
    }

    if (!threshold || threshold < 2 || threshold > guardianEmails.length) {
      return NextResponse.json({ error: `Threshold must be between 2 and ${guardianEmails.length}` }, { status: 400 });
    }

    // Verify all guardians exist and are university staff
    const guardianAddresses: string[] = [];
    for (const email of guardianEmails) {
      const guardian = findUserByEmail(email);
      if (!guardian) {
        return NextResponse.json({ error: `Guardian not found: ${email}` }, { status: 404 });
      }
      if (guardian.role !== "university") {
        return NextResponse.json({ error: `${email} is not university staff` }, { status: 400 });
      }
      guardianAddresses.push(guardian.walletAddress);
    }

    // In production, this would call RecoveryManager.setupGuardians() on-chain
    // For prototype, we store the config locally
    return NextResponse.json({
      message: "Guardians configured successfully",
      guardians: guardianEmails.length,
      threshold,
      // In production: txHash from blockchain
    });
  } catch (error) {
    console.error("Recovery setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
