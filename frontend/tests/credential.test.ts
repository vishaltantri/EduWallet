import { describe, expect, it } from "vitest";
import { Wallet, getBytes } from "ethers";
import {
  canonicalPayload,
  checkIntegrity,
  credentialHash,
  signCredential,
  toVerifiableCredential,
} from "@/lib/credential";
import { encryptForCustody } from "@/lib/crypto";
import type { StoredCredential, StoredUser } from "@/lib/models";

const ISSUER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const issuerWallet = new Wallet(ISSUER_KEY);

function makeCredential(overrides: Partial<StoredCredential> = {}): StoredCredential {
  return {
    id: "cred-1",
    tokenId: 7,
    studentAddress: "0x8ba1f109551bD432803012645ac136c9A02b29e4",
    studentName: "Jane Smith",
    studentEmail: "Jane@Example.com",
    issuerAddress: issuerWallet.address,
    issuerEmail: "registrar@university.edu",
    degreeType: "Bachelor of Science",
    major: "Computer Science",
    institutionName: "Example University",
    ipfsHash: "QmExample",
    issuedAt: "2026-06-15T09:00:00.000Z",
    isValid: true,
    ...overrides,
  };
}

function makeIssuer(): StoredUser {
  return {
    id: "issuer-1",
    name: "Registrar",
    email: "registrar@university.edu",
    role: "university",
    institutionName: "Example University",
    passwordHash: "x:y",
    walletAddress: issuerWallet.address,
    encryptedPrivateKey: "",
    iv: "",
    authTag: "",
    custody: encryptForCustody(ISSUER_KEY),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("canonical payload", () => {
  it("is deterministic and field-ordered", () => {
    const credential = makeCredential();
    expect(canonicalPayload(credential)).toBe(canonicalPayload(credential));

    const keys = canonicalPayload(credential)
      .split("\n")
      .map((line) => line.split("=")[0]);
    expect(keys).toEqual([
      "tokenId",
      "studentAddress",
      "studentName",
      "studentEmail",
      "issuerAddress",
      "institutionName",
      "degreeType",
      "major",
      "grade",
      "completionDate",
      "ipfsHash",
      "issuedAt",
    ]);
  });

  it("normalises address and email case so a re-cased copy hashes the same", () => {
    const lower = makeCredential({
      studentAddress: "0x8ba1f109551bd432803012645ac136c9a02b29e4",
      studentEmail: "jane@example.com",
    });
    const upper = makeCredential({
      studentAddress: "0x8BA1F109551BD432803012645AC136C9A02B29E4",
      studentEmail: "JANE@EXAMPLE.COM",
    });
    expect(credentialHash(lower)).toBe(credentialHash(upper));
  });

  it("does not let optional fields collide with each other", () => {
    // "grade=A\ncompletionDate=" must not equal "grade=\ncompletionDate=A".
    const a = makeCredential({ grade: "A", completionDate: undefined });
    const b = makeCredential({ grade: undefined, completionDate: "A" });
    expect(credentialHash(a)).not.toBe(credentialHash(b));
  });

  it("changes the hash when any signed field changes", () => {
    const base = makeCredential();
    const baseline = credentialHash(base);

    const mutations: Partial<StoredCredential>[] = [
      { studentName: "Jane Smyth" },
      { major: "Computer Sciences" },
      { degreeType: "Master of Science" },
      { tokenId: 8 },
      { grade: "Second Class" },
      { completionDate: "2026-05-01" },
      { ipfsHash: "QmOther" },
      { issuedAt: "2026-06-15T09:00:01.000Z" },
      { institutionName: "Example Universityy" },
      { studentAddress: "0x0000000000000000000000000000000000000001" },
    ];

    for (const mutation of mutations) {
      expect(credentialHash(makeCredential(mutation))).not.toBe(baseline);
    }
  });

  it("ignores fields a verifier does not rely on", () => {
    const base = makeCredential();
    // Revocation and anchoring are checked separately, not through the hash —
    // otherwise revoking a certificate would make it read as tampered.
    expect(credentialHash(makeCredential({ isValid: false }))).toBe(credentialHash(base));
    expect(credentialHash(makeCredential({ txHash: "0xdead" }))).toBe(credentialHash(base));
    expect(credentialHash(makeCredential({ issuerEmail: "other@uni.edu" }))).toBe(
      credentialHash(base)
    );
  });
});

describe("signing and integrity", () => {
  it("signs with the issuer's custodied key and verifies", async () => {
    const credential = makeCredential();
    const signature = await signCredential(credential, makeIssuer());
    expect(signature).not.toBeNull();

    const signed = { ...credential, ...signature! };
    const report = checkIntegrity(signed);
    expect(report).toMatchObject({ signed: true, contentIntact: true, signatureValid: true });
    expect(report.recoveredSigner?.toLowerCase()).toBe(issuerWallet.address.toLowerCase());
  });

  it("returns null rather than a fake signature when the issuer has no custodied key", async () => {
    const issuer = makeIssuer();
    delete issuer.custody;
    expect(await signCredential(makeCredential(), issuer)).toBeNull();
  });

  it("reports an unsigned legacy credential as unsigned, not as valid", () => {
    const report = checkIntegrity(makeCredential());
    expect(report.signed).toBe(false);
    expect(report.signatureValid).toBe(false);
  });

  it("detects a credential edited after signing", async () => {
    const credential = makeCredential();
    const signature = await signCredential(credential, makeIssuer());
    const tampered = { ...credential, ...signature!, major: "Astrophysics" };

    const report = checkIntegrity(tampered);
    // The signature still recovers — it was a real signature over the old
    // hash — but the body no longer matches it.
    expect(report.signatureValid).toBe(true);
    expect(report.contentIntact).toBe(false);
  });

  it("detects a signature from the wrong wallet", async () => {
    const credential = makeCredential();
    const impostor = Wallet.createRandom();
    const hash = credentialHash(credential);
    const forged = {
      ...credential,
      credentialHash: hash,
      issuerSignature: await impostor.signMessage(getBytes(hash)),
    };

    const report = checkIntegrity(forged);
    expect(report.contentIntact).toBe(true);
    expect(report.signatureValid).toBe(false);
  });

  it("treats a garbage signature as invalid instead of throwing", () => {
    const credential = makeCredential();
    const report = checkIntegrity({
      ...credential,
      credentialHash: credentialHash(credential),
      issuerSignature: "0xnot-a-signature",
    });
    expect(report.signatureValid).toBe(false);
  });
});

describe("W3C verifiable credential export", () => {
  it("carries the signed facts, the proof, and the revocation status", async () => {
    const credential = makeCredential({ grade: "First Class", completionDate: "2026-05-30" });
    const signature = await signCredential(credential, makeIssuer());
    const document = toVerifiableCredential(
      { ...credential, ...signature! },
      { baseUrl: "https://eduwallet.example" }
    );

    expect(document.type).toContain("VerifiableCredential");
    expect(document.id).toBe("https://eduwallet.example/verify/cred-1");
    expect(document.issuer.name).toBe("Example University");
    expect(document.credentialStatus.status).toBe("active");
    expect(document.proof?.proofValue).toBe(signature!.issuerSignature);
    expect(document.proof?.messageHash).toBe(signature!.credentialHash);

    const subject = document.credentialSubject as Record<string, unknown>;
    expect(subject.name).toBe("Jane Smith");
  });

  it("omits the proof entirely for an unsigned credential", () => {
    const document = toVerifiableCredential(makeCredential(), { baseUrl: "https://x.test" });
    expect(document.proof).toBeUndefined();
  });

  it("withholds the holder's identity when anonymised", () => {
    const document = toVerifiableCredential(makeCredential(), {
      baseUrl: "https://x.test",
      anonymized: true,
    });
    const subject = document.credentialSubject as Record<string, unknown>;
    expect(subject.id).toBe("did:example:anonymous");
    expect(String(subject.name)).not.toContain("Jane");
  });

  it("reports a revoked credential's status and reason", () => {
    const document = toVerifiableCredential(
      makeCredential({
        isValid: false,
        revokedAt: "2026-07-01T00:00:00.000Z",
        revocationReason: "Awarded in error",
      }),
      { baseUrl: "https://x.test" }
    );
    expect(document.credentialStatus.status).toBe("revoked");
    expect(document.credentialStatus.statusReason).toBe("Awarded in error");
  });
});
