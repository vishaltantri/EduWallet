"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { ButtonSpinner } from "@/components/LoadingSpinner";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Open a recovery request on behalf of a student who has lost their wallet.
 *
 * Only a nominated guardian can do this, and it is deliberately not instant:
 * the request needs the student's other guardians to agree and then sits for
 * 24 hours, during which the student can cancel it. The form says so, because
 * a registrar using it needs to set the student's expectations.
 */
export function RecoveryInitiate({ onCreated }: { onCreated?: () => void }) {
  const { authFetch } = useAuth();
  const { showToast } = useToast();
  const [studentEmail, setStudentEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const email = studentEmail.trim().toLowerCase();
    const address = newAddress.trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter the student's account email address");
      return;
    }
    if (!ADDRESS_PATTERN.test(address)) {
      setError("Enter the student's new wallet address — 0x followed by 40 hex characters");
      return;
    }

    setBusy(true);
    try {
      const res = await authFetch("/api/recovery/requests", {
        method: "POST",
        body: JSON.stringify({ studentEmail: email, newAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open the request");

      showToast(data.message ?? "Recovery request opened", "success");
      setStudentEmail("");
      setNewAddress("");
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open the request";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card-static p-6">
      <h2 className="text-base font-bold mb-1.5">Start a recovery</h2>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">
        For a student who nominated your institution as a guardian and has lost access to their
        wallet. Your request counts as the first approval. The student&apos;s other guardians must
        reach the threshold they chose, and a 24-hour delay then runs during which the student can
        cancel.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="input-label" htmlFor="recovery-email">
            Student account email
          </label>
          <input
            id="recovery-email"
            type="email"
            value={studentEmail}
            onChange={(event) => setStudentEmail(event.target.value)}
            className="input-field"
            placeholder="student@university.edu"
            required
          />
        </div>
        <div>
          <label className="input-label" htmlFor="recovery-address">
            New wallet address
          </label>
          <input
            id="recovery-address"
            type="text"
            value={newAddress}
            onChange={(event) => setNewAddress(event.target.value)}
            className="input-field font-mono !text-xs"
            placeholder="0x…"
            required
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary !py-2 !px-4 !text-xs">
        {busy ? <ButtonSpinner /> : "Open recovery request"}
      </button>
    </form>
  );
}
