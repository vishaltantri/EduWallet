import { NextResponse } from "next/server";
import { checkChainHealth } from "@/lib/blockchain";
import { isDurable, isPersistent, storageMode } from "@/lib/db";
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
        warning: isPersistent()
          ? undefined
          : "This deployment has no shared database, so accounts and certificates live in one server instance's memory and are lost on restart. Set KV_REST_API_URL and KV_REST_API_TOKEN to make them durable.",
      },
      ipfs,
      chain,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
