"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface SystemStatus {
  storage: { mode: "kv" | "file" | "memory"; durable: boolean; shared?: boolean; warning?: string };
  ipfs: { configured: boolean; reachable: boolean; detail?: string };
  chain: {
    configured: boolean;
    reachable: boolean;
    chainId?: number;
    blockNumber?: number;
    network: string;
    rpcUrl: string;
    explorerBase: string;
    contracts: { soulbound: boolean; registry: boolean; recovery: boolean };
    relayer: boolean;
    detail?: string;
  };
}

const SystemStatusContext = createContext<{ status: SystemStatus | null; loading: boolean }>({
  status: null,
  loading: true,
});

/** One status fetch per page load, shared by everything that needs it. */
export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/system/status", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setStatus(data as SystemStatus))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <SystemStatusContext.Provider value={{ status, loading }}>{children}</SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  return useContext(SystemStatusContext);
}

/**
 * Live network indicator.
 *
 * The old navbar showed a green "Polygon" pulse unconditionally, even with no
 * RPC reachable. This reports what is actually true.
 */
export function NetworkBadge({ className = "" }: { className?: string }) {
  const { status, loading } = useSystemStatus();

  const tone: { dot: string; text: string; label: string } = loading
    ? { dot: "bg-zinc-500", text: "text-zinc-400", label: "Checking…" }
    : status?.chain.reachable
      ? { dot: "bg-green-400 animate-pulse", text: "text-green-400", label: status.chain.network }
      : { dot: "bg-amber-400", text: "text-amber-400", label: "Off-chain mode" };

  // Reachable but with no relayer key still means no certificate can be
  // minted, so the badge should not claim a working chain.
  if (status?.chain.reachable && !status.chain.relayer) {
    tone.dot = "bg-amber-400";
    tone.text = "text-amber-400";
    tone.label = `${status.chain.network} · read-only`;
  }

  const title = status?.chain.reachable
    ? `Connected to ${status.chain.network} · block ${status.chain.blockNumber}`
    : status?.chain.detail || "Certificates are signed and verifiable without a chain connection";

  return (
    <span
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      <span className={`text-[10px] font-medium ${tone.text}`}>{tone.label}</span>
    </span>
  );
}

/** Shown to signed-in users when the deployment cannot persist their data. */
export function StorageWarning() {
  const { status } = useSystemStatus();
  const [dismissed, setDismissed] = useState(false);

  if (!status || status.storage.durable || dismissed) return null;

  return (
    <div className="alert alert-warning mb-6 items-start">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0l-7.1 12.25A2 2 0 004.99 19z" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold text-xs mb-0.5">Demo storage mode</p>
        <p className="text-xs leading-relaxed opacity-90">{status.storage.warning}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs opacity-60 hover:opacity-100 px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
