"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageLoader } from "@/components/LoadingSpinner";

interface ProfileCredential {
  id: string;
  tokenId: number;
  degreeType: string;
  major: string;
  grade?: string;
  institutionName: string;
  issuedAt: string;
  anchored: boolean;
}

interface Profile {
  holder: { name: string; walletAddress: string; memberSince: string };
  credentials: ProfileCredential[];
}

/**
 * A public, verifiable résumé for one wallet.
 *
 * Only active credentials whose issuer signature checks out are listed — a
 * page that anyone can cite should not carry anything unverifiable.
 */
export default function PublicProfilePage() {
  const params = useParams();
  const address = String(params.address ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/profile/${encodeURIComponent(address)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Profile unavailable");
        return body as Profile;
      })
      .then(setProfile)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Profile unavailable");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [address]);

  if (loading) return <PageLoader label="Loading profile..." />;

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold mb-2">No profile here</h1>
        <p className="text-zinc-400 text-sm mb-6">{error}</p>
        <Link href="/verify" className="btn-primary !text-xs">
          Verify a credential instead
        </Link>
      </div>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the URL is in the address bar.
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">
              Verified credential profile
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight mb-1.5">{profile.holder.name}</h1>
            <p className="text-xs font-mono text-zinc-500 break-all select-all">
              {profile.holder.walletAddress}
            </p>
          </div>
          <button onClick={copyLink} className="btn-secondary !py-2 !px-4 !text-xs flex-shrink-0">
            {copied ? "Copied!" : "Copy profile link"}
          </button>
        </div>

        {profile.credentials.length === 0 ? (
          <div className="glass-card-static empty-state">
            <h2 className="text-base font-bold mb-1">No public credentials</h2>
            <p className="text-zinc-500 text-xs">
              This holder has no active, signature-verified credentials to show.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-4">
              {profile.credentials.length} verified credential
              {profile.credentials.length === 1 ? "" : "s"} · each one signed by its issuing
              institution
            </p>
            <div className="space-y-3">
              {profile.credentials.map((credential, index) => (
                <motion.div
                  key={credential.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-base font-bold">{credential.degreeType}</h2>
                      <span className="badge badge-valid">Verified</span>
                      {credential.anchored && <span className="badge badge-info">On-chain</span>}
                    </div>
                    <p className="text-sm text-zinc-400">
                      {credential.major} — {credential.institutionName}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(credential.issuedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                      {credential.grade ? ` · ${credential.grade}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/verify/${credential.id}`}
                    className="btn-secondary !py-2 !px-3.5 !text-xs flex-shrink-0"
                  >
                    Verify
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-zinc-600 mt-10 leading-relaxed">
          Revoked and unsigned credentials are never listed on a public profile. Open any entry to
          check its issuer signature yourself.
        </p>
      </motion.div>
    </div>
  );
}
