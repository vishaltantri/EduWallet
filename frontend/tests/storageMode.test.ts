/**
 * Which storage backend the adapter picks, per host.
 *
 * This is the check that was wrong for Render: only Vercel counted as an
 * ephemeral filesystem, so a Render deployment reported its data as durable
 * while every redeploy erased it, and the UI's warning banner never showed.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HOST_VARS = ["VERCEL", "RENDER", "DATA_DIR", "KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of HOST_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of HOST_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** Re-import so the module re-reads the environment set by each test. */
async function load() {
  vi.resetModules();
  return import("@/lib/db");
}

describe("storage backend selection", () => {
  it("uses durable local files for ordinary development", async () => {
    const db = await load();
    expect(db.storageMode()).toBe("file");
    expect(db.isPersistent()).toBe(true);
    expect(db.isDurable()).toBe(false);
  });

  it("treats Vercel without a shared store as ephemeral", async () => {
    process.env.VERCEL = "1";
    const db = await load();
    expect(db.storageMode()).toBe("memory");
    expect(db.isPersistent()).toBe(false);
  });

  it("treats Render without a disk as ephemeral", async () => {
    process.env.RENDER = "true";
    const db = await load();
    expect(db.storageMode()).toBe("memory");
    expect(db.isPersistent()).toBe(false);
  });

  it("treats Render with a mounted disk as durable", async () => {
    process.env.RENDER = "true";
    process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "eduwallet-disk-"));
    const db = await load();
    expect(db.storageMode()).toBe("file");
    expect(db.isPersistent()).toBe(true);
    expect(db.storageLocation()).toBe(process.env.DATA_DIR);
  });

  it("prefers a shared key-value store over any filesystem", async () => {
    process.env.RENDER = "true";
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    const db = await load();
    expect(db.storageMode()).toBe("kv");
    expect(db.isDurable()).toBe(true);
    expect(db.isPersistent()).toBe(true);
    expect(db.storageLocation()).toBe("shared key-value store");
  });

  it("accepts the Upstash variable names as well as the Vercel ones", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const db = await load();
    expect(db.storageMode()).toBe("kv");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("writes into a mounted disk rather than the working directory", async () => {
    const disk = mkdtempSync(join(tmpdir(), "eduwallet-disk-"));
    process.env.DATA_DIR = disk;
    const db = await load();

    await db.writeKey("probe", { ok: true });
    expect(await db.readKey("probe")).toEqual({ ok: true });
    expect(db.storageLocation()).toBe(disk);
  });
});
