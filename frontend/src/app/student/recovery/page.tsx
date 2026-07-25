"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLoader, ButtonSpinner } from "@/components/LoadingSpinner";

export default function RecoveryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [guardians, setGuardians] = useState<string[]>([]);
  const [newGuardian, setNewGuardian] = useState("");
  const [threshold, setThreshold] = useState(2);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const addGuardian = () => {
    if (!newGuardian.trim()) return;
    if (guardians.includes(newGuardian.trim())) {
      setError("Guardian already added");
      return;
    }
    if (guardians.length >= 5) {
      setError("Maximum 5 guardians allowed");
      return;
    }
    setGuardians([...guardians, newGuardian.trim()]);
    setNewGuardian("");
    setError("");
  };

  const removeGuardian = (email: string) => {
    setGuardians(guardians.filter((g) => g !== email));
  };

  const handleSetup = async () => {
    setShowConfirm(false);
    if (guardians.length < 2) {
      setError("Minimum 2 guardians required");
      return;
    }
    if (threshold < 2 || threshold > guardians.length) {
      setError(`Threshold must be between 2 and ${guardians.length}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/recovery/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ guardianEmails: guardians, threshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess("Guardians configured successfully! Your account is now recoverable via M-of-N social recovery.");
      setIsConfigured(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return <PageLoader label="Loading recovery..." />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Account{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Recovery
              </span>
            </h1>
            <p className="text-slate-400 text-sm">
              Set up institutional guardians for M-of-N social recovery
            </p>
          </div>
        </div>
      </motion.div>

      {/* How it Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card-static p-6 mb-8"
      >
        <h2 className="text-base font-bold mb-4 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How Social Recovery Works
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              step: "1",
              title: "Nominate Guardians",
              desc: "Choose trusted university staff — registrar, advisor, department head",
              icon: (
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              step: "2",
              title: "Set Threshold",
              desc: "Decide how many guardians must approve recovery (e.g., 2-of-3)",
              icon: (
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              ),
            },
            {
              step: "3",
              title: "Recover If Needed",
              desc: "Guardians approve recovery to a new address (24h cooldown)",
              icon: (
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                {item.icon}
              </div>
              <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Step {item.step}</div>
              <p className="font-bold text-sm mb-1">{item.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Guardian Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card-static p-6"
      >
        <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          Configure Guardians
        </h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="alert alert-error mb-4"
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="alert alert-success mb-4"
          >
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </motion.div>
        )}

        {/* Add Guardian */}
        <div className="mb-6">
          <label className="input-label">Add Guardian (email of registered university staff)</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={newGuardian}
              onChange={(e) => setNewGuardian(e.target.value)}
              className="input-field flex-1"
              placeholder="registrar@university.edu"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuardian())}
            />
            <button onClick={addGuardian} className="btn-secondary !py-2 !px-4 !text-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Guardian List */}
        <div className="mb-6">
          <label className="input-label">
            Guardians ({guardians.length}/5) — minimum 2 required
          </label>
          {guardians.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-[rgba(59,130,246,0.1)]">
              <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <p className="text-sm text-slate-500">No guardians added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {guardians.map((g, i) => (
                <motion.div
                  key={g}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="table-row"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center text-xs font-bold text-indigo-400">
                        {i + 1}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{g}</span>
                        <p className="text-[10px] text-slate-500">University Staff</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeGuardian(g)}
                      className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Threshold Selector */}
        {guardians.length >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <label className="input-label">
              Approval Threshold — how many guardians must approve recovery?
            </label>
            <div className="flex items-center gap-3 mt-2">
              {Array.from({ length: guardians.length - 1 }, (_, i) => i + 2).map((val) => (
                <button
                  key={val}
                  onClick={() => setThreshold(val)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                    threshold === val
                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-400 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border border-[rgba(59,130,246,0.1)] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {val}
                </button>
              ))}
              <span className="text-sm text-slate-400 ml-2">of {guardians.length} guardians</span>
            </div>
          </motion.div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          className="btn-primary w-full !py-3 !rounded-xl !text-sm"
          disabled={loading || guardians.length < 2 || isConfigured}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <ButtonSpinner />
              Configuring on Blockchain...
            </span>
          ) : isConfigured ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Guardians Configured
            </>
          ) : (
            <>
              Configure Guardians
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative glass-card-static p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold mb-3">Confirm Guardian Setup</h3>
              <p className="text-sm text-slate-400 mb-4">
                You are about to configure <strong className="text-white">{threshold}-of-{guardians.length}</strong> social recovery with these guardians:
              </p>
              <div className="space-y-2 mb-5">
                {guardians.map((g, i) => (
                  <div key={g} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">{i + 1}</span>
                    <span className="text-slate-300">{g}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mb-5">
                This will be recorded on the Polygon blockchain via the RecoveryManager smart contract.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 !py-2.5">
                  Cancel
                </button>
                <button onClick={handleSetup} className="btn-primary flex-1 !py-2.5">
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
