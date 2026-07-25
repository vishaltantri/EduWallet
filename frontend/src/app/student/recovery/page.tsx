"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

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

      setSuccess("Guardians configured successfully! Your account is now recoverable.");
      setIsConfigured(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full spin-slow" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Account <span className="text-blue-400">Recovery</span>
        </h1>
        <p className="text-slate-400">
          Set up institutional guardians who can help you recover access to your credentials
        </p>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 mb-8"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-xl">ℹ️</span> How Social Recovery Works
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Nominate Guardians", desc: "Choose trusted university staff (registrar, advisor, department head)" },
            { step: "2", title: "Set Threshold", desc: "Decide how many guardians must approve (e.g., 2-of-3)" },
            { step: "3", title: "Recover If Needed", desc: "If you lose access, guardians approve recovery to a new address" },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2 font-bold text-sm">
                {item.step}
              </div>
              <p className="font-medium text-sm mb-1">{item.title}</p>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Guardian Setup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span className="text-2xl">🛡️</span> Configure Guardians
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
          >
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
            <button onClick={addGuardian} className="btn-secondary !py-2 !px-4">
              + Add
            </button>
          </div>
        </div>

        {/* Guardian List */}
        <div className="mb-6">
          <label className="input-label">
            Guardians ({guardians.length}/5) — min. 2 required
          </label>
          {guardians.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No guardians added yet</p>
          ) : (
            <div className="space-y-2">
              {guardians.map((g, i) => (
                <motion.div
                  key={g}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgba(15,23,42,0.5)] border border-[rgba(59,130,246,0.1)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm">{g}</span>
                  </div>
                  <button
                    onClick={() => removeGuardian(g)}
                    className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                  >
                    Remove
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Threshold */}
        {guardians.length >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <label className="input-label">
              Approval Threshold — how many guardians must approve recovery?
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={2}
                max={guardians.length}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-lg font-bold text-blue-400 min-w-[80px] text-center">
                {threshold} of {guardians.length}
              </span>
            </div>
          </motion.div>
        )}

        <button
          onClick={handleSetup}
          className="btn-primary w-full !py-3"
          disabled={loading || guardians.length < 2 || isConfigured}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 spin-slow" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" />
              </svg>
              Configuring on Blockchain...
            </span>
          ) : isConfigured ? (
            "✅ Guardians Configured"
          ) : (
            "Configure Guardians →"
          )}
        </button>
      </motion.div>
    </div>
  );
}
