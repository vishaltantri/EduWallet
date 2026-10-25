import { NextResponse } from "next/server";
import { checkChainHealth } from "@/lib/blockchain";
import { isDurable, isPersistent, storageLocation, storageMode } from "@/lib/db";
import { checkIPFSHealth } from "@/lib/ipfs";

/**
 * Environment self-report.
 *
 * Surfaced in the UI rather than hidden in logs — a demo that quietly loses
 * data or quietly skips the chain is worse than one that says so.
 */
export async function GET() {
  const [chain, ipfs] = await Promise.all([checkChainHealth(), checkIPFSHealth()]);

  return NextResponse.json(
    {
      storage: {
        mode: storageMode(),
        durable: isPersistent(),
        shared: isDurable(),
        location: storageLocation(),
        warning: isPersistent()
          ? undefined
          : "This deployment has no durable storage, so accounts and certificates live in one instance's memory and are lost whenever it restarts or redeploys. Set KV_REST_API_URL and KV_REST_API_TOKEN for a shared database, or DATA_DIR pointing at a mounted persistent disk.",
      },
      ipfs,
      chain,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
