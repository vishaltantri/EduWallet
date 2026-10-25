/**
 * End-to-end backend journeys through the real route handlers.
 *
 * Nothing here is mocked except the environment: the working directory is
 * moved to a temporary folder before any module loads, so `lib/db` picks its
 * file backend and writes into throwaway JSON instead of the project's own
 * `data/`. Credentials are really hashed and signed, share links really
 * expire, and revocation really propagates to links already handed out.
 *
 * The chain and IPFS are deliberately left unconfigured, which is the
 * degraded path the deployed app has to survive — see the chain-enabled E2E
 * script for the anchored path.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Must happen before the storage layer is imported: it resolves its data
// directory from the working directory at module-load time.
const sandbox = mkdtempSync(join(tmpdir(), "eduwallet-test-"));
process.chdir(sandbox);
process.env.JWT_SECRET = "test-secret-for-integration-suite";
process.env.WALLET_MASTER_KEY = "test-master-key-for-integration-suite";
delete process.env.NEXT_PUBLIC_SOULBOUND_ADDRESS;
delete process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
delete process.env.NEXT_PUBLIC_RECOVERY_ADDRESS;
delete process.env.PINATA_JWT;
delete process.env.PLATFORM_PRIVATE_KEY;

/**
 * Route handlers vary in whether they take a dynamic-segment context, so the
 * registry stores them behind one shape and `params()` supplies the context
 * where a route needs it.
 */
type Handler = (request: Request, context?: never) => Promise<Response>;

function handler(fn: unknown): Handler {
  return fn as Handler;
}

const BASE = "https://eduwallet.test";

let routes: {
  register: Handler;
  login: Handler;
  me: Handler;
  password: Handler;
  walletExport: Handler;
  issue: Handler;
  bulk: Handler;
  issuerCredentials: Handler;
  studentCredentials: Handler;
  revoke: Handler;
  verify: Handler;
  verifyShare: Handler;
  shareList: Handler;
  shareCreate: Handler;
  shareRevoke: Handler;
  verifications: Handler;
  vc: Handler;
  profile: Handler;
  analytics: Handler;
  recoverySetup: Handler;
  recoverySetupGet: Handler;
  recoveryRequests: Handler;
  recoveryRequestsGet: Handler;
  recoveryApprove: Handler;
  recoveryExecute: Handler;
  recoveryCancel: Handler;
  status: Handler;
};

let stores: typeof import("@/lib/stores");

beforeAll(async () => {
  const [
    register,
    login,
    me,
    password,
    walletExport,
    issue,
    bulk,
    issuerCredentials,
    studentCredentials,
    revoke,
    verify,
    verifyShare,
    share,
    shareToken,
    verifications,
    vc,
    profile,
    analytics,
    recoverySetup,
    recoveryRequests,
    recoveryApprove,
    recoveryExecute,
    recoveryCancel,
    status,
  ] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/me/route"),
    import("@/app/api/auth/password/route"),
    import("@/app/api/auth/wallet-export/route"),
    import("@/app/api/credentials/issue/route"),
    import("@/app/api/credentials/bulk/route"),
    import("@/app/api/credentials/issuer/[address]/route"),
    import("@/app/api/credentials/student/[address]/route"),
    import("@/app/api/credentials/[id]/revoke/route"),
    import("@/app/api/verify/[id]/route"),
    import("@/app/api/verify/share/[token]/route"),
    import("@/app/api/share/route"),
    import("@/app/api/share/[token]/route"),
    import("@/app/api/credentials/[id]/verifications/route"),
    import("@/app/api/credentials/[id]/vc/route"),
    import("@/app/api/profile/[address]/route"),
    import("@/app/api/analytics/issuer/route"),
    import("@/app/api/recovery/setup/route"),
    import("@/app/api/recovery/requests/route"),
    import("@/app/api/recovery/requests/[id]/approve/route"),
    import("@/app/api/recovery/requests/[id]/execute/route"),
    import("@/app/api/recovery/requests/[id]/cancel/route"),
    import("@/app/api/system/status/route"),
  ]);

  routes = {
    register: handler(register.POST),
    login: handler(login.POST),
    me: handler(me.GET),
    password: handler(password.POST),
    walletExport: handler(walletExport.POST),
    issue: handler(issue.POST),
    bulk: handler(bulk.POST),
    issuerCredentials: handler(issuerCredentials.GET),
    studentCredentials: handler(studentCredentials.GET),
    revoke: handler(revoke.POST),
    verify: handler(verify.GET),
    verifyShare: handler(verifyShare.GET),
    shareList: handler(share.GET),
    shareCreate: handler(share.POST),
    shareRevoke: handler(shareToken.DELETE),
    verifications: handler(verifications.GET),
    vc: handler(vc.GET),
    profile: handler(profile.GET),
    analytics: handler(analytics.GET),
    recoverySetup: handler(recoverySetup.POST),
    recoverySetupGet: handler(recoverySetup.GET),
    recoveryRequests: handler(recoveryRequests.POST),
    recoveryRequestsGet: handler(recoveryRequests.GET),
    recoveryApprove: handler(recoveryApprove.POST),
    recoveryExecute: handler(recoveryExecute.POST),
    recoveryCancel: handler(recoveryCancel.POST),
    status: handler(status.GET),
  };

  stores = await import("@/lib/stores");
});

// ─── Request helpers ────────────────────────────────────────────────────────

