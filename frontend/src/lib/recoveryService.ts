/**
 * Server-side recovery operations, shared by the recovery API routes.
 *
 * Everything that touches the chain here is best-effort in the same way
 * issuance is: the off-chain record is authoritative for the app, the
 * on-chain request is the public, censorship-resistant mirror. A failed
 * mirror is recorded on the request rather than swallowed, so the UI can say
 * "approved here, not yet anchored".
 */

import { v4 as uuidv4 } from "uuid";
import { decryptFromCustody } from "./crypto";
import {
  approveRecoveryOnChain,
  executeRecoveryOnChain,
  initiateRecoveryOnChain,
  isChainConfigured,
} from "./blockchain";
import {
  ADDRESS_PATTERN,
  approvalFor,
  hasApproved,
  isRecoveryActive,
  recoveryState,
} from "./recovery";
import {
  addRecoveryRequest,
  findUserByEmail,
  getRecoveryConfiguration,
  getRecoveryRequestsForStudent,
  isWalletAddressAvailable,
  migrateUserWallet,
  updateRecoveryRequest,
} from "./stores";
import type { StoredRecoveryRequest, StoredUser } from "./models";

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

function fail(error: string, status: number): { ok: false; error: string; status: number } {
  return { ok: false, error, status };
}

/** Does this institution hold a guardian seat on the student's account? */
export function isGuardianOf(request: StoredRecoveryRequest, guardian: StoredUser): boolean {
  const target = guardian.walletAddress.toLowerCase();
  return request.guardianAddresses.some((address) => address.toLowerCase() === target);
}

/** A request that already lapsed reports Gone, not a generic conflict — the
 *  caller's next step is to open a new request, not to retry this one. */
function lapsed() {
  return fail("This request lapsed after seven days and can no longer be used", 410);
}

// ─── Initiate ───────────────────────────────────────────────────────────────

export async function initiateRecovery(input: {
  guardian: StoredUser;
  studentEmail: string;
  newAddress: string;
}): Promise<ServiceResult<StoredRecoveryRequest>> {
  const newAddress = input.newAddress.trim();
  if (!ADDRESS_PATTERN.test(newAddress)) {
    return fail("Enter the student's new wallet address as a 0x… 40-character address", 400);
  }

  const student = await findStudentByEmail(input.studentEmail);
  if (!student) {
    return fail("No student account with that email address", 404);
  }
  if (student.walletAddress.toLowerCase() === newAddress.toLowerCase()) {
    return fail("That is already this account's wallet address", 400);
  }
  if (!(await isWalletAddressAvailable(newAddress, student.id))) {
    return fail("Another account already uses that wallet address", 409);
  }

  const configuration = await getRecoveryConfiguration(student.id);
  if (!configuration) {
    return fail("This student has not nominated any recovery guardians", 400);
  }
  if (!configuration.guardianAddresses.some((a) => a.toLowerCase() === input.guardian.walletAddress.toLowerCase())) {
    return fail("You are not a guardian for this account", 403);
  }

  const existing = await getRecoveryRequestsForStudent(student.id);
  if (existing.some((request) => isRecoveryActive(request))) {
    return fail("A recovery request for this account is already in progress", 409);
  }

  const now = Date.now();
  const request: StoredRecoveryRequest = {
    id: uuidv4(),
    studentId: student.id,
    studentEmail: student.email,
    studentName: student.name,
    fromAddress: student.walletAddress,
    newAddress,
    threshold: configuration.threshold,
    guardianAddresses: configuration.guardianAddresses,
    initiatedByEmail: input.guardian.email,
    initiatedAt: new Date(now).toISOString(),
    // The contract counts the initiator as the first approval; mirror that.
    approvals: [
      approvalFor({
        guardianId: input.guardian.id,
        guardianEmail: input.guardian.email,
        guardianAddress: input.guardian.walletAddress,
        now,
      }),
    ],
    status: "pending",
  };

  if (isChainConfigured() && input.guardian.custody) {
    const chain = await initiateRecoveryOnChain(
      decryptFromCustody(input.guardian.custody),
      student.walletAddress,
      newAddress
    );
    if (chain.txHash) {
      request.initiateTxHash = chain.txHash;
      request.approvals[0].txHash = chain.txHash;
    } else {
      request.chainError = chain.error;
    }
  }

  await addRecoveryRequest(request);
  return { ok: true, value: request };
}

// ─── Approve ────────────────────────────────────────────────────────────────

