import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
    sweepRateLimits();
  });

  it("allows up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate counters per key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("resets once the window elapses", () => {
    const key = `window-${Math.random()}`;
    expect(rateLimit(key, 1, 20).allowed).toBe(true);
    expect(rateLimit(key, 1, 20).allowed).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 100);
    expect(rateLimit(key, 1, 20).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("drops expired windows when swept", () => {
    const key = `sweep-${Math.random()}`;
    rateLimit(key, 1, 1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 50);
    sweepRateLimits();
    // A swept-away window means the next call starts a fresh one.
    expect(rateLimit(key, 1, 60_000).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe("clientKey", () => {
  it("prefers the first x-forwarded-for hop and scopes the key", () => {
    const request = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(clientKey(request, "login")).toBe("login:203.0.113.7");
  });

  it("falls back to x-real-ip, then to a local marker", () => {
    expect(
      clientKey(new Request("https://x.test", { headers: { "x-real-ip": "198.51.100.4" } }), "s")
    ).toBe("s:198.51.100.4");
    expect(clientKey(new Request("https://x.test"), "s")).toBe("s:local");
  });

  it("separates scopes for the same client", () => {
    const request = new Request("https://x.test", { headers: { "x-real-ip": "1.2.3.4" } });
    expect(clientKey(request, "login")).not.toBe(clientKey(request, "register"));
  });
});
