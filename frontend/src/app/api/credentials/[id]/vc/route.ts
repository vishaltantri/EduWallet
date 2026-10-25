import { NextResponse } from "next/server";
import { authenticate, baseUrlFrom } from "@/lib/auth";
import { findCredentialById } from "@/lib/stores";
import { toVerifiableCredential } from "@/lib/credential";
import { ownsAddress } from "@/lib/models";

/**
 * Download the credential as a W3C Verifiable Credential document.
 *
 * Readable by the holder, the issuer, or anyone at all once the credential is
 * public — the VC carries no secrets, only the signed facts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const credential = await findCredentialById(id);
    if (!credential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const user = await authenticate(request);
    const isOwner =
      Boolean(user) &&
      (ownsAddress(user!, credential.studentAddress) ||
        ownsAddress(user!, credential.issuerAddress));

    const document = toVerifiableCredential(credential, {
      baseUrl: baseUrlFrom(request),
      anonymized: false,
    });

    const filename = `eduwallet-credential-${credential.tokenId}.jsonld`;
    return new NextResponse(JSON.stringify(document, null, 2), {
      headers: {
        "Content-Type": "application/ld+json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": isOwner ? "private, no-store" : "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("VC export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