function post(path: string, body: unknown, token?: string, headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function get(path: string, token?: string) {
  return new Request(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function del(path: string, token?: string) {
  return new Request(`${BASE}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Next.js hands dynamic segments in as a promise. */
function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) } as never;
}

async function json(response: Response) {
  return (await response.json()) as Record<string, never> & Record<string, unknown>;
}

let seq = 0;
function uniqueEmail(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}@example.com`;
}

/**
 * Registration is rate-limited per client IP, which is the point — so each
 * fixture account presents a distinct forwarded address instead of the suite
 * tripping the limiter on its own setup. The limiter itself is exercised
 * deliberately further down.
 */
function freshClientIp() {
  seq += 1;
  return `198.51.100.${seq % 250}`;
}

async function registerAccount(input: {
  role: "student" | "university";
  name?: string;
  email?: string;
  password?: string;
  institutionName?: string;
}) {
  const email = input.email ?? uniqueEmail(input.role);
  const response = await routes.register(
    post(
      "/api/auth/register",
      {
        name: input.name ?? "Test Person",
        email,
        password: input.password ?? "a-good-password",
        role: input.role,
        institutionName:
          input.role === "university" ? (input.institutionName ?? "Example University") : undefined,
      },
      undefined,
      { "x-forwarded-for": freshClientIp() }
    )
  );
  const body = await json(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  return {
    email,
    password: input.password ?? "a-good-password",
    token: body.token as string,
    user: body.user as { id: string; walletAddress: string; role: string; name: string },
  };
}

/** A wallet address no other fixture in this file has claimed. */
function freshAddress() {
  seq += 1;
  return `0x${seq.toString(16).padStart(40, "0")}`;
}

/**
 * Open a recovery request. Initiation is rate-limited per client IP, so each
 * call presents its own address; the limiter is covered separately.
 */
function openRequestFor(studentEmail: string, newAddress: string, guardianToken: string) {
  return routes.recoveryRequests(
    post("/api/recovery/requests", { studentEmail, newAddress }, guardianToken, {
      "x-forwarded-for": freshClientIp(),
    })
  );
}

async function issueTo(
  issuerToken: string,
  studentEmail: string,
  overrides: Record<string, unknown> = {}
) {
  const response = await routes.issue(
    post(
      "/api/credentials/issue",
      {
        studentEmail,
        studentName: "Jane Smith",
        degreeType: "Bachelor of Science",
        major: "Computer Science",
        ...overrides,
      },
      issuerToken
    )
  );
  const body = await json(response);
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body.credential as Record<string, unknown> & { id: string; tokenId: number };
}

// ─── Authentication ─────────────────────────────────────────────────────────

describe("registration and sign-in", () => {
  it("registers an account, returns a usable session, and never leaks key material", async () => {
    const account = await registerAccount({ role: "student", name: "Jane Smith" });

    expect(account.token.split(".")).toHaveLength(3);
    expect(account.user.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(JSON.stringify(account.user)).not.toMatch(/passwordHash|encryptedPrivateKey|custody/);

    const me = await json(await routes.me(get("/api/auth/me", account.token)));
    expect(me.user).toMatchObject({ email: account.email, role: "student" });
  });

  it("seals the wallet key twice and stores neither in the clear", async () => {
    const account = await registerAccount({ role: "student" });
    const stored = await stores.findUserByEmail(account.email);

    expect(stored?.encryptedPrivateKey).toBeTruthy();
    expect(stored?.encryptedPrivateKey).not.toMatch(/^0x/);
    expect(stored?.keySalt).toBeTruthy();
    expect(stored?.custody).toBeTruthy();
    expect(stored?.passwordHash).not.toContain("a-good-password");
  });

  it("rejects a duplicate email with a conflict", async () => {
    const account = await registerAccount({ role: "student" });
    const response = await routes.register(
      post(
        "/api/auth/register",
        {
          name: "Someone Else",
          email: account.email.toUpperCase(),
          password: "another-password",
          role: "student",
        },
        undefined,
        { "x-forwarded-for": freshClientIp() }
      )
    );
    expect(response.status).toBe(409);
  });

  it("validates registration input", async () => {
    const cases: [Record<string, unknown>, number, RegExp][] = [
      [{ name: "", email: "a@b.com", password: "longenough", role: "student" }, 400, /required/i],
      [{ name: "A", email: "not-an-email", password: "longenough", role: "student" }, 400, /valid email/i],
      [{ name: "A", email: "a@b.com", password: "short", role: "student" }, 400, /8 characters/i],
      [{ name: "A", email: "a@b.com", password: "longenough", role: "wizard" }, 400, /invalid role/i],
      [{ name: "A", email: "a@b.com", password: "longenough", role: "university" }, 400, /institution name/i],
    ];

    for (const [body, status, message] of cases) {
      const response = await routes.register(
        post("/api/auth/register", body, undefined, { "x-forwarded-for": freshClientIp() })
      );
      expect(response.status).toBe(status);
      expect(String((await json(response)).error)).toMatch(message);
    }
  });

  it("signs in with the right password and refuses the wrong one identically to an unknown email", async () => {
    const account = await registerAccount({ role: "student" });

    const good = await routes.login(
      post("/api/auth/login", { email: account.email, password: account.password })
    );
    expect(good.status).toBe(200);

    const wrongPassword = await routes.login(
      post("/api/auth/login", { email: account.email, password: "not-it" })
    );
    const unknownEmail = await routes.login(
      post("/api/auth/login", { email: "nobody@example.com", password: "not-it" })
    );

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Same message, so the endpoint does not disclose which accounts exist.
    expect((await json(wrongPassword)).error).toBe((await json(unknownEmail)).error);
  });

  it("rejects a missing, malformed, or forged session token", async () => {
    for (const token of [undefined, "", "garbage", "a.b.c"]) {
      const response = await routes.me(get("/api/auth/me", token));
      expect(response.status).toBe(401);
    }
  });

  it("rate-limits repeated sign-in attempts from one client", async () => {
    const account = await registerAccount({ role: "student" });
    const ip = "203.0.113.99";
    let sawLimit = false;

    for (let attempt = 0; attempt < 14; attempt++) {
      const response = await routes.login(
        post(
          "/api/auth/login",
          { email: account.email, password: "wrong-password" },
          undefined,
          { "x-forwarded-for": ip }
        )
      );
      if (response.status === 429) {
        expect(response.headers.get("Retry-After")).toBeTruthy();
        sawLimit = true;
        break;
      }
    }
    expect(sawLimit).toBe(true);

    // A different client is unaffected by that client's budget.
    const other = await routes.login(
      post(
        "/api/auth/login",
        { email: account.email, password: account.password },
        undefined,
        { "x-forwarded-for": "203.0.113.100" }
      )
    );
    expect(other.status).toBe(200);
  });

  it("rate-limits account creation from one client", async () => {
    const ip = "203.0.113.50";
    let sawLimit = false;

    for (let attempt = 0; attempt < 25; attempt++) {
      const response = await routes.register(
        post(
          "/api/auth/register",
          {
            name: "Flood",
            email: uniqueEmail("flood"),
            password: "a-good-password",
            role: "student",
          },
          undefined,
          { "x-forwarded-for": ip }
        )
      );
      if (response.status === 429) {
        sawLimit = true;
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });

  it("records the last sign-in time", async () => {
    const account = await registerAccount({ role: "student" });
    expect((await stores.findUserByEmail(account.email))?.lastLoginAt).toBeUndefined();

    await routes.login(post("/api/auth/login", { email: account.email, password: account.password }));
    expect((await stores.findUserByEmail(account.email))?.lastLoginAt).toBeTruthy();
  });
});

describe("password change", () => {
  it("changes the password and re-seals the wallet so export still works", async () => {
    const account = await registerAccount({ role: "student" });
    const before = await stores.findUserByEmail(account.email);

    const response = await routes.password(
      post(
        "/api/auth/password",
        { currentPassword: account.password, newPassword: "a-brand-new-password" },
        account.token
      )
    );
    expect(response.status, JSON.stringify(await json(response.clone()))).toBe(200);

    // Old password no longer signs in; the new one does.
    expect(
      (await routes.login(post("/api/auth/login", { email: account.email, password: account.password })))
        .status
    ).toBe(401);
    const relogin = await routes.login(
      post("/api/auth/login", { email: account.email, password: "a-brand-new-password" })
    );
    expect(relogin.status).toBe(200);

    // The wallet is still the same wallet, and still openable.
    const after = await stores.findUserByEmail(account.email);
    expect(after?.walletAddress).toBe(before?.walletAddress);
    expect(after?.keySalt).not.toBe(before?.keySalt);

    const exported = await routes.walletExport(
      post(
        "/api/auth/wallet-export",
        { password: "a-brand-new-password" },
        (await json(relogin)).token as string
      )
    );
    const exportBody = await json(exported);
    expect(exported.status).toBe(200);
    expect(exportBody.walletAddress).toBe(before?.walletAddress);
  });

  it("refuses the change without the correct current password", async () => {
    const account = await registerAccount({ role: "student" });
    const response = await routes.password(
      post(
        "/api/auth/password",
        { currentPassword: "wrong-password", newPassword: "a-brand-new-password" },
        account.token
      )
    );
    expect(response.status).toBe(401);
    // The old password still works, so nothing was half-applied.
    expect(
      (await routes.login(post("/api/auth/login", { email: account.email, password: account.password })))
        .status
    ).toBe(200);
  });

  it("validates the new password", async () => {
    const account = await registerAccount({ role: "student" });

    const tooShort = await routes.password(
      post("/api/auth/password", { currentPassword: account.password, newPassword: "short" }, account.token)
    );
    expect(tooShort.status).toBe(400);

    const unchanged = await routes.password(
      post(
        "/api/auth/password",
        { currentPassword: account.password, newPassword: account.password },
        account.token
      )
    );
    expect(unchanged.status).toBe(400);
    expect(String((await json(unchanged)).error)).toMatch(/different/i);
  });

  it("requires a session", async () => {
    const response = await routes.password(
      post("/api/auth/password", { currentPassword: "x", newPassword: "yyyyyyyy" })
    );
    expect(response.status).toBe(401);
  });
});

describe("wallet export", () => {
  it("hands the holder their own key and nobody else's", async () => {
    const account = await registerAccount({ role: "student" });

    const response = await routes.walletExport(
      post("/api/auth/wallet-export", { password: account.password }, account.token)
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(String(body.privateKey)).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(body.walletAddress).toBe(account.user.walletAddress);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("refuses without the password, and with the wrong one", async () => {
    const account = await registerAccount({ role: "student" });
    expect((await routes.walletExport(post("/api/auth/wallet-export", {}, account.token))).status).toBe(
      400
    );
    expect(
      (await routes.walletExport(post("/api/auth/wallet-export", { password: "nope" }, account.token)))
        .status
    ).toBe(401);
  });
});

// ─── Issuance ───────────────────────────────────────────────────────────────

describe("issuance", () => {
  it("issues a signed certificate to a registered student", async () => {
    const issuer = await registerAccount({ role: "university", institutionName: "Example University" });
    const student = await registerAccount({ role: "student" });

    const credential = await issueTo(issuer.token, student.email, { grade: "First Class" });

    expect(credential.studentAddress).toBe(student.user.walletAddress);
    expect(credential.issuerAddress).toBe(issuer.user.walletAddress);
    expect(credential.institutionName).toBe("Example University");
    expect(credential.credentialHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(credential.issuerSignature).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(credential.isValid).toBe(true);
    // No chain configured in this environment, and the response says so
    // rather than implying the certificate was anchored.
    expect(credential.anchored).toBe(false);
    expect(String(credential.anchorError)).toMatch(/not configured/i);
  });

  it("falls back to a local metadata digest when IPFS is unavailable", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    expect(String(credential.ipfsHash)).toMatch(/^local-/);
  });

  it("allocates increasing, unique token ids", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });

    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push((await issueTo(issuer.token, student.email)).tokenId);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it("refuses a student account, an unknown student, and an unauthenticated caller", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const otherInstitution = await registerAccount({ role: "university" });

    const unknown = await routes.issue(
      post(
        "/api/credentials/issue",
        {
          studentEmail: "nobody@example.com",
          studentName: "Nobody",
          degreeType: "Diploma",
          major: "Design",
        },
        issuer.token
      )
    );
    expect(unknown.status).toBe(404);

    const toInstitution = await routes.issue(
      post(
        "/api/credentials/issue",
        {
          studentEmail: otherInstitution.email,
          studentName: "An Institution",
          degreeType: "Diploma",
          major: "Design",
        },
        issuer.token
      )
    );
    expect(toInstitution.status).toBe(400);

    const byStudent = await routes.issue(
      post(
        "/api/credentials/issue",
        {
          studentEmail: student.email,
          studentName: "Jane",
          degreeType: "Diploma",
          major: "Design",
        },
        student.token
      )
    );
    expect(byStudent.status).toBe(403);

    const anonymous = await routes.issue(
      post("/api/credentials/issue", { studentEmail: student.email })
    );
    expect(anonymous.status).toBe(401);
  });

  it("rejects invalid issuance input", async () => {
    const issuer = await registerAccount({ role: "university" });
    const response = await routes.issue(
      post("/api/credentials/issue", { studentEmail: "", studentName: "" }, issuer.token)
    );
    expect(response.status).toBe(400);
  });
});

describe("bulk issuance", () => {
  it("validates without issuing on a dry run", async () => {
    const issuer = await registerAccount({ role: "university" });
    const a = await registerAccount({ role: "student" });

    const csv = [
      "email,name,degree,major",
      `${a.email},Student A,Diploma,Design`,
      "broken,Student B,Diploma,Design",
    ].join("\n");

    const response = await routes.bulk(post("/api/credentials/bulk", { csv, dryRun: true }, issuer.token));
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.parsed).toBe(1);
    expect(body.errors).toHaveLength(1);

    const issued = await json(
      await routes.issuerCredentials(
        get(`/api/credentials/issuer/${issuer.user.walletAddress}`, issuer.token),
        params({ address: issuer.user.walletAddress })
      )
    );
    expect(issued.credentials).toHaveLength(0);
  });

  it("issues the good rows and reports each failure separately", async () => {
    const issuer = await registerAccount({ role: "university" });
    const a = await registerAccount({ role: "student" });
    const b = await registerAccount({ role: "student" });

    const csv = [
      "email,name,degree,major,grade",
      `${a.email},Student A,Bachelor of Science,Design,A`,
      `${b.email},Student B,Diploma,Design,B`,
      "ghost@example.com,Ghost,Diploma,Design,C",
      "bad-email,Bad Row,Diploma,Design,D",
    ].join("\n");

    const body = await json(await routes.bulk(post("/api/credentials/bulk", { csv }, issuer.token)));

    expect(body.issued).toHaveLength(2);
    const failed = body.failed as { email: string; reason: string }[];
    expect(failed).toHaveLength(2);
    expect(failed.some((entry) => entry.email === "ghost@example.com")).toBe(true);
    expect(failed.some((entry) => /Row 5/.test(entry.reason))).toBe(true);
  });

  it("refuses an empty payload, a student caller, and an over-long upload", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });

    expect((await routes.bulk(post("/api/credentials/bulk", { csv: "  " }, issuer.token))).status).toBe(
      400
    );
    expect((await routes.bulk(post("/api/credentials/bulk", { csv: "x" }, student.token))).status).toBe(
      403
    );

    const huge = [
      "email,name,degree,major",
      ...Array.from({ length: 101 }, (_, i) => `s${i}@example.com,S,Diploma,Design`),
    ].join("\n");
    const response = await routes.bulk(post("/api/credentials/bulk", { csv: huge }, issuer.token));
    expect(response.status).toBe(400);
    expect(String((await json(response)).error)).toMatch(/100 rows/);
  });
});

// ─── Verification ───────────────────────────────────────────────────────────

describe("public verification", () => {
  it("reports the three checks and logs the visit", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const first = await json(
      await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }))
    );

    expect(first.outcome).toBe("valid");
    expect(first.integrity).toMatchObject({ signed: true, contentIntact: true, signatureValid: true });
    expect(first.anchor).toMatchObject({ anchored: false });
    // The count excludes the caller's own visit.
    expect(first.priorVerifications).toBe(0);

    const second = await json(
      await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }))
    );
    expect(second.priorVerifications).toBe(1);
  });

  it("returns a 404 outcome for an unknown credential", async () => {
    const response = await routes.verify(
      get("/api/verify/does-not-exist"),
      params({ id: "does-not-exist" })
    );
    expect(response.status).toBe(404);
    expect((await json(response)).outcome).toBe("not_found");
  });

  it("reports tampering rather than showing a valid-looking certificate", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    // Edit the stored record behind the signature's back.
    await stores.updateCredential(credential.id, { major: "Astrophysics" });

    const body = await json(
      await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }))
    );
    expect(body.outcome).toBe("tampered");
    expect(body.isValid).toBe(false);
    expect((body.integrity as Record<string, unknown>).contentIntact).toBe(false);
  });

  it("never caches a verification response", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const response = await routes.verify(
      get(`/api/verify/${credential.id}`),
      params({ id: credential.id })
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ─── Revocation ─────────────────────────────────────────────────────────────

describe("revocation", () => {
  it("withdraws the certificate with a reason and keeps the signature intact", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const response = await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "Awarded in error" }, issuer.token),
      params({ id: credential.id })
    );
    expect(response.status).toBe(200);

    const verified = await json(
      await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }))
    );
    expect(verified.outcome).toBe("revoked");
    expect(verified.revocationReason).toBe("Awarded in error");
    // Still a genuine document: the signature is preserved, not erased.
    expect((verified.integrity as Record<string, unknown>).signatureValid).toBe(true);
  });

  it("requires a reason", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const response = await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "   " }, issuer.token),
      params({ id: credential.id })
    );
    expect(response.status).toBe(400);
  });

  it("lets only the issuing institution revoke", async () => {
    const issuer = await registerAccount({ role: "university" });
    const other = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const byOther = await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "Mine now" }, other.token),
      params({ id: credential.id })
    );
    expect(byOther.status).toBe(403);

    const byStudent = await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "No thanks" }, student.token),
      params({ id: credential.id })
    );
    expect(byStudent.status).toBe(403);
  });

  it("refuses to revoke twice", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "First" }, issuer.token),
      params({ id: credential.id })
    );
    const again = await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "Second" }, issuer.token),
      params({ id: credential.id })
    );
    expect(again.status).toBe(409);
  });

  it("404s for a credential that does not exist", async () => {
    const issuer = await registerAccount({ role: "university" });
    const response = await routes.revoke(
      post("/api/credentials/nope/revoke", { reason: "x" }, issuer.token),
      params({ id: "nope" })
    );
    expect(response.status).toBe(404);
  });
});

