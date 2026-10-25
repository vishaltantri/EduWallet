import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { toPublicUser } from "@/lib/models";

/**
 * Session probe.
 *
 * The client used to trust whatever it found in localStorage, so an expired
 * 24h token left a "signed in" UI whose every request 401'd — dashboards just
 * rendered empty. The app now validates on mount and signs out on a 401.
 */
export async function GET(request: Request) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
  return NextResponse.json({ user: toPublicUser(user) });
}
