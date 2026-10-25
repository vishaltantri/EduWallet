import { describe, expect, it } from "vitest";
import { Wallet, getBytes } from "ethers";
import { credentialHash } from "@/lib/credential";
import { resolveOutcome } from "@/lib/verification";
import type { StoredCredential } from "@/lib/models";

const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

function base(overrides: Partial<StoredCredential> = {}): StoredCredential {
  return {
    id: "cred-1",
    tokenId: 1,
    studentAddress: "0x8ba1f109551bD432803012645ac136c9A02b29e4",
    studentName: "Jane Smith",
    studentEmail: "jane@example.com",
    issuerAddress: wallet.address,
    issuerEmail: "registrar@uni.edu",
    degreeType: "Bachelor of Science",
    major: "Computer Science",
    institutionName: "Example University",
    ipfsHash: "QmExample",
    issuedAt: "2026-06-15T09:00:00.000Z",
    isValid: true,
    ...overrides,
  };
}

async function signed(overrides: Partial<StoredCredential> = {}) {
  const credential = base(overrides);
  const hash = credentialHash(credential);
  return {
    ...credential,
    credentialHash: hash,
    issuerSignature: await wallet.signMessage(getBytes(hash)),
  };
}

describe("resolveOutcome", () => {
  it("is valid for a signed, intact, unrevoked credential", async () => {
    expect(resolveOutcome(await signed())).toBe("valid");
  });

  it("is revoked for a signed credential that was withdrawn", async () => {
    const credential = await signed();
    expect(resolveOutcome({ ...credential, isValid: false })).toBe("revoked");
  });

  it("is tampered when the body no longer matches the signed hash", async () => {
    const credential = await signed();
    expect(resolveOutcome({ ...credential, major: "Astrophysics" })).toBe("tampered");
  });

  it("ranks tampering above revocation", async () => {
    // A forged-looking document is a different problem from an administrative
    // withdrawal, and the more serious answer has to win.
    const credential = await signed();
    expect(resolveOutcome({ ...credential, major: "Astrophysics", isValid: false })).toBe(
      "tampered"
    );
  });

  it("is tampered when the signature came from another wallet", async () => {
    const credential = base();
    const hash = credentialHash(credential);
    const impostor = Wallet.createRandom();
    expect(
      resolveOutcome({
        ...credential,
        credentialHash: hash,
        issuerSignature: await impostor.signMessage(getBytes(hash)),
      })
    ).toBe("tampered");
  });

  it("does not call an unsigned legacy credential tampered", () => {
    // There is nothing to compare it against, so the honest answers are
    // "valid" or "revoked" plus an explicit "not signed" flag in the UI.
    expect(resolveOutcome(base())).toBe("valid");
    expect(resolveOutcome(base({ isValid: false }))).toBe("revoked");
  });

  it("is unaffected by anchoring state", async () => {
    const credential = await signed();
    expect(resolveOutcome({ ...credential, anchored: false, anchorError: "RPC down" })).toBe(
      "valid"
    );
  });
});
