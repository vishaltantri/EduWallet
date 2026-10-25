import { describe, expect, it } from "vitest";
import {
  institutionNameFor,
  ownsAddress,
  toPublicUser,
  walletHistory,
  type StoredUser,
} from "@/lib/models";
import { encryptForCustody } from "@/lib/crypto";

function makeUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: "u-1",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "student",
    passwordHash: "salt:hash",
    walletAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    encryptedPrivateKey: "deadbeef",
    iv: "0011",
    authTag: "2233",
    keySalt: "s",
    custody: encryptForCustody("0x01"),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toPublicUser", () => {
  it("never leaks key material or the password hash", () => {
    const serialised = JSON.stringify(toPublicUser(makeUser()));
    for (const secret of ["passwordHash", "encryptedPrivateKey", "custody", "keySalt", "authTag", "iv"]) {
      expect(serialised).not.toContain(secret);
    }
    expect(serialised).not.toContain("deadbeef");
    expect(serialised).not.toContain("salt:hash");
  });

  it("exposes exactly the fields the browser needs", () => {
    expect(Object.keys(toPublicUser(makeUser())).sort()).toEqual([
      "email",
      "id",
      "institutionName",
      "name",
      "role",
      "walletAddress",
    ]);
  });
});

describe("institutionNameFor", () => {
  it("is undefined for students", () => {
    expect(institutionNameFor(makeUser())).toBeUndefined();
  });

  it("uses the stored name when there is one", () => {
    const user = makeUser({ role: "university", institutionName: "  Example University  " });
    expect(institutionNameFor(user)).toBe("Example University");
  });

  it("falls back to a derived name for legacy institution accounts", () => {
    expect(institutionNameFor(makeUser({ role: "university" }))).toBe("Jane Smith's Institution");
    expect(institutionNameFor(makeUser({ role: "university", institutionName: "   " }))).toBe(
      "Jane Smith's Institution"
    );
  });
});

describe("wallet history", () => {
  it("lists the current address first, lowercased", () => {
    const user = makeUser({
      walletAddress: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      previousWalletAddresses: ["0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "0xaaaa".padEnd(42, "a")],
    });
    const history = walletHistory(user);
    expect(history[0]).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
    expect(history).toHaveLength(3);
    expect(history.every((address) => address === address.toLowerCase())).toBe(true);
  });

  it("recognises both current and previous addresses as owned", () => {
    const user = makeUser({
      walletAddress: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      previousWalletAddresses: ["0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    });

    expect(ownsAddress(user, "0xcccccccccccccccccccccccccccccccccccccccc")).toBe(true);
    expect(ownsAddress(user, "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")).toBe(true);
    expect(ownsAddress(user, " 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ")).toBe(true);
    expect(ownsAddress(user, "0x1111111111111111111111111111111111111111")).toBe(false);
  });

  it("handles an account that has never been recovered", () => {
    const user = makeUser();
    expect(walletHistory(user)).toHaveLength(1);
    expect(ownsAddress(user, user.walletAddress)).toBe(true);
  });
});
