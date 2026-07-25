"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800 bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded bg-white text-black font-bold flex items-center justify-center text-xs">
                E
              </div>
              <span className="text-base font-bold text-white">EduWallet</span>
            </Link>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Decentralized academic credentials powered by blockchain technology. Soulbound NFTs on Polygon.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 mb-3 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              {[
                { label: "Features", href: "/#features" },
                { label: "How It Works", href: "/#how-it-works" },
                { label: "Demo Verify", href: "/verify/demo" },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-zinc-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Architecture */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 mb-3 uppercase tracking-wider">Architecture</h4>
            <ul className="space-y-2">
              {[
                { label: "Polygon Network", href: "#" },
                { label: "ERC-5192 Soulbound", href: "#" },
                { label: "IPFS Storage", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <span className="text-xs text-zinc-400">{link.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Security */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 mb-3 uppercase tracking-wider">Security</h4>
            <ul className="space-y-2">
              {[
                { label: "AES-256-GCM Encryption", href: "#" },
                { label: "Social Recovery", href: "#" },
                { label: "OpenZeppelin v5", href: "#" },
              ].map((link) => (
                <li key={link.label}>
                  <span className="text-xs text-zinc-400">{link.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© {currentYear} EduWallet — Academic Research Project on Polygon.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Polygon Amoy Testnet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
