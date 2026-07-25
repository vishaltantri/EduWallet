"use client";

import { useState } from "react";
import { useAuth, UserRole } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password, role);
      router.push(role === "student" ? "/student/dashboard" : "/university/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg shadow-lg shadow-blue-500/20">
              E
            </div>
            <h1 className="text-2xl font-bold">Create Account</h1>
            <p className="text-slate-400 text-sm mt-1">Join EduWallet — no crypto knowledge needed</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div>
              <label className="input-label">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    role === "student"
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-[rgba(59,130,246,0.15)] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <span className="text-lg block mb-1">🎓</span>
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole("university")}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    role === "university"
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-[rgba(59,130,246,0.15)] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <span className="text-lg block mb-1">🏛️</span>
                  University Staff
                </button>
              </div>
            </div>

            <div>
              <label className="input-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="input-label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@university.edu"
                required
              />
            </div>

            <div>
              <label className="input-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min. 6 characters"
                minLength={6}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 spin-slow" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              A blockchain wallet will be created automatically for you.
              <br />
              No seed phrases. No crypto complexity.
            </p>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
