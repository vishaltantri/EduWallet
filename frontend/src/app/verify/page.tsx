"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSystemStatus } from "@/components/SystemStatus";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * The front door for verifiers.
 *
 * An employer usually arrives holding a link, a credential ID, or nothing but
 * a wallet address from a CV. All three should lead somewhere, so the one
 * input accepts any of them — including a pasted full URL.
 */
export default function VerifyLandingPage() {
  const router = useRouter();
  const { status } = useSystemStatus();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const value = query.trim();
    if (!value) return;

    // A pasted verification URL: pull the useful part out of it.
    const urlMatch = value.match(/\/verify\/(?:share\/)?([^/?#]+)/);
    if (urlMatch) {
      const isShare = value.includes("/verify/share/");
      router.push(isShare ? `/verify/share/${urlMatch[1]}` : `/verify/${urlMatch[1]}`);
      return;
    }

    if (ADDRESS_PATTERN.test(value)) {
      router.push(`/u/${value}`);
      return;
    }

    if (UUID_PATTERN.test(value) || value === "demo") {
      router.push(`/verify/${value}`);
      return;
    }

    setError("Enter a credential ID, a verification link, or a 0x wallet address.");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
          Verify a credential
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-xl">
          No account, no fee, and no phone call to a registrar. Paste what you were given — a
          verification link, a credential ID, or the holder&apos;s wallet address.
        </p>

        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field flex-1 font-mono !text-xs"
            placeholder="https://…/verify/… · credential ID · 0x wallet address"
            aria-label="Credential ID, verification link, or wallet address"
          />
          <button type="submit" className="btn-primary !px-6 whitespace-nowrap">
            Verify
          </button>
        </form>

        {error && <p className="text-xs text-red-400 mb-6">{error}</p>}

        <p className="text-xs text-zinc-500 mb-12">
          Curious first?{" "}
          <Link href="/verify/demo" className="text-zinc-300 hover:text-white underline underline-offset-2">
            Open a sample certificate
          </Link>
          .
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {[
            {
              title: "Signature check",
              body: "The issuing institution's wallet signed a hash of the certificate. We recover the signer from that signature.",
            },
            {
              title: "Tamper check",
              body: "The certificate's contents are re-hashed and compared. One changed character breaks the match.",
            },
            {
              title: "Revocation check",
              body: "Institutions can withdraw a certificate. Verification shows that, and the reason given.",
            },
          ].map((item) => (
            <div key={item.title} className="glass-card-static p-5">
              <h2 className="text-sm font-bold mb-1.5">{item.title}</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {status && (
          <div className="glass-card-static p-5">
            <h2 className="text-sm font-bold mb-3">Registry status</h2>
            <dl className="space-y-2 text-xs">
              <StatusRow
                label="Chain anchoring"
                value={
                  status.chain.reachable
                    ? `Connected · ${status.chain.network} · block ${status.chain.blockNumber}`
                    : "Unavailable — certificates verify by issuer signature"
                }
                ok={status.chain.reachable}
              />
              <StatusRow
                label="IPFS pinning"
                value={
                  status.ipfs.reachable
                    ? "Connected"
                    : status.ipfs.detail || "Not configured"
                }
                ok={status.ipfs.reachable}
              />
              <StatusRow
                label="Credential store"
                value={
                  status.storage.shared
                    ? "Durable shared database"
                    : status.storage.durable
                      ? "Local file store"
                      : "Ephemeral demo storage"
                }
                ok={status.storage.durable}
              />
            </dl>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <dt className="text-zinc-400">{label}</dt>
      <dd className={`text-right ${ok ? "text-emerald-400" : "text-amber-400"}`}>{value}</dd>
    </div>
  );
}