// ─── Share links ────────────────────────────────────────────────────────────

describe("share links", () => {
  it("mints an expiring link that resolves and counts views", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(
        post(
          "/api/share",
          { credentialId: credential.id, label: "Acme Corp", expiry: "7d" },
          student.token
        )
      )
    );
    const link = created.link as { token: string; url: string; expiresAt: string };
    expect(link.url).toContain(`/verify/share/${link.token}`);
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());

    const viewed = await json(
      await routes.verifyShare(
        get(`/api/verify/share/${link.token}`),
        params({ token: link.token })
      )
    );
    expect(viewed.outcome).toBe("valid");
    expect(viewed.studentName).toBe("Jane Smith");
    expect((viewed.shareLink as Record<string, unknown>).label).toBe("Acme Corp");

    const listed = await json(await routes.shareList(get("/api/share", student.token)));
    const own = (listed.links as { token: string; viewCount: number; active: boolean }[]).find(
      (item) => item.token === link.token
    );
    expect(own?.viewCount).toBe(1);
    expect(own?.active).toBe(true);
  });

  it("withholds the holder's identity on an anonymised link", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(
        post("/api/share", { credentialId: credential.id, anonymized: true }, student.token)
      )
    );
    const token = (created.link as { token: string }).token;

    const viewed = await json(
      await routes.verifyShare(get(`/api/verify/share/${token}`), params({ token }))
    );

    expect(viewed.anonymized).toBe(true);
    expect(String(viewed.studentName)).not.toContain("Jane");
    expect(String(viewed.studentAddress)).not.toBe(student.user.walletAddress);
    // The qualification itself is still proven.
    expect(viewed.degreeType).toBe("Bachelor of Science");
    expect(viewed.institutionName).toBeTruthy();
    expect((viewed.integrity as Record<string, unknown>).signatureValid).toBe(true);
  });

  it("stops working once revoked by the holder", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(post("/api/share", { credentialId: credential.id }, student.token))
    );
    const token = (created.link as { token: string }).token;

    await routes.shareRevoke(del(`/api/share/${token}`, student.token), params({ token }));

    const response = await routes.verifyShare(
      get(`/api/verify/share/${token}`),
      params({ token })
    );
    expect(response.status).toBe(410);
    expect(String((await json(response)).error)).toMatch(/revoked/i);
  });

  it("stops working once it expires", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(post("/api/share", { credentialId: credential.id }, student.token))
    );
    const token = (created.link as { token: string }).token;

    await stores.updateShareLink(token, { expiresAt: new Date(Date.now() - 1000).toISOString() });

    const response = await routes.verifyShare(get(`/api/verify/share/${token}`), params({ token }));
    expect(response.status).toBe(410);
    expect((await json(response)).expired).toBe(true);
  });

  it("shows an already-shared link as withdrawn once the certificate is revoked", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(post("/api/share", { credentialId: credential.id }, student.token))
    );
    const token = (created.link as { token: string }).token;

    await routes.revoke(
      post(`/api/credentials/${credential.id}/revoke`, { reason: "Plagiarism finding" }, issuer.token),
      params({ id: credential.id })
    );

    const viewed = await json(
      await routes.verifyShare(get(`/api/verify/share/${token}`), params({ token }))
    );
    expect(viewed.outcome).toBe("revoked");
    expect(viewed.revocationReason).toBe("Plagiarism finding");
  });

  it("lets only the credential holder mint a link, and only for their own credential", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const stranger = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    expect(
      (await routes.shareCreate(post("/api/share", { credentialId: credential.id }, stranger.token)))
        .status
    ).toBe(403);
    expect(
      (await routes.shareCreate(post("/api/share", { credentialId: credential.id }))).status
    ).toBe(401);
    expect(
      (await routes.shareCreate(post("/api/share", { credentialId: "nope" }, student.token))).status
    ).toBe(404);
    expect((await routes.shareCreate(post("/api/share", {}, student.token))).status).toBe(400);
  });

  it("lets only the owner revoke a link", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const stranger = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const created = await json(
      await routes.shareCreate(post("/api/share", { credentialId: credential.id }, student.token))
    );
    const token = (created.link as { token: string }).token;

    expect(
      (await routes.shareRevoke(del(`/api/share/${token}`, stranger.token), params({ token }))).status
    ).toBe(403);
    expect(
      (await routes.shareRevoke(del("/api/share/missing", student.token), params({ token: "missing" })))
        .status
    ).toBe(404);
  });

  it("404s an unknown share token", async () => {
    const response = await routes.verifyShare(
      get("/api/verify/share/nope"),
      params({ token: "nope" })
    );
    expect(response.status).toBe(404);
  });
});

