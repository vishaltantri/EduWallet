import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EduWallet — Decentralized Academic Credentials",
  description:
    "Issue, manage, and verify tamper-proof academic credentials on the blockchain. No seed phrases, no complexity — just secure, verifiable certificates.",
  keywords: [
    "blockchain",
    "academic credentials",
    "soulbound tokens",
    "decentralized",
    "university",
    "certificates",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <div className="bg-mesh" />
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
