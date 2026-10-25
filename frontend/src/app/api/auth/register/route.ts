import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/stores";
import { toPublicUser } from "@/lib/models";
import { clientKey, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  try {
    sweepRateLimits();
    const limit = rateLimit(clientKey(request, "register"), 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many accounts created from this network. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { name, email, password, role, institutionName } = await request.json();
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedInstitution = typeof institutionName === "string" ? institutionName.trim() : "";

    if (!normalizedName || !normalizedEmail || typeof password !== "string" || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!["student", "university"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (role === "university" && !normalizedInstitution) {
      return NextResponse.json({ error: "Institution name is required" }, { status: 400 });
    }

    if (await findUserByEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const { user, token } = await createUser({
      name: normalizedName,
      email: normalizedEmail,
      password,
      role,
      institutionName: normalizedInstitution || undefined,
    });

    return NextResponse.json({ token, user: toPublicUser(user) });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