export async function approveRecovery(input: {
  guardian: StoredUser;
  request: StoredRecoveryRequest;
}): Promise<ServiceResult<StoredRecoveryRequest>> {
  const { guardian, request } = input;

  if (!isGuardianOf(request, guardian)) {
    return fail("You are not a guardian for this account", 403);
  }

  if (request.status === "expired") return lapsed();
  if (request.status !== "pending") {
    return fail(`This request is already ${request.status}`, 409);
  }

  const state = recoveryState(request);
  if (state.expired) {
    await updateRecoveryRequest(request.id, { status: "expired", closedAt: new Date().toISOString() });
    return lapsed();
  }
  if (hasApproved(request, guardian.id)) {
    return fail("You have already approved this recovery", 409);
  }

  const approval = approvalFor({
    guardianId: guardian.id,
    guardianEmail: guardian.email,
    guardianAddress: guardian.walletAddress,
  });

  let chainError = request.chainError;
  if (isChainConfigured() && guardian.custody) {
    const chain = await approveRecoveryOnChain(
      decryptFromCustody(guardian.custody),
      request.fromAddress
    );
    if (chain.txHash) {
      approval.txHash = chain.txHash;
      chainError = undefined;
    } else {
      chainError = chain.error;
    }
  }

  const updated = await updateRecoveryRequest(request.id, {
    approvals: [...request.approvals, approval],
    chainError,
  });
  if (!updated) return fail("Recovery request not found", 404);
  return { ok: true, value: updated };
}

// ─── Execute ────────────────────────────────────────────────────────────────

export async function executeRecovery(input: {
  actor: StoredUser;
  request: StoredRecoveryRequest;
}): Promise<ServiceResult<{ request: StoredRecoveryRequest; migratedTo: string }>> {
  const { actor, request } = input;

  // The contract lets anyone execute once the gate is open, but exposing that
  // publicly here would let a stranger finalise someone else's migration, so
  // the API keeps it to the guardians and the account holder.
  const permitted = isGuardianOf(request, actor) || actor.id === request.studentId;
  if (!permitted) {
    return fail("Only a guardian or the account holder can complete this recovery", 403);
  }

  if (request.status === "expired") return lapsed();
  if (request.status !== "pending") {
    return fail(`This request is already ${request.status}`, 409);
  }

  const state = recoveryState(request);
  if (state.expired) {
    await updateRecoveryRequest(request.id, { status: "expired", closedAt: new Date().toISOString() });
    return lapsed();
  }
  if (!state.thresholdMet) {
    return fail(
      `This recovery needs ${request.threshold} guardian approvals and has ${state.approvals}`,
      409
    );
  }
  if (!state.cooldownPassed) {
    return fail("The 24-hour safety delay has not elapsed yet", 409);
  }
  if (!(await isWalletAddressAvailable(request.newAddress, request.studentId))) {
    return fail("Another account has taken that wallet address since the request opened", 409);
  }

  let executeTxHash: string | undefined;
  let chainError: string | undefined;
  if (isChainConfigured()) {
    const chain = await executeRecoveryOnChain(request.fromAddress);
    if (chain.txHash) executeTxHash = chain.txHash;
    else chainError = chain.error;
  }

  const migrated = await migrateUserWallet(request.studentId, request.newAddress);
  if (!migrated) return fail("The account being recovered no longer exists", 404);

  const updated = await updateRecoveryRequest(request.id, {
    status: "executed",
    executedAt: new Date().toISOString(),
    executeTxHash,
    chainError,
  });
  if (!updated) return fail("Recovery request not found", 404);

  return { ok: true, value: { request: updated, migratedTo: request.newAddress } };
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

/**
 * Cancel a pending request. Only the account holder can — that is the whole
 * point of the cooldown, and it mirrors `RecoveryManager.cancelRecovery`.
 */
export async function cancelRecovery(input: {
  actor: StoredUser;
  request: StoredRecoveryRequest;
}): Promise<ServiceResult<StoredRecoveryRequest>> {
  const { actor, request } = input;

  if (actor.id !== request.studentId) {
    return fail("Only the account holder can cancel a recovery request", 403);
  }
  if (request.status !== "pending") {
    return fail(`This request is already ${request.status}`, 409);
  }

  const updated = await updateRecoveryRequest(request.id, {
    status: "cancelled",
    closedAt: new Date().toISOString(),
  });
  if (!updated) return fail("Recovery request not found", 404);
  return { ok: true, value: updated };
}

// ─── Presentation ───────────────────────────────────────────────────────────

/** Shape returned to the browser. Guardian emails are visible to the holder
 *  and to fellow guardians; nothing here is key material. */
export function toPublicRecoveryRequest(request: StoredRecoveryRequest, now = Date.now()) {
  const state = recoveryState(request, now);
  return {
    id: request.id,
    studentEmail: request.studentEmail,
    studentName: request.studentName,
    fromAddress: request.fromAddress,
    newAddress: request.newAddress,
    threshold: request.threshold,
    initiatedByEmail: request.initiatedByEmail,
    initiatedAt: request.initiatedAt,
    status: state.expired ? ("expired" as const) : request.status,
    approvals: request.approvals.map((approval) => ({
      guardianEmail: approval.guardianEmail,
      approvedAt: approval.approvedAt,
      txHash: approval.txHash,
    })),
    executedAt: request.executedAt,
    initiateTxHash: request.initiateTxHash,
    executeTxHash: request.executeTxHash,
    chainError: request.chainError,
    state,
  };
}

async function findStudentByEmail(email: unknown): Promise<StoredUser | undefined> {
  if (typeof email !== "string" || !email.trim()) return undefined;
  const user = await findUserByEmail(email.trim().toLowerCase());
  return user?.role === "student" ? user : undefined;
}
