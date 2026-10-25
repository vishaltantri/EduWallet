"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/**
 * Tells the user their session ended instead of leaving them on a page that
 * has quietly stopped working.
 */
export function SessionNotice() {
  const { sessionExpired } = useAuth();
  const pathname = usePathname();

  if (!sessionExpired || pathname === "/login" || pathname === "/register") return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 text-xs">
        <span className="text-amber-300">Your session expired. Sign in again to continue.</span>
        <Link href="/login" className="font-semibold text-amber-200 hover:text-white whitespace-nowrap">
          Sign in →
        </Link>
      </div>
    </div>
  );
}
