"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PageLoader, ButtonSpinner } from "@/components/LoadingSpinner";

interface Credential {
  tokenId: number;
  studentName: string;
  degreeType: string;
  major: string;
  institutionName: string;
  issuedAt: string;
  isValid: boolean;
  ipfsHash: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function StudentDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "revoked">("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) {
      fetchCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const fetchCredentials = async () => {
    try {
      const res = await fetch(`/api/credentials/student/${user?.walletAddress}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
      }
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCredentials = useMemo(() => {
    return credentials.filter((cred) => {
      const matchesSearch =
        cred.degreeType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cred.major.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cred.institutionName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "valid" && cred.isValid) ||
        (filterStatus === "revoked" && !cred.isValid);
      return matchesSearch && matchesFilter;
    });
  }, [credentials, searchQuery, filterStatus]);

  const copyVerifyLink = (tokenId: number) => {
    const link = `${window.location.origin}/verify/${tokenId}`;
    navigator.clipboard.writeText(link);
    setCopied(tokenId);
    setTimeout(() => setCopied(null), 2000);
  };

  if (authLoading || !user) {
    return <PageLoader label="Loading dashboard..." />;
  }

  const validCount = credentials.filter((c) => c.isValid).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              {getGreeting()},{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {user.name}
              </span>
            </h1>
            <p className="text-slate-400 text-sm">
              Your decentralized academic credentials dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-purple">Student</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/8 border border-green-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-medium text-green-400">Connected</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Total Credentials",
            value: credentials.length,
            icon: (
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            gradient: "from-blue-500/10 to-cyan-500/10",
          },
          {
            label: "Active Certificates",
            value: validCount,
            icon: (
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
            gradient: "from-emerald-500/10 to-teal-500/10",
          },
          {
            label: "Wallet Address",
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
            transition={{ delay: i * 0.08 }}
            className="stat-card group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-xl font-bold mt-1.5 ${stat.mono ? "font-mono text-base" : ""}`}>
                  {stat.value}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                {stat.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/student/recovery" className="btn-secondary !py-2 !px-4 !text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Manage Recovery
        </Link>
        {credentials.length > 0 && (
          <Link href={`/verify/${credentials[0]?.tokenId}`} className="btn-secondary !py-2 !px-4 !text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on Blockchain
          </Link>
        )}
      </div>

      {/* Credentials Header with Search & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h2 className="text-xl font-bold">Your Certificates</h2>
        {credentials.length > 0 && (
          <div className="flex gap-2">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search credentials..."
                className="input-field !py-2 !pl-9 !pr-4 !text-xs !w-48"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "valid" | "revoked")}
              className="input-field !py-2 !px-3 !text-xs !w-auto"
            >
              <option value="all">All Status</option>
              <option value="valid">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        )}
      </div>

      {/* Credentials List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card-static empty-state"
        >
          <div className="empty-state-icon">
            <svg className="w-16 h-16 text-slate-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">No Credentials Yet</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Your university will issue your certificates here. Once issued, they&apos;ll appear as
            tamper-proof soulbound tokens on the Polygon blockchain.
          </p>
          <div className="mt-6 flex flex-col gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">1</span>
              Your university registers on EduWallet
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">2</span>
              They issue your certificate as a soulbound NFT
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">3</span>
              It appears here — shareable and verifiable
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {filteredCredentials.map((cred, i) => (
            <motion.div
              key={cred.tokenId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Certificate icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    cred.isValid
                      ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/15"
                      : "bg-gradient-to-br from-red-500/15 to-orange-500/15"
                  }`}>
                    <svg className={`w-6 h-6 ${cred.isValid ? "text-emerald-400" : "text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <h3 className="text-base font-bold">{cred.degreeType}</h3>
                      <span className={`badge ${cred.isValid ? "badge-valid" : "badge-revoked"}`}>
                        {cred.isValid ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{cred.major} — {cred.institutionName}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-500">
                        Issued {new Date(cred.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500 font-mono">Token #{cred.tokenId}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => copyVerifyLink(cred.tokenId)}
                    className="btn-secondary !py-2 !px-3.5 !text-xs"
                  >
                    {copied === cred.tokenId ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share
                      </>
                    )}
                  </button>
                  <Link
                    href={`/verify/${cred.tokenId}`}
                    className="btn-primary !py-2 !px-3.5 !text-xs"
                  >
                    View
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredCredentials.length === 0 && credentials.length > 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No credentials match your search or filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
