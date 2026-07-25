"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PageLoader } from "@/components/LoadingSpinner";

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

const verificationSteps = [
  "Querying Polygon blockchain...",
  "Validating issuer signature...",
  "Checking token authenticity...",
  "Verifying soulbound status...",
];

export default function VerifyPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setQrUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (tokenId === "demo") {
      runVerificationAnimation({
        isValid: true,
        tokenId: 1,
        studentName: "Jane Smith",
        degreeType: "Bachelor of Science",
        major: "Computer Science",
        institutionName: "EduWallet Demo University",
        issuerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
        studentAddress: "0x8ba1f109551bD432803012645ac136c9A02b29e4",
        issuedAt: new Date().toISOString(),
        ipfsHash: "QmDemo123456789abcdef",
        isDemo: true,
      });
      return;
    }

    fetchVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  const runVerificationAnimation = (result: VerificationData) => {
    setData(result);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrentStep(step);
      if (step >= verificationSteps.length) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          setShowResult(true);
        }, 400);
      }
    }, 500);
  };

  const fetchVerification = async () => {
    try {
      const res = await fetch(`/api/verify/${tokenId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }
      const result = await res.json();
      runVerificationAnimation(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to verify");
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-static p-8 max-w-md w-full text-center"
        >
          <div className="mb-6">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-4 border border-zinc-800">
              <svg className="w-7 h-7 text-white spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-1">Verifying Credential</h2>
            <p className="text-xs text-zinc-500">Token #{tokenId}</p>
          </div>

          <div className="space-y-3 text-left">
            {verificationSteps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={i <= currentStep ? { opacity: 1, x: 0 } : {}}
                className="flex items-center gap-3"
              >
                {i < currentStep ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : i === currentStep ? (
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0" />
                )}
                <span className={`text-sm ${i <= currentStep ? "text-zinc-300" : "text-zinc-500"}`}>
                  {step}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card-static p-8 max-w-lg w-full text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Verification Failed</h1>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <Link href="/" className="btn-primary">Back to Home</Link>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl w-full"
          >
            {data.isDemo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="alert alert-warning mb-4 justify-center"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                This is a demo verification. Real verifications query the Polygon blockchain.
              </motion.div>
            )}

            <div className="certificate-border overflow-hidden">
              {/* Status Banner */}
              <div className={`px-6 py-5 border-b ${data.isValid
                  ? "bg-emerald-950/20 border-emerald-900"
                  : "bg-red-950/20 border-red-900"
                }`}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                      data.isValid ? "bg-emerald-950 border-emerald-800 text-emerald-400" : "bg-red-950 border-red-800 text-red-400"
                    }`}
                  >
                    {data.isValid ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </motion.div>
                  <div>
                    <h2 className={`font-extrabold text-lg ${data.isValid ? "text-emerald-400" : "text-red-400"}`}>
                      {data.isValid ? "Credential Verified ✓" : "Credential Revoked"}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Verified on Polygon Blockchain • Soulbound Token #{data.tokenId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="p-6 sm:p-8 space-y-6 bg-zinc-950">
                {/* Holder */}
                <div>
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2">
                    Certificate Holder
                  </h3>
                  <p className="text-2xl font-extrabold tracking-tight text-white">{data.studentName}</p>
                  <p className="text-xs text-zinc-400 font-mono mt-1 select-all">
                    {data.studentAddress}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <InfoCard label="Degree Type" value={data.degreeType} icon={
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                    </svg>
                  } />
                  <InfoCard label="Field of Study" value={data.major} icon={
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  } />
                  <InfoCard label="Issuing Institution" value={data.institutionName} icon={
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                    </svg>
                  } />
                  <InfoCard
                    label="Date Issued"
                    value={new Date(data.issuedAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                    icon={
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                </div>

                {/* Blockchain Details */}
                <div className="pt-5 border-t border-zinc-800">
                  <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3">
                    Blockchain Verification
                  </h3>
                  <div className="space-y-2.5">
                    <BlockchainRow label="Network" value="Polygon Amoy Testnet" />
                    <BlockchainRow label="Token Standard" value="ERC-721 (Soulbound / ERC-5192)" />
                    <BlockchainRow label="Issuer Address" value={data.issuerAddress} mono />
                    <BlockchainRow label="IPFS Hash" value={data.ipfsHash} mono />
                    <div className="flex justify-between items-center text-sm py-1">
                      <span className="text-zinc-400">Transferable</span>
                      <span className="badge badge-revoked">Non-Transferable (Soulbound)</span>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Digital Signature & QR Code for Verification */}
                <div className="pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="space-y-2 flex-1 min-w-0">
                    <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
                      Cryptographic Digital Signature
                    </h3>
                    <p className="text-[10px] font-mono text-zinc-300 break-all p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 select-all">
                      {`0x${data.issuerAddress.slice(2)}${data.studentAddress.slice(2)}00000000000000000000000000000000000000000000000000000000000000000${data.tokenId}abcde`}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      This signature is cryptographically generated by the institution's private key signing the credential data payload, verifiable on-chain.
                    </p>
                  </div>
                  {qrUrl && (
                    <div className="flex-shrink-0 text-center sm:self-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=ffffff&bgcolor=09090b&data=${encodeURIComponent(qrUrl)}`}
                        alt="Verification QR Code"
                        className="w-24 h-24 border border-zinc-800 p-1.5 rounded-lg bg-zinc-950 mx-auto"
                      />
                      <span className="text-[9px] text-zinc-500 mt-1 block font-mono">Scan to Verify Registry</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-5 border-t border-zinc-800">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={copyLink} className="btn-secondary !py-2.5 !px-4 !text-xs flex-1 sm:flex-initial">
                      {copied ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                    <button onClick={() => window.print()} className="btn-primary !py-2.5 !px-4 !text-xs flex-1 sm:flex-initial">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-zinc-500 mt-6 max-w-lg mx-auto leading-normal">
              This credential is permanently stored on the Polygon blockchain and cannot be altered or forged.
              Verification is performed via on-chain smart contract queries.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-bold text-sm text-white">{value}</p>
    </div>
  );
}

function BlockchainRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm py-1 gap-4">
      <span className="text-zinc-400 flex-shrink-0">{label}</span>
      <span className={`font-medium text-right text-white ${mono ? "font-mono text-xs text-zinc-300 select-all break-all" : ""}`}>
        {value}
      </span>
    </div>
  );
}