// ─── Credential listings and exports ────────────────────────────────────────

describe("credential listings", () => {
  it("returns a student their own credentials with integrity and verification counts", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }));

    const body = await json(
      await routes.studentCredentials(
        get(`/api/credentials/student/${student.user.walletAddress}`, student.token),
        params({ address: student.user.walletAddress })
      )
    );

    const list = body.credentials as Record<string, unknown>[];
    expect(list).toHaveLength(1);
    expect((list[0].integrity as Record<string, unknown>).signatureValid).toBe(true);
    expect(list[0].verificationCount).toBe(1);
  });

  it("stops a student reading another student's credentials", async () => {
    const student = await registerAccount({ role: "student" });
    const other = await registerAccount({ role: "student" });

    const response = await routes.studentCredentials(
      get(`/api/credentials/student/${other.user.walletAddress}`, student.token),
      params({ address: other.user.walletAddress })
    );
    expect(response.status).toBe(403);
  });

  it("stops an institution reading another institution's issuance list", async () => {
    const issuer = await registerAccount({ role: "university" });
    const other = await registerAccount({ role: "university" });

    const response = await routes.issuerCredentials(
      get(`/api/credentials/issuer/${other.user.walletAddress}`, issuer.token),
      params({ address: other.user.walletAddress })
    );
    expect(response.status).toBe(403);

    const byStudent = await routes.issuerCredentials(
      get(`/api/credentials/issuer/${issuer.user.walletAddress}`, (await registerAccount({ role: "student" })).token),
      params({ address: issuer.user.walletAddress })
    );
    expect(byStudent.status).toBe(403);
  });

  it("shows the verification log to the holder and the issuer only", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const stranger = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }));

    for (const token of [student.token, issuer.token]) {
      const body = await json(
        await routes.verifications(
          get(`/api/credentials/${credential.id}/verifications`, token),
          params({ id: credential.id })
        )
      );
      expect(body.total).toBe(1);
      // A coarse origin label, never a raw IP.
      expect((body.events as { origin: string }[])[0].origin).toBe("Unknown location");
    }

    expect(
      (
        await routes.verifications(
          get(`/api/credentials/${credential.id}/verifications`, stranger.token),
          params({ id: credential.id })
        )
      ).status
    ).toBe(403);
  });

  it("exports a downloadable W3C verifiable credential", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });
    const credential = await issueTo(issuer.token, student.email);

    const response = await routes.vc(
      get(`/api/credentials/${credential.id}/vc`, student.token),
      params({ id: credential.id })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/ld+json");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");

    const document = JSON.parse(await response.text());
    expect(document.type).toContain("VerifiableCredential");
    expect(document.proof.proofValue).toBe(credential.issuerSignature);
  });
});

