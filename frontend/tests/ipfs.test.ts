/**
 * The IPFS pinning path, against a protocol-compatible local endpoint.
 *
 * This path had never run: the project's configured Pinata token is
 * malformed, so every issuance silently took the local-metadata fallback.
 * These tests cover what our code does with a pinning service that behaves,
 * one that rejects the key, and one that answers without a CID.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface Capture {
  path: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}

let server: Server;
let port: number;
const captured: Capture[] = [];

/** How the stub should answer the next pin request. */
let mode: "ok" | "unauthorized" | "no-cid" | "server-error" = "ok";

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk as Buffer));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      captured.push({
        path: request.url ?? "",
        authorization: request.headers.authorization,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
      });

      const send = (status: number, payload: unknown) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(payload));
      };

      if (request.url === "/data/testAuthentication") {
        if (mode === "unauthorized") return send(401, { error: "Invalid credentials" });
        return send(200, { message: "Congratulations! You are communicating with the Pinata API!" });
      }

      if (mode === "unauthorized") return send(401, { error: "Invalid credentials" });
      if (mode === "server-error") return send(500, { error: "upstream failure" });
      if (mode === "no-cid") return send(200, { IsDuplicate: false });
      return send(200, { IpfsHash: "QmStubbedCidForTesting0000000000000000000000", PinSize: 410 });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;

  process.env.PINATA_API_URL = `http://127.0.0.1:${port}`;
  process.env.PINATA_JWT = "test-token";
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Imported lazily so it reads the environment set above. */
async function ipfs() {
  return import("@/lib/ipfs");
}

describe("pinning metadata", () => {
  const metadata = {
    name: "Bachelor of Science in Computer Science",
    description: "Soulbound academic credential.",
    attributes: [
      { trait_type: "Student Name", value: "Jane Smith" },
      { trait_type: "Degree Type", value: "Bachelor of Science" },
    ],
  };

  it("sends the metadata as pinataContent with a bearer token, and returns the CID", async () => {
    mode = "ok";
    captured.length = 0;
    const { uploadJSONToIPFS } = await ipfs();

    const cid = await uploadJSONToIPFS(metadata);
    expect(cid).toBe("QmStubbedCidForTesting0000000000000000000000");

    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/pinning/pinJSONToIPFS");
    expect(captured[0].authorization).toBe("Bearer test-token");
    expect(captured[0].body.pinataContent).toEqual(metadata);

    // The pin is named so it is findable in the Pinata dashboard, with
    // whitespace collapsed.
    const pinataMetadata = captured[0].body.pinataMetadata as { name: string };
    expect(pinataMetadata.name).toBe("EduWallet_Cert_Bachelor_of_Science_in_Computer_Science");
  });

  it("throws when the service rejects the key, so issuance can fall back", async () => {
    mode = "unauthorized";
    const { uploadJSONToIPFS } = await ipfs();
    await expect(uploadJSONToIPFS(metadata)).rejects.toThrow();
  });

  it("throws on an upstream failure", async () => {
    mode = "server-error";
    const { uploadJSONToIPFS } = await ipfs();
    await expect(uploadJSONToIPFS(metadata)).rejects.toThrow();
  });

  it("refuses a success response that carries no CID", async () => {
    // Returning undefined here would put an empty ipfs:// reference on the
    // certificate and hash it into the signature.
    mode = "no-cid";
    const { uploadJSONToIPFS } = await ipfs();
    await expect(uploadJSONToIPFS(metadata)).rejects.toThrow(/no IPFS hash/i);
  });
});

describe("health check", () => {
  it("reports reachable when the key is accepted", async () => {
    mode = "ok";
    const { checkIPFSHealth } = await ipfs();
    expect(await checkIPFSHealth()).toEqual({ configured: true, reachable: true });
  });

  it("reports a rejected key rather than claiming it works", async () => {
    mode = "unauthorized";
    const { checkIPFSHealth } = await ipfs();
    const health = await checkIPFSHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(false);
    expect(String(health.detail)).toMatch(/401/);
  });
});

describe("gateway URLs", () => {
  it("builds a gateway URL and strips an ipfs:// prefix", async () => {
    const { getIPFSGatewayURL } = await ipfs();
    expect(getIPFSGatewayURL("QmAbc")).toMatch(/\/ipfs\/QmAbc$/);
    expect(getIPFSGatewayURL("ipfs://QmAbc")).toMatch(/\/ipfs\/QmAbc$/);
    expect(getIPFSGatewayURL("ipfs://QmAbc")).not.toContain("ipfs://Qm");
  });

  it("reports configuration state from the token", async () => {
    const { isIPFSConfigured } = await ipfs();
    expect(isIPFSConfigured()).toBe(true);
  });
});
