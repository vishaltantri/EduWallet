"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: "🛡️",
    title: "Soulbound Certificates",
    desc: "Non-transferable NFTs that can't be sold or faked. Your diploma, permanently linked to you.",
  },
  {
    icon: "🔑",
    title: "No Seed Phrases",
    desc: "Login with email and password. No crypto wallets, no 12-word phrases, no complexity.",
  },
  {
    icon: "🏛️",
    title: "Institutional Recovery",
    desc: "Lost access? Your university registrar and advisor can help recover your account securely.",
  },
  {
    icon: "✅",
    title: "Instant Verification",
    desc: "Share a single link. Employers verify your credentials in seconds — no login required.",
  },
  {
    icon: "💰",
    title: "Near-Zero Cost",
    desc: "Built on Polygon. Issuing a certificate costs fractions of a cent vs $50–200 for notarization.",
  },
  {
    icon: "🔗",
    title: "Truly Decentralized",
    desc: "No centralized database to hack. Credentials live on the blockchain and IPFS forever.",
  },
];

const stats = [
  { value: "$0.001", label: "per certificate" },
  { value: "2s", label: "verification time" },
  { value: "100%", label: "tamper-proof" },
  { value: "0", label: "seed phrases needed" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* ─── Hero Section ─── */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-medium text-blue-300">
                Deployed on Polygon Amoy Testnet
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight mb-6"
            >
              Academic Credentials{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                on the Blockchain
              </span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Issue tamper-proof certificates. Verify instantly. No crypto knowledge required.
              Built for students who have never owned a wallet.
            </motion.p>

            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/register" className="btn-primary !py-3 !px-8 !text-base">
                Get Started Free →
              </Link>
              <Link href="/verify/demo" className="btn-secondary !py-3 !px-8 !text-base">
                See Demo Verification
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="border-y border-[rgba(59,130,246,0.1)] bg-[rgba(10,22,40,0.5)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why <span className="text-blue-400">EduWallet</span>?
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every existing blockchain credential system fails on usability.
              We fixed that.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="glass-card p-6 group"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-100 group-hover:text-blue-300 transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-slate-400">Three simple steps. No crypto knowledge needed.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "University Issues",
                desc: "Authorized staff uploads the certificate. A soulbound NFT is minted on Polygon, and the PDF is stored on IPFS.",
                color: "from-blue-500 to-blue-600",
              },
              {
                step: "02",
                title: "Student Receives",
                desc: "The student sees the credential on their dashboard. They can share a verification link with anyone.",
                color: "from-cyan-500 to-cyan-600",
              },
              {
                step: "03",
                title: "Employer Verifies",
                desc: "One click on the link. No login needed. Instant on-chain verification with full certificate details.",
                color: "from-purple-500 to-purple-600",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className={`text-6xl font-black bg-gradient-to-b ${item.color} bg-clip-text text-transparent opacity-20 mb-4`}>
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
            <div className="relative">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                Join universities issuing verifiable, tamper-proof credentials on the blockchain.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register" className="btn-primary !py-3 !px-8 !text-base">
                  Create Account →
                </Link>
                <Link href="/login" className="btn-secondary !py-3 !px-8 !text-base">
                  Sign In
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[rgba(59,130,246,0.08)] py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            EduWallet — Built on Polygon • Soulbound Tokens • IPFS Storage •
            Open Source Research Project
          </p>
        </div>
      </footer>
    </div>
  );
}
