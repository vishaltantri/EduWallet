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
  if (!PINATA_JWT) {
    console.warn("PINATA_JWT is missing, using fallback hash format");
    return `QmFallback${Date.now()}`;
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
export function getIPFSGatewayURL(ipfsHash: string): string {
  if (ipfsHash.startsWith("ipfs://")) {
    ipfsHash = ipfsHash.replace("ipfs://", "");
  }
  const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${ipfsHash}`;
}
