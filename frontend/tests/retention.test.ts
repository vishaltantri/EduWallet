import { describe, expect, it } from "vitest";
import { pruneVerificationEvents } from "@/lib/stores";
import type { VerificationEvent } from "@/lib/models";

function event(credentialId: string, index: number): VerificationEvent {
  return {
    id: `${credentialId}-${index}`,
    credentialId,
    verifiedAt: new Date(Date.parse("2026-07-01T00:00:00.000Z") - index * 1000).toISOString(),
    outcome: "valid",
    origin: "Unknown location",
  };
}

describe("verification log retention", () => {
  it("keeps everything while under the caps", () => {
    const events = [...Array(50)].map((_, index) => event("cred-a", index));
    expect(pruneVerificationEvents(events)).toHaveLength(50);
  });

  it("caps a single credential at 200 entries, newest first", () => {
    const events = [...Array(500)].map((_, index) => event("cred-a", index));
    const kept = pruneVerificationEvents(events);

    expect(kept).toHaveLength(200);
    expect(kept[0].id).toBe("cred-a-0");
    expect(kept[199].id).toBe("cred-a-199");
  });

  it("does not let one busy credential evict another's history", () => {
    // The previous global 500-entry cap meant a heavily checked certificate
    // pushed every other credential's audit trail out of the log, and the
    // issuer analytics undercounted as a result.
    const busy = [...Array(1000)].map((_, index) => event("busy", index));
    const quiet = [event("quiet", 0), event("quiet", 1)];

    const kept = pruneVerificationEvents([...busy, ...quiet]);

    expect(kept.filter((item) => item.credentialId === "busy")).toHaveLength(200);
    expect(kept.filter((item) => item.credentialId === "quiet")).toHaveLength(2);
  });

  it("enforces a global ceiling across many credentials", () => {
    const events: VerificationEvent[] = [];
    for (let credential = 0; credential < 40; credential++) {
      for (let index = 0; index < 200; index++) {
        events.push(event(`cred-${credential}`, index));
      }
    }
    expect(events).toHaveLength(8000);
    expect(pruneVerificationEvents(events)).toHaveLength(5000);
  });

  it("handles an empty log", () => {
    expect(pruneVerificationEvents([])).toEqual([]);
  });
});
