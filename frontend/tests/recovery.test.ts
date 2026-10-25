import { describe, expect, it } from "vitest";
import {
  RECOVERY_COOLDOWN_MS,
  RECOVERY_EXPIRY_MS,
  approvalFor,
  hasApproved,
  isGuardianAddress,
  isRecoveryActive,
  recoveryBlockedReason,
  recoveryState,
} from "@/lib/recovery";
import type { StoredRecoveryRequest } from "@/lib/models";

const START = Date.parse("2026-07-01T00:00:00.000Z");

function makeRequest(overrides: Partial<StoredRecoveryRequest> = {}): StoredRecoveryRequest {
  return {
    id: "req-1",
    studentId: "student-1",
    studentEmail: "jane@example.com",
    studentName: "Jane Smith",
    fromAddress: "0x1111111111111111111111111111111111111111",
    newAddress: "0x2222222222222222222222222222222222222222",
    threshold: 2,
    guardianAddresses: [
      "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ],
    initiatedByEmail: "registrar@uni.edu",
    initiatedAt: new Date(START).toISOString(),
    approvals: [
      approvalFor({
        guardianId: "g-1",
        guardianEmail: "registrar@uni.edu",
        guardianAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        now: START,
      }),
    ],
    status: "pending",
    ...overrides,
  };
}

describe("recoveryState", () => {
  it("counts the initiator as the first approval", () => {
    const state = recoveryState(makeRequest(), START);
    expect(state.approvals).toBe(1);
    expect(state.thresholdMet).toBe(false);
  });

  it("is not executable before the threshold is met, however long it waits", () => {
    const state = recoveryState(makeRequest(), START + RECOVERY_COOLDOWN_MS + 1);
    expect(state.cooldownPassed).toBe(true);
    expect(state.thresholdMet).toBe(false);
    expect(state.executable).toBe(false);
  });

  it("is not executable with the threshold met but the cooldown still running", () => {
    const request = makeRequest({
      approvals: [
        ...makeRequest().approvals,
        approvalFor({
          guardianId: "g-2",
          guardianEmail: "dean@uni.edu",
          guardianAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          now: START + 1000,
        }),
      ],
    });

    const state = recoveryState(request, START + RECOVERY_COOLDOWN_MS - 1);
    expect(state.thresholdMet).toBe(true);
    expect(state.cooldownPassed).toBe(false);
    expect(state.executable).toBe(false);
    expect(state.waitRemainingMs).toBe(1);
  });

  it("becomes executable once both gates are satisfied", () => {
    const request = makeRequest({
      approvals: [
        ...makeRequest().approvals,
        approvalFor({
          guardianId: "g-2",
          guardianEmail: "dean@uni.edu",
          guardianAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          now: START + 1000,
        }),
      ],
    });

    const state = recoveryState(request, START + RECOVERY_COOLDOWN_MS);
    expect(state.executable).toBe(true);
    expect(state.waitRemainingMs).toBe(0);
  });

  it("lapses after the seven-day expiry window", () => {
    const request = makeRequest();
    expect(recoveryState(request, START + RECOVERY_EXPIRY_MS).expired).toBe(false);
    const expired = recoveryState(request, START + RECOVERY_EXPIRY_MS + 1);
    expect(expired.expired).toBe(true);
    expect(expired.open).toBe(false);
    expect(expired.executable).toBe(false);
  });

  it("treats a settled request as closed regardless of the clock", () => {
    for (const status of ["executed", "cancelled", "expired"] as const) {
      const state = recoveryState(makeRequest({ status }), START + 1000);
      expect(state.open).toBe(false);
      expect(state.executable).toBe(false);
      // A settled request is never re-labelled expired by the clock.
      expect(state.expired).toBe(false);
    }
  });

  it("matches the contract's cooldown and expiry constants", () => {
    expect(RECOVERY_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000);
    expect(RECOVERY_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("reports the executable and expiry instants", () => {
    const state = recoveryState(makeRequest(), START);
    expect(Date.parse(state.executableAt)).toBe(START + RECOVERY_COOLDOWN_MS);
    expect(Date.parse(state.expiresAt)).toBe(START + RECOVERY_EXPIRY_MS);
  });
});

describe("isRecoveryActive", () => {
  it("blocks a second request while one is pending and in-window", () => {
    expect(isRecoveryActive(makeRequest(), START + 1000)).toBe(true);
  });

  it("stops blocking once the request lapses or settles", () => {
    expect(isRecoveryActive(makeRequest(), START + RECOVERY_EXPIRY_MS + 1)).toBe(false);
    expect(isRecoveryActive(makeRequest({ status: "cancelled" }), START)).toBe(false);
    expect(isRecoveryActive(makeRequest({ status: "executed" }), START)).toBe(false);
  });
});

describe("guardian checks", () => {
  it("recognises a guardian regardless of address casing", () => {
    const request = makeRequest();
    expect(isGuardianAddress(request, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(isGuardianAddress(request, "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")).toBe(true);
    expect(isGuardianAddress(request, "0x3333333333333333333333333333333333333333")).toBe(false);
  });

  it("does not let the same guardian approve twice", () => {
    const request = makeRequest();
    expect(hasApproved(request, "g-1")).toBe(true);
    expect(hasApproved(request, "g-2")).toBe(false);
  });
});

describe("recoveryBlockedReason", () => {
  it("names the missing approvals first", () => {
    const reason = recoveryBlockedReason(recoveryState(makeRequest(), START));
    expect(reason).toMatch(/1 more guardian approval/);
  });

  it("names the cooldown once approvals are in", () => {
    const request = makeRequest({ threshold: 1 });
    const reason = recoveryBlockedReason(recoveryState(request, START));
    expect(reason).toMatch(/24-hour safety delay/);
  });

  it("returns null when nothing blocks execution", () => {
    const request = makeRequest({ threshold: 1 });
    expect(recoveryBlockedReason(recoveryState(request, START + RECOVERY_COOLDOWN_MS))).toBeNull();
  });

  it("reports a lapsed request plainly", () => {
    const state = recoveryState(makeRequest(), START + RECOVERY_EXPIRY_MS + 1);
    expect(recoveryBlockedReason(state)).toMatch(/lapsed/);
  });
});
