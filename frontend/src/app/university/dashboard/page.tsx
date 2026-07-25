"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function UniversityDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Issue form
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [degreeType, setDegreeType] = useState("");
  const [major, setMajor] = useState("");

  // Issued credentials
  const [issued, setIssued] = useState<Array<{
    tokenId: number;
    studentName: string;
    degreeType: string;
    major: string;
    issuedAt: string;
    studentAddress: string;
  }>>([]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "university")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) fetchIssued();
  }, [user, token]);

  const fetchIssued = async () => {
    try {
      const res = await fetch(`/api/credentials/issuer/${user?.walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssued(data.credentials || []);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/credentials/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentEmail, studentName, degreeType, major }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue");

      setSuccess(`Certificate issued! Token ID: ${data.tokenId}`);
      setStudentEmail("");
      setStudentName("");
      setDegreeType("");
      setMajor("");
      fetchIssued();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to issue credential");
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          University <span className="text-blue-400">Dashboard</span>
        </h1>
        <p className="text-slate-400">
          Issue and manage academic credentials as soulbound tokens
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Issue Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-2xl">📜</span> Issue New Certificate
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
              >
                {success}
              </motion.div>
            )}

            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="input-label">Student Email</label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="input-field"
                  placeholder="student@university.edu"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Student must be registered on EduWallet</p>
              </div>

              <div>
                <label className="input-label">Student Full Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="input-field"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="input-label">Degree Type</label>
                <select
                  value={degreeType}
                  onChange={(e) => setDegreeType(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select degree type</option>
                  <option value="Bachelor of Science">Bachelor of Science</option>
                  <option value="Bachelor of Arts">Bachelor of Arts</option>
                  <option value="Master of Science">Master of Science</option>
                  <option value="Master of Arts">Master of Arts</option>
                  <option value="Doctor of Philosophy">Doctor of Philosophy</option>
                  <option value="Certificate">Certificate</option>
                  <option value="Diploma">Diploma</option>
                </select>
              </div>

              <div>
                <label className="input-label">Major / Field of Study</label>
                <input
                  type="text"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="input-field"
                  placeholder="Computer Science"
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 spin-slow" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" />
                    </svg>
                    Issuing on Blockchain...
                  </span>
                ) : (
                  "Issue Certificate →"
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Issued Credentials */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-2xl">📋</span> Issued Credentials
              <span className="badge badge-valid ml-auto">{issued.length} total</span>
            </h2>

            {issued.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">🏛️</span>
                <p className="text-slate-400 text-sm">No credentials issued yet</p>
                <p className="text-slate-500 text-xs mt-1">Use the form to issue your first certificate</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {issued.map((cred, i) => (
                  <motion.div
                    key={cred.tokenId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-xl bg-[rgba(15,23,42,0.5)] border border-[rgba(59,130,246,0.1)] hover:border-[rgba(59,130,246,0.25)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{cred.studentName}</p>
                        <p className="text-xs text-slate-400">{cred.degreeType} in {cred.major}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Token #{cred.tokenId} • {new Date(cred.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="badge badge-valid">Active</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
