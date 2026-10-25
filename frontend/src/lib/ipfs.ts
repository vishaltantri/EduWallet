const PINATA_JWT = process.env.PINATA_JWT || "";

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
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
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

    const data = await response.json();
    return data.IpfsHash; // Returns CID (e.g. Qm...)
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
    const response = await fetch("https://api.pinata.cloud/data/testAuthentication", {
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
