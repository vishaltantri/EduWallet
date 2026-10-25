"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

export interface VerificationData {
  outcome: "valid" | "revoked" | "tampered" | "not_found";
  isValid: boolean;
  id: string;
  tokenId: number;
  studentName: string;
  studentAddress: string;
  degreeType: string;
  major: string;
  grade?: string;
  completionDate?: string;
  institutionName: string;
  issuerAddress: string;
  issuedAt: string;
  ipfsHash: string;
  revokedAt?: string;
  revocationReason?: string;
  anonymized: boolean;
  integrity: {
    signed: boolean;
    contentIntact: boolean;
    signatureValid: boolean;
    credentialHash?: string;
    recoveredSigner?: string;
  };
  anchor: {
    anchored: boolean;
    txHash?: string;
    explorerUrl?: string;
    note?: string;
    onChainMatches?: boolean;
  };
  priorVerifications: number;
  shareLink?: { label: string; expiresAt: string | null };
  isDemo?: boolean;
}

const OUTCOME_STYLES = {
  valid: {
    heading: "Credential Verified",
    tone: "text-emerald-400",
    panel: "bg-emerald-950/20 border-emerald-900",
    chip: "bg-emerald-950 border-emerald-800 text-emerald-400",
  },
  revoked: {
    heading: "Credential Revoked",
    tone: "text-red-400",
    panel: "bg-red-950/20 border-red-900",
    chip: "bg-red-950 border-red-800 text-red-400",
  },
  tampered: {
    heading: "Signature Does Not Match",
    tone: "text-amber-400",
    panel: "bg-amber-950/20 border-amber-900",
    chip: "bg-amber-950 border-amber-800 text-amber-400",
  },
  not_found: {
    heading: "Credential Not Found",
    tone: "text-red-400",
    panel: "bg-red-950/20 border-red-900",
    chip: "bg-red-950 border-red-800 text-red-400",
  },
} as const;

