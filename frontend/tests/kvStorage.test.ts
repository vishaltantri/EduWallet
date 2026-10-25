/**
 * The durable storage backend, against an Upstash-protocol endpoint.
 *
 * All other testing ran on the local file store, so the `kv` branch of the
 * storage adapter had never executed — including the atomic INCR that stops
 * two concurrent issuances minting the same token id, which is the whole
 * reason that branch exists.
 *
 * The endpoint here is a local server speaking the Upstash REST protocol
 * (a JSON command array in, `{result}` out), not a stub of our own code: the
 * adapter's requests, responses and fallbacks are all real.
 */

import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Keep the file fallback pointed somewhere disposable, so a test that forces
// a KV failure cannot touch the project's own data directory.
process.chdir(mkdtempSync(join(tmpdir(), "eduwallet-kv-")));
process.env.JWT_SECRET = "kv-test-secret";
process.env.WALLET_MASTER_KEY = "kv-test-master-key";

const store = new Map<string, string>();
let commands: unknown[][] = [];
/** Force the endpoint to fail, to exercise the adapter's fallback. */
let failing = false;

let server: Server;
let db: typeof import("@/lib/db");
let stores: typeof import("@/lib/stores");

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    request.on("end", () => {
      if (failing) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "simulated outage" }));
        return;
      }

      if (request.headers.authorization !== "Bearer kv-test-token") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }

      const command = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown[];
      commands.push(command);
      const [verb, key, value] = command as [string, string, string];

      let result: unknown = null;
      if (verb === "GET") {
        result = store.has(key) ? store.get(key) : null;
      } else if (verb === "SET") {
        store.set(key, value);
        result = "OK";
      } else if (verb === "INCR") {
        const next = Number(store.get(key) ?? "0") + 1;
        store.set(key, String(next));
        result = next;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ result }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  process.env.KV_REST_API_URL = `http://127.0.0.1:${port}`;
  process.env.KV_REST_API_TOKEN = "kv-test-token";

  db = await import("@/lib/db");
  stores = await import("@/lib/stores");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  commands = [];
  failing = false;
});

describe("backend selection", () => {
  it("selects the durable shared backend when KV credentials are present", () => {
    expect(db.storageMode()).toBe("kv");
    expect(db.isDurable()).toBe(true);
    expect(db.isPersistent()).toBe(true);
  });
});

describe("reads and writes go over the protocol", () => {
  it("round-trips a value as JSON through SET and GET", async () => {
    await db.writeKey("probe", { hello: "world", n: 3 });
    expect(await db.readKey("probe")).toEqual({ hello: "world", n: 3 });

    const verbs = commands.map((command) => command[0]);
    expect(verbs).toContain("SET");
    expect(verbs).toContain("GET");
    // Stored as a JSON string, not as an object the endpoint has to interpret.
    expect(typeof store.get("probe")).toBe("string");
  });

  it("returns null for a key that was never written", async () => {
    expect(await db.readKey("absent-key")).toBeNull();
  });

  it("always hands back an array for a collection, even when empty", async () => {
    expect(await db.readCollection("never-written")).toEqual([]);
    await db.writeCollection("items", [{ id: 1 }, { id: 2 }]);
    expect(await db.readCollection("items")).toHaveLength(2);
  });
});

describe("token id allocation", () => {
  it("uses an atomic increment rather than reading and adding", async () => {
    await stores.allocateTokenId();
    expect(commands.map((command) => command[0])).toContain("INCR");
  });

  it("never issues the same id twice under concurrent allocation", async () => {
    // The pre-KV implementation kept the counter in a module variable, so two
    // instances both started from the same number and minted duplicates.
    const ids = await Promise.all(Array.from({ length: 25 }, () => stores.allocateTokenId()));
    expect(new Set(ids).size).toBe(25);
  });

  it("never renumbers below the highest id already issued", async () => {
    const floor = 500;
    const next = await db.nextSequence("seq:probe", floor);
    expect(next).toBeGreaterThan(floor);
  });
});

describe("real journeys on the durable backend", () => {
  it("creates an account, issues a signed certificate, and reads both back", async () => {
    const { user: student } = await stores.createUser({
      name: "Jane Smith",
      email: "jane.kv@example.com",
      password: "a-good-password",
      role: "student",
    });
    const { user: issuer } = await stores.createUser({
      name: "Registrar",
      email: "registrar.kv@example.com",
      password: "a-good-password",
      role: "university",
      institutionName: "KV University",
    });

    // Written through the endpoint, not to a local file.
    expect(store.has("users")).toBe(true);
    expect(await stores.findUserByEmail("jane.kv@example.com")).toBeTruthy();

    const { issueCredential } = await import("@/lib/issuance");
    const result = await issueCredential(issuer, {
      studentEmail: student.email,
      studentName: "Jane Smith",
      degreeType: "Bachelor of Science",
      major: "Computer Science",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.credential.issuerSignature).toMatch(/^0x/);
    expect(store.has("credentials")).toBe(true);

    const { checkIntegrity } = await import("@/lib/credential");
    const integrity = checkIntegrity(result.credential);
    expect(integrity).toMatchObject({ signed: true, contentIntact: true, signatureValid: true });

    const found = await stores.findCredentialById(result.credential.id);
    expect(found?.tokenId).toBe(result.credential.tokenId);
  });

  it("persists a verification event and a share link", async () => {
    const credential = (await stores.getCredentials())[0];
    expect(credential).toBeTruthy();

    await stores.recordVerification({
      credentialId: credential.id,
      outcome: "valid",
      origin: "Unknown location",
    });
    expect(await stores.getVerificationsFor(credential.id)).toHaveLength(1);

    await stores.addShareLink({
      token: "kv-share-token",
      credentialId: credential.id,
      ownerId: "owner-1",
      label: "Test link",
      createdAt: new Date().toISOString(),
      expiresAt: null,
      anonymized: false,
      revoked: false,
      viewCount: 0,
    });

    const link = await stores.findShareLink("kv-share-token");
    expect(link?.label).toBe("Test link");
    expect(stores.isShareLinkActive(link!)).toBe(true);
  });
});

describe("outage behaviour", () => {
  it("does not throw when the store is unreachable, so a request can still answer", async () => {
    await db.writeKey("outage-probe", { value: 1 });
    failing = true;

    // Falls back rather than propagating a 500 to the caller.
    await expect(db.writeKey("outage-probe", { value: 2 })).resolves.toBeUndefined();
    await expect(db.readKey("outage-probe")).resolves.toBeDefined();
    await expect(db.nextSequence("seq:outage", 0)).resolves.toBeGreaterThan(0);
  });
});
