"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CertificateView, type VerificationData } from "@/components/CertificateView";

/**
 * The steps name what the server actually does, in order. The original
 * version animated "Querying Polygon blockchain…" regardless of whether a
 * chain was involved, which made the demo look better than it was.
 */
const STEPS = [
  "Locating credential record",
  "Recomputing content hash",
  "Recovering issuer signature",
  "Checking revocation status",
];

const STEP_INTERVAL_MS = 320;

export function VerificationScreen({
  endpoint,
  notFoundHint,
  demoData,
}: {
  endpoint: string;
  notFoundHint?: string;
  demoData?: VerificationData;
}) {
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();

    const ticker = setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length));
    }, STEP_INTERVAL_MS);

    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    // Let the progress list finish rather than flashing past it, but never
    // hold back a result for longer than that takes.
    const reveal = (apply: () => void) => {
      const remaining = Math.max(0, STEPS.length * STEP_INTERVAL_MS - (Date.now() - startedAt));
      revealTimer = setTimeout(() => {
        apply();
        setReady(true);
      }, remaining);
    };

    if (demoData) {
      reveal(() => setData(demoData));
    } else {
      fetch(endpoint, { signal: controller.signal, cache: "no-store" })
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Verification failed");
          return body as VerificationData;
        })
        .then((result) => reveal(() => setData(result)))
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          reveal(() => setError(err instanceof Error ? err.message : "Verification failed"));
        });
    }

    return () => {
      controller.abort();
      clearInterval(ticker);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [endpoint, demoData]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-static p-8 max-w-md w-full"
        >
          <h2 className="text-lg font-bold mb-1">Verifying credential</h2>
          <p className="text-xs text-zinc-500 mb-6">No account needed — this check is public.</p>

          <div className="space-y-3">
            {STEPS.map((label, index) => (
              <div key={label} className="flex items-center gap-3">
                {index < step ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    ✓
                  </span>
                ) : index === step ? (
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0" />
                )}
                <span className={`text-sm ${index <= step ? "text-zinc-300" : "text-zinc-600"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-static p-8 max-w-lg w-full text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Verification failed</h1>
          <p className="text-zinc-400 text-sm mb-2">{error || "No credential found."}</p>
          {notFoundHint && <p className="text-zinc-500 text-xs mb-6">{notFoundHint}</p>}
          <div className="flex gap-3 justify-center mt-6">
            <Link href="/verify" className="btn-secondary !text-xs">
              Try another ID
            </Link>
            <Link href="/" className="btn-primary !text-xs">
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <CertificateView data={data} />
    </div>
  );
}
