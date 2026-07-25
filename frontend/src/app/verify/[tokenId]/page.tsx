"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface VerificationData {
  isValid: boolean;
  tokenId: number;
  studentName: string;
  degreeType: string;
  major: string;
  institutionName: string;
  issuerAddress: string;
  studentAddress: string;
  issuedAt: string;
  ipfsHash: string;
  isDemo?: boolean;
}

export default function VerifyPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tokenId === "demo") {
      // Show demo data
      setData({
        isValid: true,
        tokenId: 1,
        studentName: "Jane Smith",
        degreeType: "Bachelor of Science",
        major: "Computer Science",
        institutionName: "EduWallet Demo University",
        issuerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
        studentAddress: "0x8ba1f109551bD432803012645Hac136c9A02b29e",
        issuedAt: new Date().toISOString(),
        ipfsHash: "QmDemo123",
        isDemo: true,
      });
      setLoading(false);
      return;
    }

    fetchVerification();
  }, [tokenId]);

  const fetchVerification = async () => {
    try {
      const res = await fetch(`/api/verify/${tokenId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }
      const result = await res.json();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full spin-slow" />
        <p className="text-slate-400 text-sm">Verifying on blockchain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 max-w-lg w-full text-center"
        >
          <span className="text-5xl block mb-4">❌</span>
          <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <Link href="/" className="btn-primary">Back to Home</Link>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        {data.isDemo && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center">
            ⚠️ This is a demo verification. Real verifications query the Polygon blockchain.
          </div>
        )}

        <div className="glass-card overflow-hidden">
          {/* Status Banner */}
          <div className={`px-6 py-4 ${data.isValid
              ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-500/20"
              : "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-b border-red-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                data.isValid ? "bg-green-500/20" : "bg-red-500/20"
              }`}>
                <span className="text-xl">{data.isValid ? "✅" : "❌"}</span>
              </div>
              <div>
                <h2 className={`font-bold text-lg ${data.isValid ? "text-green-400" : "text-red-400"}`}>
                  {data.isValid ? "Credential Verified" : "Credential Revoked"}
                </h2>
                <p className="text-xs text-slate-400">
                  Verified on Polygon Blockchain • Token #{data.tokenId}
                </p>
              </div>
            </div>
          </div>

          {/* Certificate Details */}
          <div className="p-6 space-y-6">
            {/* Student Info */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Certificate Holder
              </h3>
              <p className="text-xl font-bold">{data.studentName}</p>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Wallet: {data.studentAddress}
              </p>
            </div>

            {/* Credential Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard label="Degree Type" value={data.degreeType} icon="🎓" />
              <InfoCard label="Field of Study" value={data.major} icon="📚" />
              <InfoCard label="Issuing Institution" value={data.institutionName} icon="🏛️" />
              <InfoCard
                label="Date Issued"
                value={new Date(data.issuedAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })}
                icon="📅"
              />
            </div>

            {/* Blockchain Info */}
            <div className="pt-4 border-t border-[rgba(59,130,246,0.1)]">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Blockchain Verification
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Network</span>
                  <span className="font-medium">Polygon Amoy Testnet</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Token Standard</span>
                  <span className="font-medium">ERC-721 (Soulbound / ERC-5192)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Issuer Address</span>
                  <span className="font-mono text-xs text-blue-400">
                    {data.issuerAddress?.slice(0, 10)}...{data.issuerAddress?.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">IPFS Hash</span>
                  <span className="font-mono text-xs text-cyan-400">{data.ipfsHash?.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Transferable</span>
                  <span className="badge badge-revoked">Non-Transferable (Soulbound)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          This credential is permanently stored on the Polygon blockchain and cannot be altered or forged.
        </p>
      </motion.div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="p-3 rounded-xl bg-[rgba(15,23,42,0.5)] border border-[rgba(59,130,246,0.08)]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}
