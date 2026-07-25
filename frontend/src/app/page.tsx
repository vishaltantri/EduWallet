"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="w-full bg-black text-white">
      {/* ─── Hero Section ─── */}
      <section className="enterprise-section py-16 sm:py-24">
        <div className="enterprise-container">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-800 bg-zinc-900 mb-6 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Polygon Amoy Testnet • Soulbound ERC-5192 Credentials</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight text-center-force">
            Academic Credentials Secured on Blockchain
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed text-center-force">
            Issue tamper-proof soulbound certificates for graduates. Verify credentials instantly with a public link — no crypto wallets, seed phrases, or gas fees required for users.
          </p>

          {/* CTA Buttons */}
          <div className="flex-center-force flex-col sm:flex-row mb-12">
            <Link href="/register" className="btn-primary w-full sm:w-auto !py-3 !px-6 !text-sm">
              Get Started Free →
            </Link>
            <Link href="/verify/demo" className="btn-secondary w-full sm:w-auto !py-3 !px-6 !text-sm">
              View Demo Verification
            </Link>
          </div>

          {/* Tech Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-16">
            <span className="text-xs text-zinc-500 font-medium mr-2">Tech Stack:</span>
            {["Polygon L2", "IPFS Pinata", "Soulbound ERC-5192", "AES-256-GCM", "OpenZeppelin v5"].map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-900 text-zinc-300 border border-zinc-800">
                {tag}
              </span>
            ))}
          </div>

          {/* Hero Digital Certificate Mockup Card */}
          <div className="w-full max-w-2xl mx-auto text-left border border-zinc-800 bg-zinc-950 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white text-black font-bold flex items-center justify-center text-base">
                  E
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">EduWallet University</h4>
                  <p className="text-xs text-zinc-400 font-medium">Official Institutional Issuer</p>
                </div>
              </div>
              <span className="badge badge-valid">Verified On-Chain</span>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">Official Degree Certificate</p>
                <p className="text-lg font-bold text-white">Bachelor of Science in Computer Science</p>
                <p className="text-xs text-zinc-300 mt-1">Conferred upon Jane Smith</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-500 block text-[11px]">Token Standard</span>
                  <span className="font-semibold text-zinc-200 font-mono">ERC-5192 (Soulbound)</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-500 block text-[11px]">Blockchain Network</span>
                  <span className="font-semibold text-zinc-200 font-mono">Polygon Amoy</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-zinc-800 text-xs text-zinc-400 font-mono gap-2">
              <span>Token ID: #1042</span>
              <span>Issuer: 0x742d35...bD38</span>
              <span className="text-zinc-300">IPFS: QmX87a...92b</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="enterprise-section border-y border-zinc-800 bg-zinc-950 py-10">
        <div className="enterprise-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "< $0.01", label: "Per Certificate Issued" },
              { value: "< 2 Seconds", label: "On-Chain Verification" },
              { value: "100%", label: "Tamper-Proof Soulbound" },
              { value: "Zero", label: "Web3 Setup Needed" },
            ].map((stat) => (
              <div key={stat.label} className="p-2">
                <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{stat.value}</p>
                <p className="text-xs sm:text-sm text-zinc-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Key Features ─── */}
      <section className="enterprise-section py-16 sm:py-24">
        <div className="enterprise-container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge badge-info mb-3">Enterprise Core Features</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 text-center-force">
              Built for Usability, Security & Scale
            </h2>
            <p className="text-zinc-400 text-base text-center-force">
              EduWallet bridges academic institutions and blockchain technology without the friction of traditional Web3 apps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              {
                title: "Soulbound Certificates",
                desc: "Certificates are minted as non-transferable NFTs (ERC-5192). Once bound to a student's account, they cannot be sold or transferred.",
              },
              {
                title: "No Seed Phrase Complexity",
                desc: "Users login with email and password. Server-managed accounts encrypt private keys client-side using AES-256-GCM.",
              },
              {
                title: "Social Recovery",
                desc: "Lost account access? M-of-N social recovery with university guardians (registrar, advisor) restores account access safely.",
              },
              {
                title: "Instant Verification",
                desc: "Employers verify credentials via a shareable link. On-chain validation queries Polygon in real time with zero gas cost.",
              },
              {
                title: "Near-Zero Cost",
                desc: "Built on Polygon L2. Certificate issuance costs fractions of a cent versus $50–200 for traditional notarization.",
              },
              {
                title: "Decentralized IPFS Storage",
                desc: "Metadata and certificates are permanently stored on IPFS via Pinata, ensuring perpetual access independent of servers.",
              },
            ].map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-colors">
                <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="enterprise-section py-16 sm:py-24 border-t border-zinc-800 bg-zinc-950">
        <div className="enterprise-container">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="badge badge-purple mb-3">Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 text-center-force">How EduWallet Works</h2>
            <p className="text-zinc-400 text-base text-center-force">Three simple steps from issuance to public verification.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                step: "01",
                title: "University Issues",
                desc: "University staff enters graduate details. EduWallet mints a soulbound NFT on Polygon and pins metadata to IPFS.",
              },
              {
                step: "02",
                title: "Student Receives",
                desc: "Student sees the credential on their dashboard, manages guardians, and generates shareable verification links.",
              },
              {
                step: "03",
                title: "Employer Verifies",
                desc: "Employers open the link to instantly view verified degree details and smart contract cryptographic proof.",
              },
            ].map((step) => (
              <div key={step.step} className="p-6 rounded-xl bg-black border border-zinc-800">
                <span className="text-2xl font-bold font-mono text-zinc-500 block mb-3">{step.step}</span>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Comparison Table ─── */}
      <section className="enterprise-section py-16 sm:py-24 border-t border-zinc-800">
        <div className="enterprise-container">
          <div className="text-center mb-12">
            <span className="badge badge-info mb-3">Comparison</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 text-center-force">
              Traditional vs. EduWallet Verification
            </h2>
            <p className="text-zinc-400 text-sm text-center-force">Comparing legacy database systems with Soulbound Blockchain Credentials.</p>
          </div>

          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 text-left">
            <div className="grid grid-cols-3 bg-zinc-900 p-4 border-b border-zinc-800 font-bold text-xs sm:text-sm text-white">
              <div>Feature</div>
              <div className="text-zinc-400">Traditional Systems</div>
              <div className="text-white">EduWallet (Polygon)</div>
            </div>

            {[
              { f: "Verification Time", t: "3 to 15 Days (Manual)", e: "< 2 Seconds (Instant)" },
              { f: "Cost per Verification", t: "$25 – $100 Per Request", e: "< $0.001 (On-Chain)" },
              { f: "Forgery Risk", t: "High (Photoshop / Paper)", e: "Zero (Cryptographic Proof)" },
              { f: "Data Storage", t: "Centralized DB", e: "Immutable Blockchain + IPFS" },
              { f: "Account Recovery", t: "Single Password / Helpdesk", e: "M-of-N Guardian Social Recovery" },
            ].map((row, idx) => (
              <div key={row.f} className={`grid grid-cols-3 p-4 text-xs sm:text-sm border-b border-zinc-800/60 ${idx % 2 === 0 ? "bg-black" : "bg-zinc-950"}`}>
                <div className="font-semibold text-zinc-200">{row.f}</div>
                <div className="text-zinc-400">{row.t}</div>
                <div className="text-white font-semibold">{row.e}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="enterprise-section py-16 sm:py-20 border-t border-zinc-800 bg-zinc-950">
        <div className="enterprise-container">
          <div className="p-8 sm:p-12 rounded-2xl border border-zinc-800 bg-black">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4 text-center-force">Transform Your Institution&apos;s Credentials</h2>
            <p className="text-zinc-400 text-sm mb-8 max-w-xl mx-auto text-center-force">
              Join universities issuing verifiable, tamper-proof diplomas on the Polygon blockchain.
            </p>
            <div className="flex-center-force flex-col sm:flex-row">
              <Link href="/register" className="btn-primary w-full sm:w-auto !py-3 !px-6 !text-sm">
                Create Account →
              </Link>
              <Link href="/login" className="btn-secondary w-full sm:w-auto !py-3 !px-6 !text-sm">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
