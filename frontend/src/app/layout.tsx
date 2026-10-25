import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { SystemStatusProvider } from "@/components/SystemStatus";
import { SessionNotice } from "@/components/SessionNotice";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "EduWallet — Decentralized Academic Credentials",
  description:
    "Issue, manage, and verify tamper-proof academic credentials using soulbound tokens, issuer signatures, and IPFS.",
  openGraph: {
    title: "EduWallet — Decentralized Academic Credentials",
    description:
      "Cryptographically signed academic certificates that anyone can verify in seconds, with no login and no phone calls to a registrar.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="w-full min-h-screen bg-black text-white antialiased">
        <AuthProvider>
          <SystemStatusProvider>
            <ToastProvider>
              <Navbar />
              <SessionNotice />
              <div className="w-full pt-16 min-h-[calc(100vh-4rem)]">{children}</div>
              <Footer />
            </ToastProvider>
          </SystemStatusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
