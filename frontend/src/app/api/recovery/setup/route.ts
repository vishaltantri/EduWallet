import { NextResponse } from "next/server";
import { isErrorResult, requireRole } from "@/lib/auth";
import {
  findUserByEmail,
  getRecoveryConfiguration,
  getRecoveryRequestsForStudent,
  saveRecoveryConfiguration,
} from "@/lib/stores";
import { institutionNameFor } from "@/lib/models";
import { decryptFromCustody } from "@/lib/crypto";
import { isChainConfigured, setupGuardiansOnChain } from "@/lib/blockchain";
import { isRecoveryActive } from "@/lib/recovery";

// GET /api/recovery/setup
export async function GET(request: Request) {
  const auth = await requireRole(request, "student");
  if (isErrorResult(auth)) return auth.response;

  const configuration = await getRecoveryConfiguration(auth.user.id);
  if (!configuration) return NextResponse.json({ configuration: null });

  // Resolve guardian display names so the UI can show who holds the keys.
  const guardians = await Promise.all(
    configuration.guardianEmails.map(async (email) => {
      const guardian = await findUserByEmail(email);
      return {
        email,
        name: guardian?.name ?? "Unknown",
        institutionName: guardian ? institutionNameFor(guardian) : undefined,
        walletAddress: guardian?.walletAddress ?? "",
      };
    })
  );

  return NextResponse.json({ configuration: { ...configuration, guardians } });
}

// POST /api/recovery/setup
export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, "student");
    if (isErrorResult(auth)) return auth.response;

    const { guardianEmails, threshold } = await request.json();

    if (!Array.isArray(guardianEmails) || guardianEmails.length < 2) {
      return NextResponse.json({ error: "Minimum 2 guardians required" }, { status: 400 });
    }
    if (guardianEmails.length > 5) {
      return NextResponse.json({ error: "Maximum 5 guardians allowed" }, { status: 400 });
    }
    if (!Number.isInteger(threshold) || threshold < 2 || threshold > guardianEmails.length) {
      return NextResponse.json(
        { error: `Threshold must be between 2 and ${guardianEmails.length}` },
        { status: 400 }
      );
    }

    const normalizedEmails = guardianEmails.map((email) =>
      typeof email === "string" ? email.trim().toLowerCase() : ""
    );
    if (normalizedEmails.some((email) => !/^\S+@\S+\.\S+$/.test(email))) {
      return NextResponse.json({ error: "Each guardian must have a valid email address" }, { status: 400 });
    }
    if (new Set(normalizedEmails).size !== normalizedEmails.length) {
      return NextResponse.json({ error: "Each guardian can only be added once" }, { status: 400 });
    }
    if (normalizedEmails.includes(auth.user.email.toLowerCase())) {
      return NextResponse.json({ error: "You cannot be your own guardian" }, { status: 400 });
    }

    const guardianAddresses: string[] = [];
    for (const email of normalizedEmails) {
      const guardian = await findUserByEmail(email);
      if (!guardian) {
        return NextResponse.json({ error: `Guardian not found: ${email}` }, { status: 404 });
      }
      if (guardian.role !== "university") {
        return NextResponse.json({ error: `${email} is not an institution account` }, { status: 400 });
      }
      guardianAddresses.push(guardian.walletAddress);
    }

    // Changing the guardian set mid-recovery would move the goalposts on a
    // request that is already collecting approvals.
    const open = (await getRecoveryRequestsForStudent(auth.user.id)).filter((request) =>
      isRecoveryActive(request)
    );
    if (open.length) {
      return NextResponse.json(
        {
          error:
            "A recovery request on this account is in progress. Cancel it before changing your guardians.",
        },
        { status: 409 }
      );
    }

    // Register the guardian set on RecoveryManager too, signed by the
    // student's own custodied wallet — `setupGuardians` keys off msg.sender,
    // so it cannot be relayed by the platform wallet.
    let txHash: string | undefined;
    let chainError: string | undefined;
    if (isChainConfigured() && auth.user.custody) {
      const chain = await setupGuardiansOnChain(
        decryptFromCustody(auth.user.custody),
        guardianAddresses,
        threshold
      );
      txHash = chain.txHash;
      chainError = chain.error;
    } else if (isChainConfigured()) {
      chainError =
        "This account has no server-side wallet copy, so the guardian set could not be anchored on-chain.";
    }

    await saveRecoveryConfiguration({
      studentId: auth.user.id,
      guardianEmails: normalizedEmails,
      guardianAddresses,
      threshold,
      configuredAt: new Date().toISOString(),
      txHash,
      chainError,
    });

    return NextResponse.json({
      message: txHash
        ? "Guardians configured and registered on-chain"
        : "Guardians configured",
      guardians: normalizedEmails.length,
      threshold,
      txHash,
      chainError,
    });
  } catch (error) {
    console.error("Recovery setup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
