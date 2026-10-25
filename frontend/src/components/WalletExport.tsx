"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { ButtonSpinner } from "@/components/LoadingSpinner";

/**
 * Self-custody escape hatch.
 *
 * A custodial wallet is convenient right up until the holder wants to leave
 * with their credentials. This reveals the wallet's private key after the user
 * re-enters their password — the key is derived from the password-sealed copy,
 * shown once, and never persisted anywhere by the browser.
 */
export function WalletExport() {
  const { user, authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
    setPrivateKey("");
    setError("");
    setCopied(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await authFetch("/api/auth/wallet-export", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      setPrivateKey(data.privateKey);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not access the clipboard — select the key and copy it manually.");
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="glass-card-static p-5">
        <h3 className="text-sm font-bold mb-1.5">Own your wallet outright</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          EduWallet holds your wallet so you never have to manage a seed phrase. That
          convenience should not be a lock-in: export the private key at any time and import
          it into MetaMask or any other wallet. Your credentials are soulbound to this
          address, so they travel with the key.
        </p>
        <button onClick={() => setOpen(true)} className="btn-secondary !py-2 !px-4 !text-xs">
          Export wallet key
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative glass-card-static p-6 max-w-md w-full"
            >
              {privateKey ? (
                <>
                  <h3 className="text-lg font-bold mb-2">Your private key</h3>
                  <div className="alert alert-warning mb-4 text-xs items-start">
                    <span>
                      Anyone with this key controls your wallet. Store it in a password
                      manager, never paste it into a website, and close this dialog when
                      you are done.
                    </span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Wallet address
                  </p>
                  <p className="text-[11px] font-mono text-zinc-300 break-all mb-3">
                    {user.walletAddress}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Private key
                  </p>
                  <p className="text-[11px] font-mono text-zinc-200 break-all p-3 rounded-lg bg-zinc-900 border border-zinc-800 select-all mb-4">
                    {privateKey}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={copyKey} className="btn-secondary flex-1 !py-2.5">
                      {copied ? "Copied!" : "Copy key"}
                    </button>
                    <button onClick={close} className="btn-primary flex-1 !py-2.5">
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={submit}>
                  <h3 className="text-lg font-bold mb-2">Confirm your password</h3>
                  <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
                    Your wallet key is sealed with a key derived from your password — the
                    server cannot open it without you typing the password again here.
                  </p>

                  {error && <div className="alert alert-error mb-4 text-xs">{error}</div>}

                  <label className="input-label">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field mb-5"
                    autoComplete="current-password"
                    required
                  />

                  <div className="flex gap-3">
                    <button type="button" onClick={close} className="btn-secondary flex-1 !py-2.5">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary flex-1 !py-2.5" disabled={busy || !password}>
                      {busy ? <ButtonSpinner /> : "Reveal key"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
