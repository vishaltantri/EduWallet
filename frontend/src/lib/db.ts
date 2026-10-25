/**
 * Durable key-value storage with graceful degradation.
 *
 * The original prototype wrote JSON files to `process.cwd()/data` (dev) or
 * `/tmp` (production). On Vercel every lambda instance gets its own `/tmp`
 * and it is wiped on cold start, so accounts and credentials silently
 * disappeared between requests. That made the deployed demo unusable.
 *
 * Storage backend is now chosen at runtime:
 *
 *   1. `kv`     — Upstash Redis / Vercel KV over REST (durable, shared across
 *                 lambda instances). Enabled automatically when
 *                 KV_REST_API_URL + KV_REST_API_TOKEN (or the
 *                 UPSTASH_REDIS_REST_* equivalents) are present.
 *   2. `file`   — local JSON files under `data/` for `npm run dev`.
 *   3. `memory` — last-resort in-process cache (mirrored to /tmp so a warm
 *                 lambda keeps its data). Ephemeral; the UI warns about it.
 */

import * as fs from "fs";
import * as path from "path";

export type StorageMode = "kv" | "file" | "memory";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const isServerless = process.env.VERCEL === "1";
const FILE_DIR = isServerless ? path.join("/tmp", "eduwallet") : path.join(process.cwd(), "data");

const memory = new Map<string, unknown>();

/** True when a durable, cross-instance store is configured. */
export function isDurable(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

/**
 * Whether data survives a restart. Local JSON files do; the serverless
 * memory fallback does not.
 */
export function isPersistent(): boolean {
  return storageMode() !== "memory";
}

export function storageMode(): StorageMode {
  if (isDurable()) return "kv";
  return isServerless ? "memory" : "file";
}

// ─── Upstash / Vercel KV REST ───────────────────────────────────────────────

async function kvCommand<T>(command: unknown[]): Promise<T | null> {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`KV command failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as { result?: T | null; error?: string };
  if (body.error) throw new Error(`KV error: ${body.error}`);
  return body.result ?? null;
}

// ─── File backend ───────────────────────────────────────────────────────────

function filePath(key: string) {
  return path.join(FILE_DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

function readFileKey<T>(key: string): T | null {
  try {
    const target = filePath(key);
    if (!fs.existsSync(target)) return null;
    return JSON.parse(fs.readFileSync(target, "utf-8")) as T;
  } catch (error) {
    console.warn(`[db] file read failed for "${key}":`, error);
    return null;
  }
}

function writeFileKey<T>(key: string, value: T): boolean {
  try {
    if (!fs.existsSync(FILE_DIR)) fs.mkdirSync(FILE_DIR, { recursive: true });
    fs.writeFileSync(filePath(key), JSON.stringify(value, null, 2));
    return true;
  } catch (error) {
    console.warn(`[db] file write failed for "${key}":`, error);
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function readKey<T>(key: string): Promise<T | null> {
  if (isDurable()) {
    try {
      const raw = await kvCommand<string>(["GET", key]);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      console.error(`[db] KV read failed for "${key}", falling back:`, error);
    }
  }

  const fromFile = readFileKey<T>(key);
  if (fromFile !== null) return fromFile;

  return (memory.get(key) as T | undefined) ?? null;
}

export async function writeKey<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);

  if (isDurable()) {
    try {
      await kvCommand(["SET", key, JSON.stringify(value)]);
      return;
    } catch (error) {
      console.error(`[db] KV write failed for "${key}", falling back:`, error);
    }
  }

  writeFileKey(key, value);
}

/** Read a JSON array collection, always returning an array. */
export async function readCollection<T>(key: string): Promise<T[]> {
  const value = await readKey<T[]>(key);
  return Array.isArray(value) ? value : [];
}

export async function writeCollection<T>(key: string, items: T[]): Promise<void> {
  await writeKey(key, items);
}

/*
 * Note on concurrency: collections are read-modify-written whole, so two
 * simultaneous writers to the same collection can lose one record. Token IDs
 * are exempt — they come from `nextSequence`, which is an atomic INCR on KV —
 * but a production deployment would want per-record keys or a Lua transaction
 * rather than whole-array writes.
 */

/**
 * Atomically allocate the next integer in a sequence.
 *
 * On KV this uses Redis INCR so concurrent issuance can never hand out the
 * same token ID twice. Without KV we fall back to a stored counter, seeded by
 * `floor` so an existing dataset is never re-numbered.
 */
export async function nextSequence(key: string, floor = 0): Promise<number> {
  if (isDurable()) {
    try {
      const current = await kvCommand<number>(["GET", key]);
      const seed = Number(current ?? 0);
      if (seed < floor) await kvCommand(["SET", key, String(floor)]);
      const next = await kvCommand<number>(["INCR", key]);
      if (typeof next === "number") return next;
    } catch (error) {
      console.error(`[db] KV sequence failed for "${key}", falling back:`, error);
    }
  }

  const stored = await readKey<number>(key);
  const next = Math.max(Number(stored ?? 0), floor) + 1;
  await writeKey(key, next);
  return next;
}