describe("public profile", () => {
  it("lists only active, verifiable credentials and never the holder's email", async () => {
    const issuer = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student", name: "Jane Smith" });

    const keep = await issueTo(issuer.token, student.email, { major: "Computer Science" });
    const revoked = await issueTo(issuer.token, student.email, { major: "Physics" });
    const tampered = await issueTo(issuer.token, student.email, { major: "Chemistry" });

    await routes.revoke(
      post(`/api/credentials/${revoked.id}/revoke`, { reason: "Withdrawn" }, issuer.token),
      params({ id: revoked.id })
    );
    await stores.updateCredential(tampered.id, { major: "Biochemistry" });

    const response = await routes.profile(
      get(`/api/profile/${student.user.walletAddress}`),
      params({ address: student.user.walletAddress })
    );
    const body = await json(response);

    const majors = (body.credentials as { major: string }[]).map((item) => item.major);
    expect(majors).toEqual(["Computer Science"]);
    expect(majors).not.toContain("Physics");
    expect(majors).not.toContain("Biochemistry");
    expect(JSON.stringify(body)).not.toContain(student.email);
    expect((body.holder as Record<string, unknown>).name).toBe("Jane Smith");
    expect(keep.id).toBeTruthy();
  });

  it("rejects a malformed address and 404s an address with no holder", async () => {
    expect(
      (await routes.profile(get("/api/profile/not-an-address"), params({ address: "not-an-address" })))
        .status
    ).toBe(400);
    expect(
      (
        await routes.profile(
          get("/api/profile/0x0000000000000000000000000000000000000001"),
          params({ address: "0x0000000000000000000000000000000000000001" })
        )
      ).status
    ).toBe(404);
  });

  it("does not expose an institution wallet as a credential profile", async () => {
    const issuer = await registerAccount({ role: "university" });
    const response = await routes.profile(
      get(`/api/profile/${issuer.user.walletAddress}`),
      params({ address: issuer.user.walletAddress })
    );
    expect(response.status).toBe(404);
  });
});

