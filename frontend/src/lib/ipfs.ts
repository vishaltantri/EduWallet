const PINATA_JWT = process.env.PINATA_JWT || "";

/**
 * Pinata's API base, overridable.
 *
 * Needed so the upload path can be exercised against a protocol-compatible
 * endpoint in tests, and so a self-hosted pinning service that speaks the
 * same API can be pointed at without a code change. Defaults to Pinata.
 */
const PINATA_API = (process.env.PINATA_API_URL || "https://api.pinata.cloud").replace(/\/$/, "");

export interface CredentialMetadata {
  name: string;
  description: string;
  image?: string;
  attributes: {
    trait_type: string;
    value: string;
  }[];
}

/**
 * Upload JSON metadata to IPFS via Pinata API
 */
export async function uploadJSONToIPFS(metadata: CredentialMetadata): Promise<string> {
  // Returning a made-up "Qm..." string here would put an IPFS CID on the
  // certificate that resolves to nothing. Fail instead and let the caller
  // record the metadata as local-only.
  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT is not configured");
  }

  try {
    const response = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `EduWallet_Cert_${metadata.name.replace(/\s+/g, "_")}`,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Pinata upload failed:", errText);
      throw new Error("Failed to upload metadata to Pinata IPFS");
    }

    const data = (await response.json()) as { IpfsHash?: string };
    // A response without a CID is a failure, not a successful pin: returning
    // undefined here would put an empty IPFS reference on the certificate.
    if (!data.IpfsHash) throw new Error("Pinata returned no IPFS hash");
    return data.IpfsHash;
  } catch (error) {
    console.error("IPFS Upload Error:", error);
    throw error;
  }
}

/**
 * Get public gateway URL for an IPFS CID
 */
export function isIPFSConfigured(): boolean {
  return Boolean(PINATA_JWT);
}

export function getIPFSGatewayURL(ipfsHash: string): string {
  if (ipfsHash.startsWith("ipfs://")) {
    ipfsHash = ipfsHash.replace("ipfs://", "");
  }
  const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${ipfsHash}`;
}

/**
 * Confirm the Pinata credentials actually work.
 *
 * A present-but-invalid JWT looks identical to a working one until the first
 * upload fails, which is exactly when it is least useful to find out.
 */
export async function checkIPFSHealth(): Promise<{ configured: boolean; reachable: boolean; detail?: string }> {
  if (!PINATA_JWT) return { configured: false, reachable: false, detail: "PINATA_JWT is not set" };

  try {
    const response = await fetch(`${PINATA_API}/data/testAuthentication`, {
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) return { configured: true, reachable: true };
    return { configured: true, reachable: false, detail: `Pinata rejected the key (${response.status})` };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      detail: error instanceof Error ? error.message : "Pinata unreachable",
    };
  }
}
