"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { ButtonSpinner } from "@/components/LoadingSpinner";

const MIN_LENGTH = 8;

/**
 * Change the account password.
 *
 * Worth saying in the UI rather than only in the code: the wallet key is
 * sealed under a key derived from the password, so changing it re-seals the
 * wallet. That is why the current password is required even though the user
 * is already signed in — without it the server cannot open the wallet to
 * re-seal it, and the account would keep its certificates but lose the key.
 */
export function PasswordChange() {
  const { authFetch, adoptToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const reset = () => {
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setDone(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const res = await authFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change your password");

      if (data.token) adoptToken(data.token as string);
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card-static p-6">
      <h2 className="text-base font-bold mb-1.5">Password</h2>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">
        Your wallet key is encrypted with your password, so changing it re-encrypts the wallet.
        You will need your current password to do it.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-secondary !py-2 !px-4 !text-xs">
          Change password
        </button>
      ) : (
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              <div className="alert alert-success text-xs">Your password has been changed.</div>
              <button onClick={reset} className="btn-secondary !py-2 !px-4 !text-xs">
                Close
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={submit}
              className="space-y-3 max-w-sm"
            >
              <div>
                <label className="input-label" htmlFor="current-password">
                  Current password
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="input-label" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_LENGTH}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="input-label" htmlFor="confirm-password">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="input-field"
                  required
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={busy} className="btn-primary !py-2 !px-4 !text-xs">
                  {busy ? <ButtonSpinner /> : "Save new password"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="btn-secondary !py-2 !px-4 !text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