export function CertificateView({ data }: { data: VerificationData }) {
  const pageUrl = useCurrentUrl();
  const [copied, setCopied] = useState(false);
  const style = OUTCOME_STYLES[data.outcome];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL bar still has the link.
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl w-full">
      {data.isDemo && (
        <div className="alert alert-warning mb-4 justify-center text-xs">
          Sample certificate — the cryptography shown here is illustrative.
        </div>
      )}

      {data.shareLink && (
        <div className="alert alert-info mb-4 text-xs">
          <div>
            <p className="font-semibold">Shared verification link</p>
            <p className="opacity-80">
              {data.shareLink.expiresAt
                ? `This link expires ${new Date(data.shareLink.expiresAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}.`
                : "This link does not expire."}{" "}
              {data.anonymized && "The holder chose to withhold their name."}
            </p>
          </div>
        </div>
      )}

      <div className="certificate-border overflow-hidden">
        {/* Outcome banner */}
        <div className={`px-6 py-5 border-b ${style.panel}`}>
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.chip}`}
            >
              {data.outcome === "valid" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : data.outcome === "tampered" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </motion.div>
            <div className="min-w-0">
              <h2 className={`font-extrabold text-lg ${style.tone}`}>{style.heading}</h2>
              <p className="text-xs text-zinc-400">
                Soulbound certificate #{data.tokenId} · issued by {data.institutionName}
              </p>
            </div>
          </div>

          {data.outcome === "revoked" && (
            <p className="text-xs text-red-300/90 mt-3 leading-relaxed">
              Withdrawn by the issuing institution
              {data.revokedAt
                ? ` on ${new Date(data.revokedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`
                : ""}
              {data.revocationReason ? `: ${data.revocationReason}` : "."}
            </p>
          )}
          {data.outcome === "tampered" && (
            <p className="text-xs text-amber-300/90 mt-3 leading-relaxed">
              The stored certificate does not match the signature recorded at issuance. Do not
              rely on this document — contact {data.institutionName} directly.
            </p>
          )}
        </div>

        <div className="p-6 sm:p-8 space-y-6 bg-zinc-950">
          {/* Holder */}
          <div>
            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2">
              Certificate Holder
            </h3>
            <p className="text-2xl font-extrabold tracking-tight text-white">{data.studentName}</p>
            <p className="text-xs text-zinc-400 font-mono mt-1 select-all break-all">
              {data.studentAddress}
            </p>
          </div>

          {/* Details */}
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoCard label="Degree Type" value={data.degreeType} />
            <InfoCard label="Field of Study" value={data.major} />
            <InfoCard label="Issuing Institution" value={data.institutionName} />
            <InfoCard
              label="Date Issued"
              value={new Date(data.issuedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            />
            {data.grade && <InfoCard label="Grade / Classification" value={data.grade} />}
            {data.completionDate && (
              <InfoCard
                label="Completed"
                value={new Date(data.completionDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
            )}
          </div>

          {/* Integrity */}
          <div className="pt-5 border-t border-zinc-800">
            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3">
              Cryptographic Proof
            </h3>

            <div className="space-y-2 mb-4">
              <CheckRow
                ok={data.integrity.signed}
                label="Signed by the issuing institution"
                failLabel="No issuer signature on record"
              />
              <CheckRow
                ok={data.integrity.contentIntact}
                label="Content matches the hash signed at issuance"
                failLabel="Content does not match the signed hash"
                muted={!data.integrity.signed}
              />
              <CheckRow
                ok={data.integrity.signatureValid}
                label={
                  data.integrity.recoveredSigner
                    ? `Signature recovers to ${short(data.integrity.recoveredSigner)}`
                    : "Signature recovers to the issuer's wallet"
                }
                failLabel="Signature does not recover to the issuer's wallet"
                muted={!data.integrity.signed}
              />
            </div>

            {data.integrity.credentialHash && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                  Credential hash (keccak256)
                </p>
                <p className="text-[10px] font-mono text-zinc-300 break-all p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 select-all">
                  {data.integrity.credentialHash}
                </p>
              </div>
            )}

            <p className="text-[10px] text-zinc-500 leading-relaxed">
              The institution&apos;s wallet signed this hash with its private key (EIP-191). Anyone
              can recover the signing address from the signature, so neither the student nor this
              website can forge or edit a certificate without breaking the check above.
            </p>
          </div>

          {/* Chain + storage */}
          <div className="pt-5 border-t border-zinc-800">
            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3">
              Registry Details
            </h3>
            <div className="space-y-2.5">
              <DetailRow label="Token standard" value="ERC-721 · soulbound (ERC-5192)" />
              <DetailRow label="Transferable" value="No — permanently bound to the holder" />
              <DetailRow label="Issuer address" value={data.issuerAddress} mono />
              <DetailRow label="Metadata" value={data.ipfsHash} mono />
              <div className="flex justify-between items-center gap-4 text-sm py-1">
                <span className="text-zinc-400 flex-shrink-0">Chain anchor</span>
                {data.anchor.anchored && data.anchor.explorerUrl ? (
                  <a
                    href={data.anchor.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-400 hover:text-emerald-300 truncate"
                  >
                    {short(data.anchor.txHash ?? "")} ↗
                  </a>
                ) : (
                  <span className="badge badge-pending">Not anchored</span>
                )}
              </div>
              {!data.anchor.anchored && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  This certificate has not been written to Polygon
                  {data.anchor.note ? ` (${data.anchor.note})` : ""}. The issuer signature above is
                  what proves authenticity — it holds independently of any chain.
                </p>
              )}
              {data.anchor.onChainMatches === false && (
                <p className="text-[10px] text-amber-400 leading-relaxed">
                  The on-chain record for this token does not match the stored certificate.
                </p>
              )}
            </div>
          </div>

          {/* QR + verification count */}
          <div className="pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-1.5">
                Verification Record
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Checked {data.priorVerifications}{" "}
                {data.priorVerifications === 1 ? "time" : "times"} before this visit. The holder and
                the issuing institution can both see this history.
              </p>
            </div>
            {pageUrl && (
              <div className="flex-shrink-0 text-center">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=ffffff&bgcolor=09090b&data=${encodeURIComponent(pageUrl)}`}
                  alt="QR code linking to this verification page"
                  width={120}
                  height={120}
                  unoptimized
                  className="w-24 h-24 border border-zinc-800 p-1.5 rounded-lg bg-zinc-950 mx-auto"
                />
                <span className="text-[9px] text-zinc-500 mt-1 block font-mono">Scan to verify</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-5 border-t border-zinc-800 flex flex-wrap gap-3">
            <button onClick={copyLink} className="btn-secondary !py-2.5 !px-4 !text-xs">
              {copied ? "Copied!" : "Copy link"}
            </button>
            {!data.isDemo && (
              <a
                href={`/api/credentials/${data.id}/vc`}
                download
                className="btn-secondary !py-2.5 !px-4 !text-xs"
              >
                Download W3C credential
              </a>
            )}
            <button onClick={() => window.print()} className="btn-primary !py-2.5 !px-4 !text-xs">
              Print certificate
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500 mt-6 max-w-lg mx-auto leading-relaxed">
        Verified against the issuer&apos;s digital signature.{" "}
        <Link href="/verify" className="text-zinc-300 hover:text-white underline underline-offset-2">
          Verify another certificate
        </Link>
      </p>
    </motion.div>
  );
}

function short(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function CheckRow({
  ok,
  label,
  failLabel,
  muted,
}: {
  ok: boolean;
  label: string;
  failLabel: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold ${
          muted
            ? "bg-zinc-800 text-zinc-500"
            : ok
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
        }`}
      >
        {muted ? "–" : ok ? "✓" : "✕"}
      </span>
      <span className={`text-xs leading-relaxed ${muted ? "text-zinc-600" : ok ? "text-zinc-300" : "text-red-400"}`}>
        {muted ? "Not applicable" : ok ? label : failLabel}
      </span>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
      <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      <p className="font-bold text-sm text-white mt-1">{value}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm py-1 gap-4">
      <span className="text-zinc-400 flex-shrink-0">{label}</span>
      <span
        className={`font-medium text-right text-white ${
          mono ? "font-mono text-xs text-zinc-300 select-all break-all" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
