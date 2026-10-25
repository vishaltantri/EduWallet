"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PageLoader, ButtonSpinner } from "@/components/LoadingSpinner";
import { StorageWarning, useSystemStatus } from "@/components/SystemStatus";
import { useToast } from "@/components/Toast";
import { DegreeMixBars, IssuanceBarChart, type DegreeSlice, type MonthPoint } from "@/components/Charts";
import { PasswordChange } from "@/components/PasswordChange";
import { RecoveryInitiate } from "@/components/RecoveryInitiate";
import { RecoveryRequests } from "@/components/RecoveryRequests";

const DEGREE_TYPES = [
  "Bachelor of Science",
  "Bachelor of Arts",
  "Bachelor of Technology",
  "Bachelor of Commerce",
  "Master of Science",
  "Master of Arts",
  "Master of Technology",
  "Master of Business Administration",
  "Doctor of Philosophy",
  "Postgraduate Diploma",
  "Diploma",
  "Certificate",
  "Micro-credential",
  "Professional Certification",
];

const CSV_TEMPLATE = `email,name,degree,major,grade,completion_date
aisha@example.edu,Aisha Khan,Bachelor of Technology,Computer Science,First Class,2026-05-30
ravi@example.edu,Ravi Menon,Master of Science,Data Science,Distinction,2026-06-15`;

interface IssuedCredential {
  id: string;
  tokenId: number;
  studentName: string;
  studentEmail: string;
  studentAddress: string;
  degreeType: string;
  major: string;
  grade?: string;
  issuedAt: string;
  isValid: boolean;
  anchored?: boolean;
  txHash?: string;
  issuerSignature?: string;
  revokedAt?: string;
  revocationReason?: string;
  verificationCount: number;
}

interface Analytics {
  totals: {
    issued: number;
    active: number;
    revoked: number;
    anchored: number;
    signed: number;
    verifications: number;
    verificationsLast30Days: number;
    uniqueStudents: number;
  };
  issuanceByMonth: MonthPoint[];
  degreeMix: DegreeSlice[];
  mostVerified: {
    id: string;
    tokenId: number;
    studentName: string;
    degreeType: string;
    major: string;
    verifications: number;
  }[];
  recentVerifications: {
    id: string;
    verifiedAt: string;
    outcome: string;
    origin: string;
    studentName: string;
    degreeType: string;
  }[];
}

type Tab = "issue" | "bulk" | "manage" | "analytics" | "guardian" | "account";

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function loadIssuerData(
  authFetch: AuthFetch,
  walletAddress: string
): Promise<{ credentials: IssuedCredential[]; analytics: Analytics | null }> {
  try {
    const [credentialsRes, analyticsRes] = await Promise.all([
      authFetch(`/api/credentials/issuer/${walletAddress}`),
      authFetch("/api/analytics/issuer"),
    ]);

    return {
      credentials: credentialsRes.ok ? (await credentialsRes.json()).credentials ?? [] : [],
      analytics: analyticsRes.ok ? ((await analyticsRes.json()) as Analytics) : null,
    };
  } catch (error) {
    console.error("Failed to load institution dashboard:", error);
    return { credentials: [], analytics: null };
  }
}

