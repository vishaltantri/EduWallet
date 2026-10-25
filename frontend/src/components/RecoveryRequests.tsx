"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { ButtonSpinner } from "@/components/LoadingSpinner";

export interface RecoveryRequestView {
  id: string;
  studentEmail: string;
  studentName: string;
  fromAddress: string;
  newAddress: string;
  threshold: number;
  initiatedByEmail: string;
  initiatedAt: string;
  status: "pending" | "executed" | "cancelled" | "expired";
  approvals: { guardianEmail: string; approvedAt: string; txHash?: string }[];
  executedAt?: string;
  initiateTxHash?: string;
  executeTxHash?: string;
  chainError?: string;
  state: {
    approvals: number;
    threshold: number;
    thresholdMet: boolean;
    cooldownPassed: boolean;
    expired: boolean;
    open: boolean;
    executable: boolean;
    executableAt: string;
    expiresAt: string;
    waitRemainingMs: number;
  };
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function waitLabel(ms: number) {
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `in about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const minutes = Math.max(1, Math.round(ms / (60 * 1000)));
  return `in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

const STATUS_TONE: Record<RecoveryRequestView["status"], string> = {
  pending: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  executed: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  cancelled: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  expired: "text-slate-400 border-slate-500/30 bg-slate-500/10",
};

/**
 * Recovery requests, from both sides of the fence.
 *
 * For a student this is the veto: a request against their account appears
 * here for the whole 24-hour cooldown with a cancel button, which is the only
 * thing that makes guardian-initiated recovery safe to offer at all. For a
 * guardian institution it is the queue: approve, or complete once the
 * threshold and the delay are both satisfied.
 */
export function RecoveryRequests({
  mode,
  onExecuted,
}: {
  mode: "student" | "guardian";
  onExecuted?: () => void;
}) {
  const { authFetch, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<RecoveryRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchRequests = useCallback(async (): Promise<RecoveryRequestView[] | null> => {
    const res = await authFetch("/api/recovery/requests");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.requests ?? []) as RecoveryRequestView[];
  }, [authFetch]);

  const load = useCallback(async () => {
    try {
      const next = await fetchRequests();
      if (next) setRequests(next);
    } catch {
      setError("Could not load recovery requests.");
    } finally {
      setLoading(false);
    }
  }, [fetchRequests]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const next = await fetchRequests();
        if (cancelled || !next) return;
        setRequests(next);
      } catch {
        if (!cancelled) setError("Could not load recovery requests.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchRequests]);

  const act = async (id: string, action: "approve" | "execute" | "cancel") => {
    setBusyId(id);
    setError("");
    try {
      const res = await authFetch(`/api/recovery/requests/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That did not work");

      showToast(data.message ?? "Done", "success");
      if (action === "execute") {
        // The account's wallet address changed server-side; the cached copy
        // in this tab would otherwise go stale.
        await refreshUser();
        onExecuted?.();
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "That did not work";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((request) => request.status === "pending");

  if (loading) {
    return (
      <div className="glass-card-static p-6">
        <p className="text-xs text-slate-400">Checking for recovery requests…</p>
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="glass-card-static p-6">
        <h2 className="text-base font-bold mb-1.5">
          {mode === "student" ? "Recovery requests" : "Guardian requests"}
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {mode === "student"
            ? "No one has asked to move this account to a new wallet. If a request is ever opened, it appears here for 24 hours before it can complete, and you can cancel it."
            : "No account you act as a guardian for has an open recovery request."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card-static p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold">
          {mode === "student" ? "Recovery requests" : "Guardian requests"}
        </h2>
        {pending.length > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            {pending.length} pending
          </span>
        )}
      </div>

      {mode === "student" && pending.length > 0 && (
        <div className="alert alert-warning text-xs mb-4 items-start">
          <span>
            A guardian has asked to move this account to a different wallet. If that was not you,
            cancel it now — once the 24-hour delay passes it can be completed without you.
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {requests.map((request) => {
            const { state } = request;
            const busy = busyId === request.id;

            return (
              <motion.li
                key={request.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-[rgba(59,130,246,0.12)] bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {mode === "guardian" ? request.studentName : "This account"}
                      {mode === "guardian" && (
                        <span className="text-slate-500 font-normal"> · {request.studentEmail}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {shorten(request.fromAddress)} → {shorten(request.newAddress)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${STATUS_TONE[request.status]}`}
                  >
                    {request.status}
                  </span>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] mb-3">
                  <div>
                    <dt className="text-slate-500">Approvals</dt>
                    <dd className={state.thresholdMet ? "text-emerald-400" : "text-amber-400"}>
                      {state.approvals} of {state.threshold}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Safety delay</dt>
                    <dd className={state.cooldownPassed ? "text-emerald-400" : "text-amber-400"}>
                      {state.cooldownPassed ? "elapsed" : `ends ${waitLabel(state.waitRemainingMs)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Opened by</dt>
                    <dd className="truncate">{request.initiatedByEmail}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Lapses</dt>
                    <dd>{new Date(state.expiresAt).toLocaleDateString()}</dd>
                  </div>
                </dl>

                {request.approvals.length > 0 && (
                  <p className="text-[11px] text-slate-500 mb-3">
                    Approved by {request.approvals.map((a) => a.guardianEmail).join(", ")}
                  </p>
                )}

                {request.chainError && (
                  <p className="text-[11px] text-amber-400/90 mb-3">
                    Recorded here, not yet mirrored on-chain: {request.chainError}
                  </p>
                )}

                {request.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    {mode === "guardian" && (
                      <>
                        <button
                          onClick={() => act(request.id, "approve")}
                          disabled={busy}
                          className="btn-secondary !py-1.5 !px-3 !text-[11px]"
                        >
                          {busy ? <ButtonSpinner /> : "Approve"}
                        </button>
                        <button
                          onClick={() => act(request.id, "execute")}
                          disabled={busy || !state.executable}
                          title={
                            state.executable
                              ? "Complete the migration"
                              : "Needs the full approval threshold and the 24-hour delay"
                          }
                          className="btn-primary !py-1.5 !px-3 !text-[11px]"
                        >
                          {busy ? <ButtonSpinner /> : "Complete recovery"}
                        </button>
                      </>
                    )}
                    {mode === "student" && (
                      <button
                        onClick={() => act(request.id, "cancel")}
                        disabled={busy}
                        className="btn-secondary !py-1.5 !px-3 !text-[11px] !text-red-400 !border-red-500/30"
                      >
                        {busy ? <ButtonSpinner /> : "Cancel this request"}
                      </button>
                    )}
                  </div>
                )}

                {request.status === "executed" && (
                  <p className="text-[11px] text-emerald-400">
                    Completed {request.executedAt ? new Date(request.executedAt).toLocaleString() : ""}.
                    Existing certificates still verify against the original address.
                  </p>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
