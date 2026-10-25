/**
 * Social recovery state machine.
 *
 * The timings mirror `RecoveryManager.sol` exactly, because the off-chain
 * record and the on-chain request have to agree on when a recovery becomes
 * executable. Anything else and the UI would offer an "Execute" button that
 * the contract then rejects.
 *
 * The functions here are pure and take `now` explicitly so the whole
 * lifecycle is testable without waiting a day.
 */

import type { RecoveryApproval, StoredRecoveryRequest } from "./models";

const PRODUCTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * `RecoveryManager.RECOVERY_COOLDOWN` — 24 hours.
 *
 * Shortenable only outside production, and only through an explicit
 * environment variable, so an end-to-end test can exercise the executable
 * branch without waiting a day. In production the constant is the contract's,
 * because a shorter window here than on chain would offer an "Execute" button
 * the contract then rejects — and the delay is the holder's only protection
 * against guardians colluding.
 */
export const RECOVERY_COOLDOWN_MS = resolveCooldown();

function resolveCooldown(): number {
  if (process.env.NODE_ENV === "production") return PRODUCTION_COOLDOWN_MS;

  const override = Number(process.env.RECOVERY_COOLDOWN_MS_OVERRIDE);
  if (!Number.isFinite(override) || override < 0) return PRODUCTION_COOLDOWN_MS;
  return Math.min(override, PRODUCTION_COOLDOWN_MS);
}

/** `RecoveryManager.RECOVERY_EXPIRY` — 7 days. */
export const RECOVERY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export interface RecoveryState {
  /** Approvals recorded so far, including the initiator's. */
  approvals: number;
  threshold: number;
  thresholdMet: boolean;
  /** Past the 24h cooldown measured from initiation. */
  cooldownPassed: boolean;
  /** Past the 7-day window, so no longer actionable. */
  expired: boolean;
  /** Still collecting approvals or waiting out the cooldown. */
  open: boolean;
  /** Threshold met, cooldown passed, not expired, not already closed. */
  executable: boolean;
  executableAt: string;
  expiresAt: string;
  /** Milliseconds until executable, 0 once it is. */
  waitRemainingMs: number;
}

export function recoveryState(
  request: StoredRecoveryRequest,
  now: number = Date.now()
): RecoveryState {
  const initiatedAt = Date.parse(request.initiatedAt);
  const executableAtMs = initiatedAt + RECOVERY_COOLDOWN_MS;
  const expiresAtMs = initiatedAt + RECOVERY_EXPIRY_MS;

  const approvals = request.approvals.length;
  const thresholdMet = approvals >= request.threshold;
  const cooldownPassed = now >= executableAtMs;
  const settled = request.status !== "pending";
  const expired = !settled && now > expiresAtMs;

  return {
    approvals,
    threshold: request.threshold,
    thresholdMet,
    cooldownPassed,
    expired,
    open: !settled && !expired,
    executable: !settled && !expired && thresholdMet && cooldownPassed,
    executableAt: new Date(executableAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    waitRemainingMs: Math.max(0, executableAtMs - now),
  };
}

/** A request still counts as blocking a new one until it settles or lapses. */
export function isRecoveryActive(
  request: StoredRecoveryRequest,
  now: number = Date.now()
): boolean {
  return recoveryState(request, now).open;
}

export function hasApproved(request: StoredRecoveryRequest, guardianId: string): boolean {
  return request.approvals.some((approval) => approval.guardianId === guardianId);
}

export function isGuardianAddress(request: StoredRecoveryRequest, address: string): boolean {
  const target = address.trim().toLowerCase();
  return request.guardianAddresses.some((candidate) => candidate.toLowerCase() === target);
}

export function approvalFor(input: {
  guardianId: string;
  guardianEmail: string;
  guardianAddress: string;
  txHash?: string;
  now?: number;
}): RecoveryApproval {
  return {
    guardianId: input.guardianId,
    guardianEmail: input.guardianEmail,
    guardianAddress: input.guardianAddress,
    approvedAt: new Date(input.now ?? Date.now()).toISOString(),
    txHash: input.txHash,
  };
}

export const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Human-readable summary of what the request is waiting on.
 *
 * Shown to guardians and to the student, so it has to be honest about both
 * halves of the gate — approvals and the cooldown — rather than reporting
 * only the first one that is unmet.
 */
export function recoveryBlockedReason(state: RecoveryState): string | null {
  if (state.expired) return "This request lapsed after seven days without completing.";
  if (!state.thresholdMet) {
    const remaining = state.threshold - state.approvals;
    return `Waiting on ${remaining} more guardian ${remaining === 1 ? "approval" : "approvals"}.`;
  }
  if (!state.cooldownPassed) {
    const hours = Math.ceil(state.waitRemainingMs / (60 * 60 * 1000));
    return `Approved. The 24-hour safety delay ends in about ${hours} ${hours === 1 ? "hour" : "hours"}.`;
  }
  return null;
}