describe("issuer analytics", () => {
  it("counts only this institution's own certificates and verifications", async () => {
    const issuer = await registerAccount({ role: "university" });
    const other = await registerAccount({ role: "university" });
    const student = await registerAccount({ role: "student" });

    const mine = await issueTo(issuer.token, student.email, { degreeType: "Bachelor of Science" });
    await issueTo(issuer.token, student.email, { degreeType: "Bachelor of Science" });
    const revoked = await issueTo(issuer.token, student.email, { degreeType: "Diploma" });
    await issueTo(other.token, student.email, { degreeType: "Master of Arts" });

    await routes.revoke(
      post(`/api/credentials/${revoked.id}/revoke`, { reason: "Error" }, issuer.token),
      params({ id: revoked.id })
    );
    await routes.verify(get(`/api/verify/${mine.id}`), params({ id: mine.id }));
    await routes.verify(get(`/api/verify/${mine.id}`), params({ id: mine.id }));

    const body = await json(await routes.analytics(get("/api/analytics/issuer", issuer.token)));
    const totals = body.totals as Record<string, number>;

    expect(totals.issued).toBe(3);
    expect(totals.active).toBe(2);
    expect(totals.revoked).toBe(1);
    expect(totals.signed).toBe(3);
    expect(totals.anchored).toBe(0);
    expect(totals.verifications).toBe(2);
    expect(totals.uniqueStudents).toBe(1);

    const mix = body.degreeMix as { degreeType: string; count: number }[];
    expect(mix.find((entry) => entry.degreeType === "Bachelor of Science")?.count).toBe(2);
    expect(mix.some((entry) => entry.degreeType === "Master of Arts")).toBe(false);

    const months = body.issuanceByMonth as { issued: number }[];
    expect(months).toHaveLength(6);
    expect(months[months.length - 1].issued).toBe(3);

    const mostVerified = body.mostVerified as { id: string; verifications: number }[];
    expect(mostVerified[0]).toMatchObject({ id: mine.id, verifications: 2 });
  });

  it("is closed to students and to anonymous callers", async () => {
    const student = await registerAccount({ role: "student" });
    expect((await routes.analytics(get("/api/analytics/issuer", student.token))).status).toBe(403);
    expect((await routes.analytics(get("/api/analytics/issuer"))).status).toBe(401);
  });
});

// ─── Social recovery ────────────────────────────────────────────────────────

describe("recovery guardian configuration", () => {
  it("saves a guardian set and reads it back with institution names", async () => {
    const student = await registerAccount({ role: "student" });
    const g1 = await registerAccount({ role: "university", institutionName: "First University" });
    const g2 = await registerAccount({ role: "university", institutionName: "Second University" });

    const response = await routes.recoverySetup(
      post("/api/recovery/setup", { guardianEmails: [g1.email, g2.email], threshold: 2 }, student.token)
    );
    expect(response.status, JSON.stringify(await json(response.clone()))).toBe(200);

    const body = await json(await routes.recoverySetupGet(get("/api/recovery/setup", student.token)));
    const configuration = body.configuration as {
      threshold: number;
      guardians: { email: string; institutionName: string }[];
    };
    expect(configuration.threshold).toBe(2);
    expect(configuration.guardians.map((guardian) => guardian.institutionName)).toEqual([
      "First University",
      "Second University",
    ]);
  });

  it("validates the guardian set", async () => {
    const student = await registerAccount({ role: "student" });
    const g1 = await registerAccount({ role: "university" });
    const g2 = await registerAccount({ role: "university" });
    const otherStudent = await registerAccount({ role: "student" });

    const cases: [unknown, number, RegExp][] = [
      [{ guardianEmails: [g1.email], threshold: 2 }, 400, /2 guardians/i],
      [
        { guardianEmails: Array.from({ length: 6 }, (_, i) => `g${i}@example.com`), threshold: 2 },
        400,
        /Maximum 5/i,
      ],
      [{ guardianEmails: [g1.email, g2.email], threshold: 1 }, 400, /between 2/i],
      [{ guardianEmails: [g1.email, g2.email], threshold: 3 }, 400, /between 2/i],
      [{ guardianEmails: [g1.email, g1.email], threshold: 2 }, 400, /only be added once/i],
      [{ guardianEmails: [g1.email, "nope"], threshold: 2 }, 400, /valid email/i],
      [{ guardianEmails: [g1.email, student.email], threshold: 2 }, 400, /your own guardian/i],
      [{ guardianEmails: [g1.email, otherStudent.email], threshold: 2 }, 400, /not an institution/i],
      [{ guardianEmails: [g1.email, "ghost@example.com"], threshold: 2 }, 404, /not found/i],
    ];

    for (const [body, status, message] of cases) {
      const response = await routes.recoverySetup(post("/api/recovery/setup", body, student.token));
      expect(response.status, JSON.stringify(await json(response.clone()))).toBe(status);
      expect(String((await json(response)).error)).toMatch(message);
    }
  });

  it("is closed to institutions", async () => {
    const institution = await registerAccount({ role: "university" });
    const response = await routes.recoverySetup(
      post("/api/recovery/setup", { guardianEmails: ["a@b.com", "c@d.com"], threshold: 2 }, institution.token)
    );
    expect(response.status).toBe(403);
  });
});

