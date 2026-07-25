import { ethers } from "ethers";
import SoulboundCertificateABI from "./contracts/SoulboundCertificate.json";
import CredentialRegistryABI from "./contracts/CredentialRegistry.json";
import RecoveryManagerABI from "./contracts/RecoveryManager.json";

// ─── Contract Addresses (set after deployment) ───
const CONTRACTS = {
  SoulboundCertificate: process.env.NEXT_PUBLIC_SOULBOUND_ADDRESS || "",
  CredentialRegistry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "",
  RecoveryManager: process.env.NEXT_PUBLIC_RECOVERY_ADDRESS || "",
};

// ─── RPC Provider ───
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology";

export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getSigner(privateKey: string) {
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
}

// ─── Contract Instances (read-only) ───
export function getSoulboundContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.SoulboundCertificate,
    SoulboundCertificateABI,
    signerOrProvider || getProvider()
  );
}

export function getRegistryContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.CredentialRegistry,
    CredentialRegistryABI,
    signerOrProvider || getProvider()
  );
}

export function getRecoveryContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    CONTRACTS.RecoveryManager,
    RecoveryManagerABI,
    signerOrProvider || getProvider()
  );
}

// ─── On-Chain Operations ───

/**
 * Issue a certificate on-chain.
 * Called by university staff's server-managed wallet.
 */
export async function issueCertificateOnChain(
  issuerPrivateKey: string,
  studentAddress: string,
  metadataURI: string
): Promise<{ tokenId: number; txHash: string }> {
  const signer = getSigner(issuerPrivateKey);
  const contract = getSoulboundContract(signer);

  const tx = await contract.issueCertificate(studentAddress, metadataURI);
  const receipt = await tx.wait();

  // Parse the CertificateIssued event to get the tokenId
  const event = receipt.logs
    .map((log: ethers.Log) => {
      try {
        return contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((e: ethers.LogDescription | null) => e?.name === "CertificateIssued");

  const tokenId = event ? Number(event.args.tokenId) : 0;
  return { tokenId, txHash: receipt.hash };
}

/**
 * Verify a certificate on-chain (read-only, no gas).
 */
export async function verifyCertificateOnChain(tokenId: number) {
  const contract = getSoulboundContract();

  try {
    const [isValid, student, issuer, metadataURI, issuedAt] =
      await contract.verifyCertificate(tokenId);

    return {
      isValid,
      student,
      issuer,
      metadataURI,
      issuedAt: new Date(Number(issuedAt) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Register credential metadata on-chain.
 */
export async function registerCredentialOnChain(
  issuerPrivateKey: string,
  tokenId: number,
  studentAddress: string,
  studentName: string,
  degreeType: string,
  major: string,
  ipfsHash: string
): Promise<string> {
  const signer = getSigner(issuerPrivateKey);
  const registry = getRegistryContract(signer);

  const tx = await registry.registerCredential(
    tokenId,
    studentAddress,
    studentName,
    degreeType,
    major,
    ipfsHash
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Setup guardians for social recovery.
 */
export async function setupGuardiansOnChain(
  studentPrivateKey: string,
  guardianAddresses: string[],
  threshold: number
): Promise<string> {
  const signer = getSigner(studentPrivateKey);
  const recovery = getRecoveryContract(signer);

  const tx = await recovery.setupGuardians(guardianAddresses, threshold);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Check if contracts are deployed and accessible.
 */
export async function checkContractHealth(): Promise<{
  soulbound: boolean;
  registry: boolean;
  recovery: boolean;
}> {
  const result = { soulbound: false, registry: false, recovery: false };

  try {
    if (CONTRACTS.SoulboundCertificate) {
      const contract = getSoulboundContract();
      await contract.name();
      result.soulbound = true;
    }
  } catch { /* not deployed */ }

  try {
    if (CONTRACTS.CredentialRegistry) {
      const contract = getRegistryContract();
      await contract.totalCredentials();
      result.registry = true;
    }
  } catch { /* not deployed */ }

  try {
    if (CONTRACTS.RecoveryManager) {
      const contract = getRecoveryContract();
      await contract.RECOVERY_COOLDOWN();
      result.recovery = true;
    }
  } catch { /* not deployed */ }

  return result;
}
