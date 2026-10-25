import { NextResponse } from "next/server";
import { authenticate, baseUrlFrom } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import {
  addShareLink,
  findCredentialById,
  getShareLinksForOwner,
  isShareLinkActive,
} from "@/lib/stores";
import { ownsAddress, type ShareLink } from "@/lib/models";

const EXPIRY_PRESETS: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  never: null,
};

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const links = await getShareLinksForOwner(user.id);
  const baseUrl = baseUrlFrom(request);

  return NextResponse.json({
    links: links
      .map((link) => ({ ...link, url: `${baseUrl}/verify/share/${link.token}`, active: isShareLinkActive(link) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

/**
 * Mint a scoped, expiring verification link.
 *
 * A plain `/verify/<id>` link is permanent and names the student. An employer
 * usually needs neither: they need to confirm one degree, once. A share link
 * can expire on its own and can withhold the holder's identity while still
 * proving the institution signed the qualification.
 */
export async function POST(request: Request) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { credentialId, label, expiry, anonymized } = await request.json();
    if (typeof credentialId !== "string" || !credentialId) {
      return NextResponse.json({ error: "credentialId is required" }, { status: 400 });
    }

    const credential = await findCredentialById(credentialId);
    if (!credential) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

    if (!ownsAddress(user, credential.studentAddress)) {
      return NextResponse.json(
        { error: "Only the credential holder can create share links" },
        { status: 403 }
      );
    }

    const existing = await getShareLinksForOwner(user.id);
    if (existing.filter(isShareLinkActive).length >= 25) {
      return NextResponse.json(
        { error: "You already have 25 active share links. Revoke one first." },
        { status: 429 }
      );
    }

    const expiryKey = typeof expiry === "string" && expiry in EXPIRY_PRESETS ? expiry : "30d";
    const ttl = EXPIRY_PRESETS[expiryKey];

    const link: ShareLink = {
      token: randomToken(18),
      credentialId,
      ownerId: user.id,
      label: (typeof label === "string" && label.trim().slice(0, 80)) || "Shared verification",
      createdAt: new Date().toISOString(),
      expiresAt: ttl === null ? null : new Date(Date.now() + ttl).toISOString(),
      anonymized: Boolean(anonymized),
      revoked: false,
      viewCount: 0,
    };

    await addShareLink(link);

    return NextResponse.json({
      message: "Share link created",
      link: { ...link, url: `${baseUrlFrom(request)}/verify/share/${link.token}`, active: true },
    });
  } catch (error) {
    console.error("Share link error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