describe("recovery lifecycle", () => {
  async function setupGuardians(threshold = 2) {
    const student = await registerAccount({ role: "student", name: "Jane Smith" });
    const g1 = await registerAccount({ role: "university", institutionName: "First University" });
    const g2 = await registerAccount({ role: "university", institutionName: "Second University" });
    const g3 = await registerAccount({ role: "university", institutionName: "Third University" });

    const response = await routes.recoverySetup(
      post(
        "/api/recovery/setup",
        { guardianEmails: [g1.email, g2.email, g3.email], threshold },
        student.token
      )
    );
    expect(response.status).toBe(200);
    return { student, g1, g2, g3 };
  }

  // A per-call fresh address: an earlier test's migration would otherwise
  // make a later test's destination "already in use".
  const nextAddress = () => freshAddress();

  it("runs the full guardian-initiated migration and keeps old credentials resolvable", async () => {
    const issuer = await registerAccount({ role: "university" });
    const { student, g1, g2 } = await setupGuardians(2);
    const credential = await issueTo(issuer.token, student.email);
    const originalAddress = student.user.walletAddress;
    const destination = nextAddress();

    // 1. A guardian opens the request; that counts as the first approval.
    const opened = await json(await openRequestFor(student.email, destination, g1.token));
    const request = opened.request as { id: string; state: Record<string, unknown> };
    expect(request.state.approvals).toBe(1);
    expect(request.state.thresholdMet).toBe(false);

    // 2. Too early: neither the threshold nor the delay is satisfied.
    const premature = await routes.recoveryExecute(
      post(`/api/recovery/requests/${request.id}/execute`, {}, g1.token),
      params({ id: request.id })
    );
    expect(premature.status).toBe(409);

    // 3. A second guardian approves, meeting the threshold.
    const approved = await json(
      await routes.recoveryApprove(
        post(`/api/recovery/requests/${request.id}/approve`, {}, g2.token),
        params({ id: request.id })
      )
    );
    expect((approved.request as { state: Record<string, unknown> }).state.thresholdMet).toBe(true);

    // 4. Still blocked by the 24-hour delay.
    const inCooldown = await routes.recoveryExecute(
      post(`/api/recovery/requests/${request.id}/execute`, {}, g2.token),
      params({ id: request.id })
    );
    expect(inCooldown.status).toBe(409);
    expect(String((await json(inCooldown)).error)).toMatch(/24-hour/);

    // 5. Wind the request's clock back past the cooldown.
    await stores.updateRecoveryRequest(request.id, {
      initiatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });

    const executed = await routes.recoveryExecute(
      post(`/api/recovery/requests/${request.id}/execute`, {}, g2.token),
      params({ id: request.id })
    );
    const executedBody = await json(executed);
    expect(executed.status, JSON.stringify(executedBody)).toBe(200);
    expect(executedBody.migratedTo).toBe(destination);

    // 6. The account now holds the new address, and remembers the old one.
    const migrated = await stores.findUserByEmail(student.email);
    expect(migrated?.walletAddress).toBe(destination);
    expect(migrated?.previousWalletAddresses).toEqual([originalAddress]);
    expect(migrated?.custody).toBeUndefined();
    expect(migrated?.keyWalletAddress).toBe(originalAddress);

    // 7. The certificate still verifies — its signature covers the original
    //    address, so recovery must not rewrite or orphan it.
    const verified = await json(
      await routes.verify(get(`/api/verify/${credential.id}`), params({ id: credential.id }))
    );
    expect(verified.outcome).toBe("valid");
    expect(verified.studentAddress).toBe(originalAddress);

    // 8. The dashboard, asking under the new address, still finds it.
    const listed = await json(
      await routes.studentCredentials(
        get(`/api/credentials/student/${destination}`, student.token),
        params({ address: destination })
      )
    );
    expect((listed.credentials as unknown[]).length).toBe(1);

    // 9. Public profile links keep working under both addresses.
    for (const address of [destination, originalAddress]) {
      const profile = await routes.profile(
        get(`/api/profile/${address}`),
        params({ address })
      );
      expect(profile.status).toBe(200);
      expect(((await json(profile)).credentials as unknown[]).length).toBe(1);
    }
  });

  it("lets the account holder cancel during the delay", async () => {
    const { student, g1 } = await setupGuardians(2);

    const opened = await json(
      await openRequestFor(student.email, nextAddress(), g1.token)
    );
    const id = (opened.request as { id: string }).id;

    // The student can see it, which is what makes cancelling possible.
    const visible = await json(await routes.recoveryRequestsGet(get("/api/recovery/requests", student.token)));
    expect((visible.requests as { id: string }[])[0].id).toBe(id);

    const cancelled = await routes.recoveryCancel(
      post(`/api/recovery/requests/${id}/cancel`, {}, student.token),
      params({ id })
    );
    expect(cancelled.status).toBe(200);

    // A cancelled request can no longer be approved or executed.
    expect(
      (await routes.recoveryApprove(post(`/api/recovery/requests/${id}/approve`, {}, g1.token), params({ id })))
        .status
    ).toBe(409);
    expect(
      (await routes.recoveryExecute(post(`/api/recovery/requests/${id}/execute`, {}, g1.token), params({ id })))
        .status
    ).toBe(409);

    expect((await stores.findUserByEmail(student.email))?.walletAddress).toBe(
      student.user.walletAddress
    );
  });

  it("will not let a guardian cancel, nor a stranger approve or execute", async () => {
    const { student, g1 } = await setupGuardians(2);
    const outsider = await registerAccount({ role: "university" });

    const opened = await json(
      await openRequestFor(student.email, nextAddress(), g1.token)
    );
    const id = (opened.request as { id: string }).id;

    expect(
      (await routes.recoveryCancel(post(`/api/recovery/requests/${id}/cancel`, {}, g1.token), params({ id })))
        .status
    ).toBe(403);
    expect(
      (
        await routes.recoveryApprove(
          post(`/api/recovery/requests/${id}/approve`, {}, outsider.token),
          params({ id })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await routes.recoveryExecute(
          post(`/api/recovery/requests/${id}/execute`, {}, outsider.token),
          params({ id })
        )
      ).status
    ).toBe(403);
  });

  it("does not let the same guardian approve twice", async () => {
    const { student, g1 } = await setupGuardians(3);

    const opened = await json(
      await openRequestFor(student.email, nextAddress(), g1.token)
    );
    const id = (opened.request as { id: string }).id;

    const again = await routes.recoveryApprove(
      post(`/api/recovery/requests/${id}/approve`, {}, g1.token),
      params({ id })
    );
    expect(again.status).toBe(409);
    expect(String((await json(again)).error)).toMatch(/already approved/i);
  });

  it("refuses a second concurrent request, and allows one after the first is cancelled", async () => {
    const { student, g1, g2 } = await setupGuardians(2);

    const first = await json(await openRequestFor(student.email, nextAddress(), g1.token));
    const id = (first.request as { id: string }).id;

    const retry = nextAddress();
    const second = await openRequestFor(student.email, retry, g2.token);
    expect(second.status).toBe(409);

    await routes.recoveryCancel(post(`/api/recovery/requests/${id}/cancel`, {}, student.token), params({ id }));

    const third = await openRequestFor(student.email, retry, g2.token);
    expect(third.status).toBe(200);
  });

  it("lapses after seven days instead of staying executable forever", async () => {
    const { student, g1, g2 } = await setupGuardians(2);

    const opened = await json(
      await openRequestFor(student.email, nextAddress(), g1.token)
    );
    const id = (opened.request as { id: string }).id;

    await stores.updateRecoveryRequest(id, {
      initiatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const approve = await routes.recoveryApprove(
      post(`/api/recovery/requests/${id}/approve`, {}, g2.token),
      params({ id })
    );
    expect(approve.status).toBe(410);

    const execute = await routes.recoveryExecute(
      post(`/api/recovery/requests/${id}/execute`, {}, g1.token),
      params({ id })
    );
    expect(execute.status).toBe(410);
    expect((await stores.findUserByEmail(student.email))?.walletAddress).toBe(
      student.user.walletAddress
    );
  });

  it("validates the request itself", async () => {
    const { student, g1 } = await setupGuardians(2);
    const unguarded = await registerAccount({ role: "student" });
    const nonGuardian = await registerAccount({ role: "university" });

    const cases: [unknown, string, number, RegExp][] = [
      [{ studentEmail: student.email, newAddress: "nope" }, g1.token, 400, /0x/],
      [{ studentEmail: student.email, newAddress: "" }, g1.token, 400, /0x/],
      [{ studentEmail: "ghost@example.com", newAddress: nextAddress() }, g1.token, 404, /No student/i],
      [
        { studentEmail: student.email, newAddress: student.user.walletAddress },
        g1.token,
        400,
        /already this account/i,
      ],
      [
        { studentEmail: unguarded.email, newAddress: nextAddress() },
        g1.token,
        400,
        /not nominated any recovery guardians/i,
      ],
      [
        { studentEmail: student.email, newAddress: nextAddress() },
        nonGuardian.token,
        403,
        /not a guardian/i,
      ],
      [
        { studentEmail: student.email, newAddress: g1.user.walletAddress },
        g1.token,
        409,
        /already uses that wallet/i,
      ],
    ];

    for (const [body, token, status, message] of cases) {
      const response = await routes.recoveryRequests(
        post("/api/recovery/requests", body, token, { "x-forwarded-for": freshClientIp() })
      );
      expect(response.status, JSON.stringify(await json(response.clone()))).toBe(status);
      expect(String((await json(response)).error)).toMatch(message);
    }
  });

  it("will not let a student open a request against anyone", async () => {
    const { student } = await setupGuardians(2);
    const response = await openRequestFor(student.email, nextAddress(), student.token);
    expect(response.status).toBe(403);
  });

  it("blocks changing guardians while a request is open", async () => {
    const { student, g1, g2, g3 } = await setupGuardians(2);

    await openRequestFor(student.email, nextAddress(), g1.token);

    const response = await routes.recoverySetup(
      post("/api/recovery/setup", { guardianEmails: [g2.email, g3.email], threshold: 2 }, student.token)
    );
    expect(response.status).toBe(409);
  });

  it("shows a guardian only the accounts they actually guard", async () => {
    const { student, g1 } = await setupGuardians(2);
    const unrelated = await registerAccount({ role: "university" });

    await openRequestFor(student.email, nextAddress(), g1.token);

    const mine = await json(await routes.recoveryRequestsGet(get("/api/recovery/requests", g1.token)));
    expect((mine.requests as { studentEmail: string }[]).some((r) => r.studentEmail === student.email)).toBe(
      true
    );

    const theirs = await json(
      await routes.recoveryRequestsGet(get("/api/recovery/requests", unrelated.token))
    );
    expect(theirs.requests).toEqual([]);
  });

  it("requires a session to list requests", async () => {
    expect((await routes.recoveryRequestsGet(get("/api/recovery/requests"))).status).toBe(401);
  });
});

// ─── System status ──────────────────────────────────────────────────────────

describe("system status", () => {
  it("reports the real storage, chain, and IPFS state without leaking secrets", async () => {
    const response = await routes.status(get("/api/system/status"));
    const body = await json(response);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((body.storage as Record<string, unknown>).mode).toBe("file");
    expect((body.storage as Record<string, unknown>).durable).toBe(true);
    expect((body.ipfs as Record<string, unknown>).configured).toBe(false);
    expect((body.chain as Record<string, unknown>).configured).toBe(false);
    expect(JSON.stringify(body)).not.toContain(process.env.JWT_SECRET);
  });
});
