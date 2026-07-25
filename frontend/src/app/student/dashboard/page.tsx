"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

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

export default function StudentDashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && token) {
      fetchCredentials();
    }
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

  const copyVerifyLink = (tokenId: number) => {
    const link = `${window.location.origin}/verify/${tokenId}`;
    navigator.clipboard.writeText(link);
    setCopied(tokenId);
    setTimeout(() => setCopied(null), 2000);
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
          Welcome, <span className="text-blue-400">{user.name}</span>
        </h1>
        <p className="text-slate-400">
          Your decentralized academic credentials
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Credentials", value: credentials.length, icon: "📜", color: "blue" },
          { label: "Valid Certificates", value: credentials.filter(c => c.isValid).length, icon: "✅", color: "green" },
          { label: "Wallet Address", value: `${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-6)}`, icon: "🔗", color: "cyan" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="text-xl font-bold mt-1">{stat.value}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/student/recovery" className="btn-secondary !text-sm">
          🛡️ Manage Recovery
        </Link>
      </div>

      {/* Credentials List */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Your Certificates</h2>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <span className="text-5xl mb-4 block">🎓</span>
          <h3 className="text-lg font-semibold mb-2">No Credentials Yet</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Your university will issue your certificates here. Once issued, they&apos;ll appear as
            tamper-proof soulbound tokens on the Polygon blockchain.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {credentials.map((cred, i) => (
            <motion.div
              key={cred.tokenId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{cred.degreeType}</h3>
                    <span className={`badge ${cred.isValid ? "badge-valid" : "badge-revoked"}`}>
                      {cred.isValid ? "Valid" : "Revoked"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{cred.major} — {cred.institutionName}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Issued: {new Date(cred.issuedAt).toLocaleDateString()} • Token #{cred.tokenId}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyVerifyLink(cred.tokenId)}
                    className="btn-secondary !py-2 !px-4 !text-xs"
                  >
                    {copied === cred.tokenId ? "✅ Copied!" : "📋 Share Link"}
                  </button>
                  <Link
                    href={`/verify/${cred.tokenId}`}
                    className="btn-primary !py-2 !px-4 !text-xs"
                  >
                    View →
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
