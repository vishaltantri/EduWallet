import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { findShareLink, updateShareLink } from "@/lib/stores";

/** Revoke a share link. Takes effect on the verifier's next page load. */
export async function DELETE(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const { token } = await params;
    const link = await findShareLink(token);
    if (!link) return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    if (link.ownerId !== user.id) {
      return NextResponse.json({ error: "Not your share link" }, { status: 403 });
    }

    await updateShareLink(token, { revoked: true });
    return NextResponse.json({ message: "Share link revoked" });
  } catch (error) {
    console.error("Share revoke error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
