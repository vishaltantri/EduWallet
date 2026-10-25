import { NextResponse } from "next/server";
import { verifyJWT } from "./crypto";
import { findUserById } from "./stores";
import type { StoredUser, UserRole } from "./models";

/**
 * Resolve the caller from the Authorization header.
 *
 * Returns `undefined` for a missing, malformed, expired, or orphaned token —
 * callers should treat all four the same way (401) so the endpoint does not
 * leak which accounts exist.
 */
export async function authenticate(request: Request): Promise<StoredUser | undefined> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;

  const payload = verifyJWT(header.slice(7).trim());
  if (!payload || typeof payload.userId !== "string") return undefined;

  return findUserById(payload.userId);
}

export async function requireRole(
  request: Request,
  role: UserRole
): Promise<{ user: StoredUser } | { response: NextResponse }> {
  const user = await authenticate(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 }) };
  }
  if (user.role !== role) {
    return {
      response: NextResponse.json(
        { error: role === "university" ? "Only institution accounts can do this" : "Only student accounts can do this" },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export function isErrorResult(
  result: { user: StoredUser } | { response: NextResponse }
): result is { response: NextResponse } {
  return "response" in result;
}

/**
 * Coarse origin label for the verification log.
 *
 * Deliberately not the raw IP: the log is shown to students and institutions,
 * and a city-level hint is enough to spot "my transcript was checked by an
 * employer in Berlin" without storing anything personally identifying.
 */
export function originLabel(request: Request): string {
  const city = request.headers.get("x-vercel-ip-city");
  const country = request.headers.get("x-vercel-ip-country");
  if (city && country) return `${decodeURIComponent(city)}, ${country}`;
  if (country) return country;
  return "Unknown location";
}

export function baseUrlFrom(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}
