"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLoader, ButtonSpinner } from "@/components/LoadingSpinner";

interface IssuedCredential {
  tokenId: number;
  studentName: string;
  degreeType: string;
  major: string;
  issuedAt: string;
  studentAddress: string;
  studentEmail?: string;
}

export default function UniversityDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Issue form
  const [studentEmail, setStudentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [degreeType, setDegreeType] = useState("");
  const [major, setMajor] = useState("");

  // Issued credentials
  const [issued, setIssued] = useState<IssuedCredential[]>([]);
  const [issuedLoading, setIssuedLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "university")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) fetchIssued();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } finally {
      setIssuedLoading(false);
    }
  };

  const handleIssueClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail || !studentName || !degreeType || !major) {
      setError("All fields are required");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmIssue = async () => {
    setShowConfirmModal(false);
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

      setSuccess(`Certificate issued successfully! Token ID: #${data.tokenId}`);
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
    return <PageLoader label="Loading dashboard..." />;
  }

  const thisMonthCount = issued.filter((c) => {
    const d = new Date(c.issuedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              Institution{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Dashboard
              </span>
            </h1>
            <p className="text-slate-400 text-sm">
              Issue and manage soulbound academic credentials on Polygon
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-valid">University</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/8 border border-green-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-medium text-green-400">Polygon</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Issued",
            value: issued.length,
            icon: (
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            gradient: "from-blue-500/10 to-cyan-500/10",
          },
          {
            label: "This Month",
            value: thisMonthCount,
            icon: (
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            gradient: "from-cyan-500/10 to-teal-500/10",
          },
          {
            label: "Active Certs",
            value: issued.length,
            icon: (
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            gradient: "from-emerald-500/10 to-green-500/10",
          },
          {
            label: "Wallet",
            value: `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`,
            icon: (
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            ),
            gradient: "from-indigo-500/10 to-purple-500/10",
            mono: true,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="stat-card group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-lg font-bold mt-1 ${stat.mono ? "font-mono text-sm" : ""}`}>
                  {stat.value}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                {stat.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Issue Form — 2 cols */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <div className="glass-card-static p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              Issue Certificate
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

            <form onSubmit={handleIssueClick} className="space-y-4">
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
                <p className="input-hint">Student must be registered on EduWallet</p>
              </div>

              <div>
                <label className="input-label">Student Full Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="input-field"
                  placeholder="Jane Smith"
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
                  <option value="Bachelor of Technology">Bachelor of Technology</option>
                  <option value="Master of Science">Master of Science</option>
                  <option value="Master of Arts">Master of Arts</option>
                  <option value="Master of Technology">Master of Technology</option>
                  <option value="Master of Business Administration">Master of Business Administration</option>
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

              <button type="submit" className="btn-primary w-full !py-3 !rounded-xl !text-sm" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <ButtonSpinner />
                    Issuing on Blockchain...
                  </span>
                ) : (
                  <>
                    Issue Certificate
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Issued Credentials — 3 cols */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3"
        >
          <div className="glass-card-static p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                Issued Credentials
              </h2>
              <span className="badge badge-valid">{issued.length} total</span>
            </div>

            {issuedLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-16 w-full" />
                ))}
              </div>
            ) : issued.length === 0 ? (
              <div className="empty-state !py-16">
                <svg className="w-14 h-14 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
                <h3 className="text-base font-bold mb-1">No Credentials Issued Yet</h3>
                <p className="text-slate-500 text-xs">Use the form to issue your first soulbound certificate</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-4">Student</div>
                  <div className="col-span-3">Degree</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-1">ID</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                {issued.map((cred, i) => (
                  <motion.div
                    key={cred.tokenId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="table-row group"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center w-full">
                      <div className="col-span-4">
                        <p className="text-sm font-semibold truncate">{cred.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {cred.studentAddress.slice(0, 8)}…{cred.studentAddress.slice(-4)}
                        </p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs font-medium text-slate-300 truncate">{cred.degreeType}</p>
                        <p className="text-[11px] text-slate-500 truncate">{cred.major}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-400">
                          {new Date(cred.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                        </p>
                      </div>
                      <div className="col-span-1">
                        <span className="text-xs font-mono text-slate-500">#{cred.tokenId}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="badge badge-valid">Active</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative glass-card-static p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold mb-4">Confirm Certificate Issuance</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Student</span>
                  <span className="font-medium">{studentName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Email</span>
                  <span className="font-medium">{studentEmail}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Degree</span>
                  <span className="font-medium">{degreeType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Major</span>
                  <span className="font-medium">{major}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                This will mint a soulbound NFT on the Polygon blockchain. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="btn-secondary flex-1 !py-2.5"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmIssue}
                  className="btn-primary flex-1 !py-2.5"
                >
                  Confirm & Issue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