export default function UniversityDashboard() {
  const { user, loading: authLoading, authFetch } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { status } = useSystemStatus();

  const [tab, setTab] = useState<Tab>("issue");
  const [issued, setIssued] = useState<IssuedCredential[]>([]);
  const [issuedLoading, setIssuedLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Single issuance
  const [form, setForm] = useState({
    studentEmail: "",
    studentName: "",
    degreeType: "",
    major: "",
    grade: "",
    completionDate: "",
  });
  const [issuing, setIssuing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState("");

  // Bulk issuance
  const [csv, setCsv] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReport, setBulkReport] = useState<{
    issued?: { email: string; tokenId: number }[];
    failed?: { email: string; reason: string }[];
    parsed?: number;
    errors?: string[];
    dryRun?: boolean;
  } | null>(null);

  // Revocation
  const [revoking, setRevoking] = useState<IssuedCredential | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [guardianRefresh, setGuardianRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "university")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const refresh = useCallback(() => {
    if (!user) return Promise.resolve();
    // See the student dashboard: state is set in the .then callback so nothing
    // is applied synchronously inside the mount effect.
    return loadIssuerData(authFetch, user.walletAddress).then((data) => {
      setIssued(data.credentials);
      setAnalytics(data.analytics);
      setIssuedLoading(false);
    });
  }, [authFetch, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return issued.filter((credential) => {
      const matchesQuery =
        !query ||
        credential.studentName.toLowerCase().includes(query) ||
        credential.studentEmail.toLowerCase().includes(query) ||
        credential.major.toLowerCase().includes(query) ||
        credential.degreeType.toLowerCase().includes(query) ||
        String(credential.tokenId) === query;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && credential.isValid) ||
        (statusFilter === "revoked" && !credential.isValid);
      return matchesQuery && matchesStatus;
    });
  }, [issued, search, statusFilter]);

  const handleIssueClick = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.studentEmail || !form.studentName || !form.degreeType || !form.major) {
      setError("Student email, name, degree type and major are all required");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmIssue = async () => {
    setShowConfirmModal(false);
    setError("");
    setIssuing(true);

    try {
      const res = await authFetch("/api/credentials/issue", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue");

      showToast(`Certificate #${data.tokenId} issued and signed`, "success");
      (data.warnings as string[] | undefined)?.forEach((warning) => showToast(warning, "warning"));
      setForm({ studentEmail: "", studentName: "", degreeType: "", major: "", grade: "", completionDate: "" });
      await refresh();
      setTab("manage");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to issue credential";
      setError(message);
      showToast(message, "error");
    } finally {
      setIssuing(false);
    }
  };

  const runBulk = async (dryRun: boolean) => {
    setBulkBusy(true);
    setBulkReport(null);
    try {
      const res = await authFetch("/api/credentials/bulk", {
        method: "POST",
        body: JSON.stringify({ csv, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkReport({ errors: data.errors || [data.error] });
        showToast(data.error || "Bulk issuance failed", "error");
        return;
      }
      setBulkReport(data);
      if (dryRun) {
        showToast(`${data.parsed} row(s) ready to issue`, data.errors?.length ? "warning" : "info");
      } else {
        showToast(data.message, "success");
        await refresh();
      }
    } catch {
      showToast("Bulk issuance failed", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revoking || !revokeReason.trim()) return;
    setRevokeBusy(true);
    try {
      const res = await authFetch(`/api/credentials/${revoking.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revocation failed");

      showToast(`Certificate #${revoking.tokenId} revoked`, "success");
      if (data.chainNote) showToast(data.chainNote, "info");
      setRevoking(null);
      setRevokeReason("");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Revocation failed", "error");
    } finally {
      setRevokeBusy(false);
    }
  };

  const copyVerifyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${id}`);
      showToast("Verification link copied", "success");
    } catch {
      showToast("Could not access the clipboard", "error");
    }
  };

  if (authLoading || !user) return <PageLoader label="Loading dashboard..." />;

  const totals = analytics?.totals;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StorageWarning />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              {user.institutionName || user.name}
            </h1>
            <p className="text-zinc-400 text-sm">
              Issue, revoke, and audit soulbound academic credentials
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-info">Institution</span>
            {status && !status.chain.reachable && (
              <span className="badge badge-pending" title={status.chain.detail}>
                Off-chain mode
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Total Issued" value={totals?.issued ?? issued.length} />
        <StatCard label="Active" value={totals?.active ?? issued.filter((c) => c.isValid).length} />
        <StatCard label="Revoked" value={totals?.revoked ?? issued.filter((c) => !c.isValid).length} />
        <StatCard
          label="Verifications"
          value={totals?.verifications ?? 0}
          hint={totals ? `${totals.verificationsLast30Days} in last 30 days` : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800 overflow-x-auto">
        {(
          [
            ["issue", "Issue Certificate"],
            ["bulk", "Bulk Upload"],
            ["manage", `Credentials${issued.length ? ` (${issued.length})` : ""}`],
            ["analytics", "Analytics"],
            ["guardian", "Guardianship"],
            ["account", "Account"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Issue ─── */}
      {tab === "issue" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="glass-card-static p-6">
              <h2 className="text-lg font-bold mb-1">Issue a Certificate</h2>
              <p className="text-xs text-zinc-500 mb-5">
                The certificate is hashed and signed with your institution wallet the moment it is
                created, so it stays verifiable even if the chain is unreachable.
              </p>

              {error && <div className="alert alert-error mb-4">{error}</div>}

              <form onSubmit={handleIssueClick} className="space-y-4">
                <div>
                  <label className="input-label">Student Email</label>
                  <input
                    type="email"
                    value={form.studentEmail}
                    onChange={(e) => setForm({ ...form, studentEmail: e.target.value })}
                    className="input-field"
                    placeholder="student@university.edu"
                    required
                  />
                  <p className="input-hint">The student must already have an EduWallet account.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Student Full Name</label>
                    <input
                      type="text"
                      value={form.studentName}
                      onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                      className="input-field"
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Degree Type</label>
                    <select
                      value={form.degreeType}
                      onChange={(e) => setForm({ ...form, degreeType: e.target.value })}
                      className="input-field"
                      required
                    >
                      <option value="">Select degree type</option>
                      {DEGREE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Major / Field of Study</label>
                    <input
                      type="text"
                      value={form.major}
                      onChange={(e) => setForm({ ...form, major: e.target.value })}
                      className="input-field"
                      placeholder="Computer Science"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">
                      Grade / Classification <span className="text-zinc-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      className="input-field"
                      placeholder="First Class · 8.7 CGPA"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">
                    Completion Date <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.completionDate}
                    onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
                    className="input-field"
                  />
                </div>

                <button type="submit" className="btn-primary w-full !py-3 !rounded-xl !text-sm" disabled={issuing}>
                  {issuing ? (
                    <span className="flex items-center justify-center gap-2">
                      <ButtonSpinner />
                      Signing certificate...
                    </span>
                  ) : (
                    "Review & Issue"
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <InfoPanel
              title="What happens when you issue"
              items={[
                "Metadata is pinned to IPFS and the CID recorded",
                "A keccak256 hash is taken over the certificate's facts",
                "Your institution wallet signs that hash (EIP-191)",
                "The certificate is anchored on Polygon when a node is reachable",
              ]}
            />
            <InfoPanel
              title="Why the signature matters"
              items={[
                "A verifier can recover your wallet address from the signature",
                "Changing one character of the certificate breaks the hash",
                "Verification works with no login and no call to your registrar",
              ]}
            />
          </div>
        </motion.div>
      )}

      {/* ─── Bulk ─── */}
      {tab === "bulk" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 glass-card-static p-6">
            <h2 className="text-lg font-bold mb-1">Bulk Issuance</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Paste a CSV to issue up to 100 certificates at once — a graduating cohort in one pass.
              Validate first to catch unregistered students before anything is minted.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              <button onClick={() => setCsv(CSV_TEMPLATE)} className="btn-secondary !py-1.5 !px-3 !text-[11px]">
                Load example
              </button>
              <label className="btn-secondary !py-1.5 !px-3 !text-[11px] cursor-pointer">
                Upload .csv
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) setCsv(await file.text());
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              spellCheck={false}
              className="input-field font-mono !text-[11px] leading-relaxed"
              placeholder={CSV_TEMPLATE}
            />
            <p className="input-hint mb-4">
              Required columns: <code>email</code>, <code>name</code>, <code>degree</code>,{" "}
              <code>major</code>. Optional: <code>grade</code>, <code>completion_date</code>.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => runBulk(true)}
                className="btn-secondary flex-1 !py-2.5"
                disabled={bulkBusy || !csv.trim()}
              >
                Validate only
              </button>
              <button
                onClick={() => runBulk(false)}
                className="btn-primary flex-1 !py-2.5"
                disabled={bulkBusy || !csv.trim()}
              >
                {bulkBusy ? <ButtonSpinner /> : "Issue all"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="glass-card-static p-6 min-h-[200px]">
              <h3 className="text-sm font-bold mb-3">Result</h3>
              {!bulkReport ? (
                <p className="text-xs text-zinc-500">
                  Run a validation pass to see what will happen before issuing.
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  {bulkReport.dryRun && (
                    <p className="text-emerald-400">{bulkReport.parsed} row(s) ready to issue.</p>
                  )}
                  {!!bulkReport.issued?.length && (
                    <div>
                      <p className="text-emerald-400 font-semibold mb-1">
                        Issued {bulkReport.issued.length}
                      </p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {bulkReport.issued.map((row) => (
                          <li key={row.tokenId} className="text-zinc-400 truncate">
                            #{row.tokenId} · {row.email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(!!bulkReport.failed?.length || !!bulkReport.errors?.length) && (
                    <div>
                      <p className="text-red-400 font-semibold mb-1">Needs attention</p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {bulkReport.errors?.map((reason) => (
                          <li key={reason} className="text-zinc-400">
                            {reason}
                          </li>
                        ))}
                        {bulkReport.failed?.map((row, index) => (
                          <li key={`${row.email}-${index}`} className="text-zinc-400">
                            {row.email}: {row.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Manage ─── */}
      {tab === "manage" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold">Issued Credentials</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, token #"
                className="input-field !py-2 !px-3 !text-xs sm:!w-56"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="input-field !py-2 !px-3 !text-xs !w-auto"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>

          {issuedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state !py-16">
              <h3 className="text-base font-bold mb-1">
                {issued.length ? "Nothing matches that filter" : "No credentials issued yet"}
              </h3>
              <p className="text-zinc-500 text-xs">
                {issued.length
                  ? "Try a different search term."
                  : "Use the Issue tab to create your first soulbound certificate."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((credential) => (
                <div key={credential.id} className="table-row !items-start flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold truncate">{credential.studentName}</p>
                      <span className={`badge ${credential.isValid ? "badge-valid" : "badge-revoked"}`}>
                        {credential.isValid ? "Active" : "Revoked"}
                      </span>
                      {credential.anchored ? (
                        <span className="badge badge-info">On-chain</span>
                      ) : credential.issuerSignature ? (
                        <span className="badge badge-info">Signed</span>
                      ) : (
                        <span className="badge badge-pending">Unsigned</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {credential.degreeType} · {credential.major}
                      {credential.grade ? ` · ${credential.grade}` : ""}
                    </p>
                    <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                      #{credential.tokenId} · {credential.studentEmail} ·{" "}
                      {new Date(credential.issuedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · verified {credential.verificationCount}×
                    </p>
                    {!credential.isValid && credential.revocationReason && (
                      <p className="text-[11px] text-red-400/80 mt-1">
                        Revoked: {credential.revocationReason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyVerifyLink(credential.id)}
                      className="btn-secondary !py-1.5 !px-3 !text-[11px]"
                    >
                      Copy link
                    </button>
                    <Link
                      href={`/verify/${credential.id}`}
                      className="btn-secondary !py-1.5 !px-3 !text-[11px]"
                    >
                      View
                    </Link>
                    {credential.isValid && (
                      <button
                        onClick={() => {
                          setRevoking(credential);
                          setRevokeReason("");
                        }}
                        className="btn-danger !py-1.5 !px-3 !text-[11px]"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Guardianship ─── */}
      {tab === "guardian" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <RecoveryRequests mode="guardian" key={guardianRefresh} />
          <RecoveryInitiate onCreated={() => setGuardianRefresh((value) => value + 1)} />
        </motion.div>
      )}

      {/* ─── Account ─── */}
      {tab === "account" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
          <div className="glass-card-static p-6">
            <h2 className="text-base font-bold mb-1.5">Institution wallet</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Every certificate your institution issues is signed by this wallet. A verifier
              recovers this address from the signature, so it is the thing that makes your
              certificates yours.
            </p>
            <p className="font-mono text-xs break-all text-zinc-300">{user.walletAddress}</p>
          </div>
          <PasswordChange />
        </motion.div>
      )}

      {/* ─── Analytics ─── */}
      {tab === "analytics" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {!analytics ? (
            <div className="skeleton h-48 w-full" />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card-static p-6">
                  <h3 className="text-sm font-bold mb-1">Certificates issued per month</h3>
                  <p className="text-[11px] text-zinc-500 mb-4">Last six months</p>
                  <IssuanceBarChart data={analytics.issuanceByMonth} />
                </div>
                <div className="glass-card-static p-6">
                  <h3 className="text-sm font-bold mb-1">Credential mix</h3>
                  <p className="text-[11px] text-zinc-500 mb-4">Share of issuance by degree type</p>
                  <DegreeMixBars data={analytics.degreeMix} />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <StatCard label="Unique students" value={analytics.totals.uniqueStudents} />
                <StatCard label="Signed" value={analytics.totals.signed} hint="Signature verified" />
                <StatCard label="Chain-anchored" value={analytics.totals.anchored} />
                <StatCard label="Verified 30d" value={analytics.totals.verificationsLast30Days} />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="glass-card-static p-6">
                  <h3 className="text-sm font-bold mb-4">Most-checked credentials</h3>
                  {analytics.mostVerified.length === 0 ? (
                    <p className="text-xs text-zinc-500">No verifications recorded yet.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {analytics.mostVerified.map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{entry.studentName}</p>
                            <p className="text-[11px] text-zinc-500 truncate">
                              {entry.degreeType} · {entry.major}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-zinc-300 flex-shrink-0">
                            {entry.verifications}×
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="glass-card-static p-6">
                  <h3 className="text-sm font-bold mb-1">Recent verification activity</h3>
                  <p className="text-[11px] text-zinc-500 mb-4">
                    Who is checking your certificates, and what they saw
                  </p>
                  {analytics.recentVerifications.length === 0 ? (
                    <p className="text-xs text-zinc-500">Nothing yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {analytics.recentVerifications.map((event) => (
                        <li key={event.id} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-zinc-400 truncate">
                            {event.studentName} · {event.origin}
                          </span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={
                                event.outcome === "valid"
                                  ? "text-emerald-400"
                                  : event.outcome === "revoked"
                                    ? "text-red-400"
                                    : "text-amber-400"
                              }
                            >
                              {event.outcome}
                            </span>
                            <span className="text-zinc-600">
                              {new Date(event.verifiedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Issue confirmation */}
      <AnimatePresence>
        {showConfirmModal && (
          <Modal onClose={() => setShowConfirmModal(false)}>
            <h3 className="text-lg font-bold mb-4">Confirm issuance</h3>
            <dl className="space-y-2.5 mb-5">
              <Row label="Student" value={form.studentName} />
              <Row label="Email" value={form.studentEmail} />
              <Row label="Degree" value={form.degreeType} />
              <Row label="Major" value={form.major} />
              {form.grade && <Row label="Grade" value={form.grade} />}
              {form.completionDate && <Row label="Completed" value={form.completionDate} />}
            </dl>
            <p className="text-xs text-zinc-500 mb-5">
              This mints a non-transferable certificate signed by{" "}
              {user.institutionName || user.name}. It can be revoked later, but not edited.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary flex-1 !py-2.5">
                Cancel
              </button>
              <button onClick={confirmIssue} className="btn-primary flex-1 !py-2.5">
                Confirm & Issue
              </button>
            </div>
          </Modal>
        )}

        {revoking && (
          <Modal onClose={() => setRevoking(null)}>
            <h3 className="text-lg font-bold mb-2">Revoke certificate #{revoking.tokenId}</h3>
            <p className="text-xs text-zinc-400 mb-4">
              {revoking.studentName} · {revoking.degreeType} in {revoking.major}
            </p>
            <p className="text-xs text-zinc-500 mb-4">
              Anyone holding a verification link will immediately see this certificate as revoked,
              along with the reason you give. The original signature is preserved.
            </p>
            <label className="input-label">Reason for revocation</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              className="input-field mb-5"
              placeholder="Issued in error — duplicate of certificate #14"
            />
            <div className="flex gap-3">
              <button onClick={() => setRevoking(null)} className="btn-secondary flex-1 !py-2.5">
                Cancel
              </button>
              <button
                onClick={confirmRevoke}
                className="btn-danger flex-1 !py-2.5"
                disabled={revokeBusy || !revokeReason.trim()}
              >
                {revokeBusy ? <ButtonSpinner /> : "Revoke certificate"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="stat-card">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="glass-card-static p-5">
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-xs text-zinc-400 leading-relaxed">
            <span className="text-zinc-600 mt-px">—</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-medium text-right truncate">{value}</dd>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="relative glass-card-static p-6 max-w-md w-full max-h-[85vh] overflow-y-auto"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
