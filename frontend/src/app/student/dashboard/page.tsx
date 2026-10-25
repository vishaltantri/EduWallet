"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PageLoader, ButtonSpinner } from "@/components/LoadingSpinner";
import { StorageWarning } from "@/components/SystemStatus";
import { useToast } from "@/components/Toast";

interface Credential {
  id: string;
  tokenId: number;
  studentName: string;
  degreeType: string;
  major: string;
  grade?: string;
  completionDate?: string;
  institutionName: string;
  issuedAt: string;
  isValid: boolean;
  ipfsHash: string;
  anchored?: boolean;
  txHash?: string;
  revokedAt?: string;
  revocationReason?: string;
  verificationCount: number;
  integrity: { signed: boolean; contentIntact: boolean; signatureValid: boolean };
}

interface VerificationEvent {
  id: string;
  verifiedAt: string;
  outcome: string;
  origin: string;
  shareToken?: string;
}

interface ShareLink {
  token: string;
  credentialId: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  anonymized: boolean;
  revoked: boolean;
  viewCount: number;
  lastViewedAt?: string;
  url: string;
  active: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function loadStudentData(
  authFetch: AuthFetch,
  walletAddress: string
): Promise<{ credentials: Credential[]; links: ShareLink[] }> {
  try {
    const [credentialsRes, sharesRes] = await Promise.all([
      authFetch(`/api/credentials/student/${walletAddress}`),
      authFetch("/api/share"),
    ]);

    const credentials = credentialsRes.ok ? (await credentialsRes.json()).credentials ?? [] : [];
    const links = sharesRes.ok ? (await sharesRes.json()).links ?? [] : [];
    return { credentials, links };
  } catch (error) {
    console.error("Failed to load student dashboard:", error);
    return { credentials: [], links: [] };
  }
}

export default function StudentDashboard() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "revoked">("all");

  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, VerificationEvent[]>>({});
  const [sharing, setSharing] = useState<Credential | null>(null);
  const [shareForm, setShareForm] = useState({ label: "", expiry: "30d", anonymized: false });
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "student")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const refresh = useCallback(() => {
    if (!user) return Promise.resolve();
    // State lands in the .then callback rather than after an await, so the
    // React lint rules can see that nothing is set synchronously on mount.
    return loadStudentData(authFetch, user.walletAddress).then((data) => {
      setCredentials(data.credentials);
      setShareLinks(data.links);
      setLoading(false);
    });
  }, [authFetch, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredCredentials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return credentials.filter((credential) => {
      const matchesSearch =
        !query ||
        credential.degreeType.toLowerCase().includes(query) ||
        credential.major.toLowerCase().includes(query) ||
        credential.institutionName.toLowerCase().includes(query);
      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "valid" && credential.isValid) ||
        (filterStatus === "revoked" && !credential.isValid);
      return matchesSearch && matchesFilter;
    });
  }, [credentials, searchQuery, filterStatus]);

  const toggleLog = async (credentialId: string) => {
    if (openLog === credentialId) {
      setOpenLog(null);
      return;
    }
    setOpenLog(credentialId);
    if (logs[credentialId]) return;

    const res = await authFetch(`/api/credentials/${credentialId}/verifications`);
    if (res.ok) {
      const data = await res.json();
      setLogs((current) => ({ ...current, [credentialId]: data.events ?? [] }));
    }
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, "success");
    } catch {
      showToast("Could not access the clipboard", "error");
    }
  };

  const createShareLink = async () => {
    if (!sharing) return;
    setShareBusy(true);
    try {
      const res = await authFetch("/api/share", {
        method: "POST",
        body: JSON.stringify({ credentialId: sharing.id, ...shareForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create link");

      await copy(data.link.url, "Share link created and copied");
      setSharing(null);
      setShareForm({ label: "", expiry: "30d", anonymized: false });
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create link", "error");
    } finally {
      setShareBusy(false);
    }
  };

  const revokeShareLink = async (token: string) => {
    const res = await authFetch(`/api/share/${token}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Share link revoked", "success");
      await refresh();
    } else {
      showToast("Could not revoke that link", "error");
    }
  };

  if (authLoading || !user) return <PageLoader label="Loading dashboard..." />;

  const validCount = credentials.filter((c) => c.isValid).length;
  const totalVerifications = credentials.reduce((sum, c) => sum + (c.verificationCount ?? 0), 0);
  const activeLinks = shareLinks.filter((link) => link.active);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StorageWarning />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              {getGreeting()}, {user.name}
            </h1>
            <p className="text-zinc-400 text-sm">
              Your credentials, who has checked them, and who can still see them
            </p>
          </div>
          <Link href={`/u/${user.walletAddress}`} className="btn-secondary !py-2 !px-4 !text-xs">
            View public profile
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <Stat label="Credentials" value={credentials.length} />
        <Stat label="Active" value={validCount} />
        <Stat label="Times verified" value={totalVerifications} />
        <Stat label="Active share links" value={activeLinks.length} />
      </div>

      {/* ─── Credentials ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold">Your Certificates</h2>
        {credentials.length > 0 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search credentials..."
              className="input-field !py-2 !px-3 !text-xs sm:!w-52"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="input-field !py-2 !px-3 !text-xs !w-auto"
            >
              <option value="all">All Status</option>
              <option value="valid">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <div className="glass-card-static empty-state">
          <h3 className="text-lg font-bold mb-2">No Credentials Yet</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            Your institution issues certificates straight to this wallet. Once issued, they appear
            here as tamper-proof soulbound tokens you can share with anyone.
          </p>
          <div className="mt-6 flex flex-col gap-2 text-xs text-zinc-500 items-start max-w-xs mx-auto">
            {[
              "Your institution registers on EduWallet",
              "They issue your certificate, signed with their wallet",
              "It appears here — shareable and instantly verifiable",
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCredentials.map((credential, index) => (
            <motion.div
              key={credential.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="glass-card p-5 sm:p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base font-bold">{credential.degreeType}</h3>
                    <span className={`badge ${credential.isValid ? "badge-valid" : "badge-revoked"}`}>
                      {credential.isValid ? "Active" : "Revoked"}
                    </span>
                    {credential.integrity.signatureValid ? (
                      <span className="badge badge-info" title="Issuer signature verified">
                        Signature verified
                      </span>
                    ) : credential.integrity.signed ? (
                      <span className="badge badge-revoked">Signature mismatch</span>
                    ) : (
                      <span className="badge badge-pending">Unsigned (legacy)</span>
                    )}
                    {credential.anchored && <span className="badge badge-info">On-chain</span>}
                  </div>
                  <p className="text-sm text-zinc-400">
                    {credential.major} — {credential.institutionName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500">
                    <span>
                      Issued{" "}
                      {new Date(credential.issuedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {credential.grade && <span>· {credential.grade}</span>}
                    <span className="font-mono">· Token #{credential.tokenId}</span>
                    <button
                      onClick={() => void toggleLog(credential.id)}
                      className="text-zinc-400 hover:text-white underline underline-offset-2"
                    >
                      · Verified {credential.verificationCount ?? 0}×
                    </button>
                  </div>
                  {!credential.isValid && credential.revocationReason && (
                    <p className="text-xs text-red-400/80 mt-2">
                      Revoked by issuer: {credential.revocationReason}
                    </p>
                  )}

                  {openLog === credential.id && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <p className="text-[11px] font-semibold text-zinc-400 mb-2">
                        Verification history
                      </p>
                      {!logs[credential.id] ? (
                        <p className="text-[11px] text-zinc-500">Loading…</p>
                      ) : logs[credential.id].length === 0 ? (
                        <p className="text-[11px] text-zinc-500">
                          Nobody has opened this credential&apos;s verification link yet.
                        </p>
                      ) : (
                        <ul className="space-y-1 max-h-40 overflow-y-auto">
                          {logs[credential.id].map((event) => (
                            <li
                              key={event.id}
                              className="flex items-center justify-between gap-3 text-[11px]"
                            >
                              <span className="text-zinc-400 truncate">
                                {event.origin}
                                {event.shareToken ? " · via share link" : ""}
                              </span>
                              <span className="text-zinc-600 flex-shrink-0">
                                {new Date(event.verifiedAt).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                  <button
                    onClick={() => {
                      setSharing(credential);
                      setShareForm({
                        label: `${credential.degreeType} — shared`,
                        expiry: "30d",
                        anonymized: false,
                      });
                    }}
                    className="btn-secondary !py-2 !px-3 !text-xs"
                  >
                    Share
                  </button>
                  <a
                    href={`/api/credentials/${credential.id}/vc`}
                    className="btn-secondary !py-2 !px-3 !text-xs"
                    download
                  >
                    Download VC
                  </a>
                  <Link href={`/verify/${credential.id}`} className="btn-primary !py-2 !px-3 !text-xs">
                    View certificate
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredCredentials.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No credentials match your search or filter.
            </div>
          )}
        </div>
      )}

      {/* ─── Share links ─── */}
      {shareLinks.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-1">Share Links</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Scoped links you have handed out. Revoke one and it stops working immediately, even if
            the recipient bookmarked it.
          </p>
          <div className="space-y-2.5">
            {shareLinks.map((link) => {
              const credential = credentials.find((item) => item.id === link.credentialId);
              return (
                <div key={link.token} className="table-row !items-start flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold truncate">{link.label}</p>
                      <span className={`badge ${link.active ? "badge-valid" : "badge-revoked"}`}>
                        {link.revoked ? "Revoked" : link.active ? "Active" : "Expired"}
                      </span>
                      {link.anonymized && <span className="badge badge-info">Name withheld</span>}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {credential ? `${credential.degreeType} · ${credential.major}` : "Credential"} ·{" "}
                      {link.viewCount} view{link.viewCount === 1 ? "" : "s"} ·{" "}
                      {link.expiresAt
                        ? `expires ${new Date(link.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`
                        : "never expires"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => copy(link.url, "Link copied")}
                      className="btn-secondary !py-1.5 !px-3 !text-[11px]"
                      disabled={!link.active}
                    >
                      Copy
                    </button>
                    {!link.revoked && (
                      <button
                        onClick={() => revokeShareLink(link.token)}
                        className="btn-danger !py-1.5 !px-3 !text-[11px]"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share modal */}
      <AnimatePresence>
        {sharing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSharing(null)} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative glass-card-static p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold mb-1">Share this credential</h3>
              <p className="text-xs text-zinc-500 mb-5">
                {sharing.degreeType} in {sharing.major}. A share link proves the qualification
                without exposing your permanent credential URL.
              </p>

              <label className="input-label">Label (only you see this)</label>
              <input
                type="text"
                value={shareForm.label}
                onChange={(e) => setShareForm({ ...shareForm, label: e.target.value })}
                className="input-field mb-4"
                placeholder="Application — Acme Corp"
              />

              <label className="input-label">Link expires</label>
              <select
                value={shareForm.expiry}
                onChange={(e) => setShareForm({ ...shareForm, expiry: e.target.value })}
                className="input-field mb-4"
              >
                <option value="24h">In 24 hours</option>
                <option value="7d">In 7 days</option>
                <option value="30d">In 30 days</option>
                <option value="never">Never</option>
              </select>

              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={shareForm.anonymized}
                  onChange={(e) => setShareForm({ ...shareForm, anonymized: e.target.checked })}
                  className="mt-0.5 accent-white"
                />
                <span className="text-xs text-zinc-400 leading-relaxed">
                  Withhold my name and wallet address. The verifier still sees the degree, the
                  institution, and a valid issuer signature — useful for anonymous screening.
                </span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => setSharing(null)} className="btn-secondary flex-1 !py-2.5">
                  Cancel
                </button>
                <button onClick={createShareLink} className="btn-primary flex-1 !py-2.5" disabled={shareBusy}>
                  {shareBusy ? <ButtonSpinner /> : "Create link"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
