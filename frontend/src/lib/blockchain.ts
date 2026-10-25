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

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology";

/**
 * A localhost RPC is the Hardhat default and is never reachable from a
 * deployed instance. Detecting it lets the app say "no chain configured for
 * this environment" instead of hanging on a connection that cannot succeed.
 */
const isLocalRpc = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)/.test(RPC_URL);
const isServerless = process.env.VERCEL === "1";

/** On-chain writes are best-effort; never let one stall a request. */
const CHAIN_TIMEOUT_MS = Number(process.env.CHAIN_TIMEOUT_MS || 12000);

export function isChainConfigured(): boolean {
  if (!CONTRACTS.SoulboundCertificate) return false;
  if (isServerless && isLocalRpc) return false;
  return true;
}

export function chainSettings() {
  return {
    rpcUrl: RPC_URL,
    contracts: CONTRACTS,
    configured: isChainConfigured(),
    localOnly: isLocalRpc,
    explorerBase: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://amoy.polygonscan.com",
  };
}

/**
 * One provider for the process.
 *
 * A fresh provider per call meant every read opened its own connection and,
 * worse, kept its own view of the chain head — which is how two relayer
 * transactions in the same request ended up reusing a nonce.
 */
let sharedProvider: ethers.JsonRpcProvider | undefined;

export function getProvider() {
  if (!sharedProvider) sharedProvider = new ethers.JsonRpcProvider(RPC_URL);
  return sharedProvider;
}

/**
 * Signers are memoised and nonce-managed per key.
 *
 * Issuance sends two transactions from the institution's wallet back to back
 * (mint, then the registry entry). A fresh wallet for each asked the node for
 * the nonce every time and a cached chain head handed out the same one twice,
 * so the registry write was rejected as "nonce too low" and the credential
 * was never mirrored on chain.
 */
const signers = new Map<string, ethers.NonceManager>();

export function getSigner(privateKey: string): ethers.NonceManager {
  const existing = signers.get(privateKey);
  if (existing) return existing;

  const signer = new ethers.NonceManager(new ethers.Wallet(privateKey, getProvider()));
  signers.set(privateKey, signer);
  return signer;
}

/** Drop a signer's cached nonce after a failed send. */
function resetSigner(privateKey: string) {
  signers.get(privateKey)?.reset();
}

// ─── Platform relayer ───────────────────────────────────────────────────────

/**
 * The deploying wallet's key, held server-side only.
 *
 * Without it the on-chain path cannot work at all, and used to fail silently:
 * `SoulboundCertificate.issueCertificate` is `onlyIssuer`, institutions get a
 * freshly generated wallet when they register, and nothing ever called
 * `authorizeIssuer`. Every mint therefore reverted with `NotIssuer` and the
 * certificate was recorded as "anchoring pending" forever, while the UI and
 * README implied anchoring worked whenever the RPC was reachable.
 *
 * The relayer closes that gap: it authorizes a new institution on its first
 * issuance and tops up its gas, so the institution's own wallet still signs
 * the mint. That matters — the certificate's on-chain issuer must be the same
 * address that signed the content hash, or verification cannot corroborate
 * one against the other.
 */
const PLATFORM_PRIVATE_KEY = process.env.PLATFORM_PRIVATE_KEY || "";

/** Gas floor for an institution wallet, in native currency. */
const ISSUER_GAS_FLOOR = process.env.ISSUER_GAS_FLOOR || "0.05";
const ISSUER_GAS_TOPUP = process.env.ISSUER_GAS_TOPUP || "0.1";

export function isPlatformRelayerConfigured(): boolean {
  return Boolean(PLATFORM_PRIVATE_KEY) && isChainConfigured();
}

/**
 * The relayer signer, wrapped in a nonce manager and used through a queue.
 *
 * Onboarding an institution sends two or three transactions back to back
 * (authorize, register, fund). Signing each from a plain wallet made ethers
 * ask the node for the nonce every time, and a cached chain head handed out
 * the same nonce twice — the second transaction was then rejected as
 * "nonce too low" and issuance silently fell back to "anchoring pending".
 */
let platformNonceManager: ethers.NonceManager | undefined;

function platformSigner(): ethers.NonceManager {
  if (!PLATFORM_PRIVATE_KEY) throw new Error("PLATFORM_PRIVATE_KEY is not configured");
  if (!platformNonceManager) {
    platformNonceManager = new ethers.NonceManager(getSigner(PLATFORM_PRIVATE_KEY));
  }
  return platformNonceManager;
}

/**
 * Serialise relayer work.
 *
 * Two institutions issuing at the same moment would otherwise interleave
 * their onboarding transactions and fight over the relayer's nonce.
 */
let relayQueue: Promise<unknown> = Promise.resolve();

function viaRelayer<T>(work: () => Promise<T>): Promise<T> {
  const result = relayQueue.then(work, work);
  // Keep the chain alive after a rejection so one failure does not poison
  // every later relayer call.
  relayQueue = result.catch(() => undefined);
  return result;
}

/** Reset the cached nonce after a failure, so the next attempt re-reads it. */
function resetRelayerNonce() {
  platformNonceManager?.reset();
}

export interface IssuerOnboarding {
  authorized: boolean;
  registered: boolean;
  funded: boolean;
  /** Why onboarding could not complete, when it could not. */
  error?: string;
}

/**
 * Make an institution wallet able to mint: authorized on the certificate
 * contract, registered on the credential registry, and holding enough gas.
 *
 * Idempotent, and cheap when there is nothing to do — the three reads are
 * view calls, so a second issuance by the same institution sends no
 * transactions.
 */
export async function ensureIssuerOnboarded(
  issuerAddress: string,
  institutionName: string
): Promise<IssuerOnboarding> {
  const result: IssuerOnboarding = { authorized: false, registered: false, funded: false };

  if (!isChainConfigured()) {
    result.error = "No reachable contract configured for this environment";
    return result;
  }
  if (!PLATFORM_PRIVATE_KEY) {
    result.error =
      "PLATFORM_PRIVATE_KEY is not set, so new institutions cannot be authorized to mint on-chain";
    return result;
  }

  try {
    return await viaRelayer(async () => {
      const platform = platformSigner();
      const certificate = getSoulboundContract(platform);

      result.authorized = Boolean(
        await withTimeout(
          certificate.authorizedIssuers(issuerAddress) as Promise<boolean>,
          "authorizedIssuers"
        )
      );
      if (!result.authorized) {
        await send(certificate.authorizeIssuer(issuerAddress), "authorizeIssuer");
        result.authorized = true;
      }

      if (CONTRACTS.CredentialRegistry) {
        const registry = getRegistryContract(platform);
        result.registered = Boolean(
          await withTimeout(
            registry.isActiveIssuer(issuerAddress) as Promise<boolean>,
            "isActiveIssuer"
          )
        );
        if (!result.registered) {
          await send(
            registry.registerIssuer(issuerAddress, institutionName.slice(0, 120)),
            "registerIssuer"
          );
          result.registered = true;
        }
      }

      result.funded = await ensureGasUnqueued(issuerAddress);
      return result;
    });
  } catch (error) {
    resetRelayerNonce();
    result.error = error instanceof Error ? error.message : "Issuer onboarding failed";
    console.warn("[chain] issuer onboarding incomplete:", result.error);
    return result;
  }
}

/**
 * Top an institution wallet up to the gas floor from the platform wallet.
 *
 * Returns true when the wallet can pay for a transaction afterwards. A
 * platform wallet that is itself empty is reported rather than retried — on a
 * public testnet that needs a human at a faucet.
 */
export function ensureGas(address: string): Promise<boolean> {
  return viaRelayer(() => ensureGasUnqueued(address)).catch((error) => {
    resetRelayerNonce();
    throw error;
  });
}

/** The body of `ensureGas`, for callers already holding the relayer queue. */
async function ensureGasUnqueued(address: string): Promise<boolean> {
  const floor = ethers.parseEther(ISSUER_GAS_FLOOR);
  const provider = getProvider();
  const balance = await withTimeout(provider.getBalance(address), "getBalance");
  if (balance >= floor) return true;

  const platform = platformSigner();
  const topUp = ethers.parseEther(ISSUER_GAS_TOPUP);
  const platformBalance = await withTimeout(
    provider.getBalance(await platform.getAddress()),
    "platform getBalance"
  );
  if (platformBalance <= topUp) {
    throw new Error(
      "The platform wallet does not hold enough native currency to fund issuance gas"
    );
  }

  const tx = await withTimeout(platform.sendTransaction({ to: address, value: topUp }), "gas top-up");
  await withTimeout(tx.wait(), "gas top-up confirmation");
  return true;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${CHAIN_TIMEOUT_MS}ms`)), CHAIN_TIMEOUT_MS)
    ),
  ]);
}

/** Send a contract write and wait for its receipt, both under one timeout. */
async function send(
  call: Promise<unknown>,
  label: string
): Promise<ethers.ContractTransactionReceipt> {
  const tx = (await withTimeout(call, label)) as ethers.ContractTransactionResponse;
  const receipt = await withTimeout(tx.wait(), `${label} confirmation`);
  if (!receipt) throw new Error(`${label} produced no receipt`);
  return receipt;
}

// ─── Contract Instances ───

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

export interface AnchorResult {
  anchored: boolean;
  tokenId?: number;
  txHash?: string;
  error?: string;
}

/**
 * Mint the soulbound certificate on Polygon.
 *
 * Anchoring is optional by design: the credential is already hash-committed
 * and signed by the issuer before this runs, so a chain failure downgrades
 * the certificate's provenance claim rather than failing the issuance.
 */
export async function anchorCertificate(
  issuerPrivateKey: string,
  studentAddress: string,
  metadataURI: string
): Promise<AnchorResult> {
  if (!isChainConfigured()) {
    return { anchored: false, error: "No reachable contract configured for this environment" };
  }

  try {
    const contract = getSoulboundContract(getSigner(issuerPrivateKey));
    const receipt = await send(
      contract.issueCertificate(studentAddress, metadataURI),
      "issueCertificate"
    );

    const event = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((entry: ethers.LogDescription | null) => entry?.name === "CertificateIssued");

    return {
      anchored: true,
      tokenId: event ? Number(event.args.tokenId) : undefined,
      txHash: receipt.hash,
    };
  } catch (error) {
    resetSigner(issuerPrivateKey);
    const message = error instanceof Error ? error.message : "Unknown chain error";
    console.warn("[chain] anchoring skipped:", message);
    return { anchored: false, error: message };
  }
}

/** Burn/flag the certificate on-chain. Best-effort, same as anchoring. */
export async function revokeCertificateOnChain(
  issuerPrivateKey: string,
  tokenId: number
): Promise<AnchorResult> {
  if (!isChainConfigured()) {
    return { anchored: false, error: "No reachable contract configured for this environment" };
  }

  try {
    const contract = getSoulboundContract(getSigner(issuerPrivateKey));
    const receipt = await send(contract.revokeCertificate(tokenId), "revokeCertificate");
    return { anchored: true, txHash: receipt.hash };
  } catch (error) {
    resetSigner(issuerPrivateKey);
    const message = error instanceof Error ? error.message : "Unknown chain error";
    console.warn("[chain] revocation not anchored:", message);
    return { anchored: false, error: message };
  }
}

/** Read-only on-chain lookup used to corroborate an anchored credential. */
export async function verifyCertificateOnChain(tokenId: number) {
  if (!isChainConfigured()) return null;

  try {
    const contract = getSoulboundContract();
    const [isValid, student, issuer, metadataURI, issuedAt] = (await withTimeout(
      contract.verifyCertificate(tokenId) as Promise<unknown>,
      "verifyCertificate"
    )) as [boolean, string, string, string, bigint];

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

export async function registerCredentialOnChain(
  issuerPrivateKey: string,
  tokenId: number,
  studentAddress: string,
  studentName: string,
  degreeType: string,
  major: string,
  ipfsHash: string
): Promise<string | null> {
  if (!CONTRACTS.CredentialRegistry || !isChainConfigured()) return null;

  try {
    const registry = getRegistryContract(getSigner(issuerPrivateKey));
    const receipt = await send(
      registry.registerCredential(tokenId, studentAddress, studentName, degreeType, major, ipfsHash),
      "registerCredential"
    );
    return receipt.hash;
  } catch (error) {
    resetSigner(issuerPrivateKey);
    console.warn("[chain] registry entry skipped:", error);
    return null;
  }
}

export interface ChainWriteResult {
  txHash?: string;
  error?: string;
}

/**
 * Mirror a recovery request on RecoveryManager, signed by the initiating
 * guardian's own wallet — `initiateRecovery` is `onlyGuardianOf`, so it has
 * to come from a guardian address, not the relayer.
 */
export async function initiateRecoveryOnChain(
  guardianPrivateKey: string,
  account: string,
  newAddress: string
): Promise<ChainWriteResult> {
  return recoveryWrite(guardianPrivateKey, "initiateRecovery", (contract) =>
    contract.initiateRecovery(account, newAddress)
  );
}

/** Mirror a guardian's approval. Also `onlyGuardianOf`. */
export async function approveRecoveryOnChain(
  guardianPrivateKey: string,
  account: string
): Promise<ChainWriteResult> {
  return recoveryWrite(guardianPrivateKey, "approveRecovery", (contract) =>
    contract.approveRecovery(account)
  );
}

/**
 * Finalise the migration on-chain.
 *
 * `executeRecovery` is callable by anyone once the threshold and cooldown are
 * satisfied, so the platform relayer pays for it. A student who has lost
 * their wallet has no way to pay for it themselves, which is the whole
 * scenario this exists for.
 */
export async function executeRecoveryOnChain(account: string): Promise<ChainWriteResult> {
  if (!CONTRACTS.RecoveryManager || !isChainConfigured()) {
    return { error: "No reachable RecoveryManager configured for this environment" };
  }
  if (!PLATFORM_PRIVATE_KEY) {
    return { error: "No platform relayer key configured to pay for the migration transaction" };
  }

  try {
    const receipt = await viaRelayer(() =>
      send(getRecoveryContract(platformSigner()).executeRecovery(account), "executeRecovery")
    );
    return { txHash: receipt.hash };
  } catch (error) {
    resetRelayerNonce();
    const message = error instanceof Error ? error.message : "Unknown chain error";
    console.warn("[chain] recovery execution not anchored:", message);
    return { error: message };
  }
}

async function recoveryWrite(
  privateKey: string,
  label: string,
  call: (contract: ethers.Contract) => Promise<unknown>
): Promise<ChainWriteResult> {
  if (!CONTRACTS.RecoveryManager || !isChainConfigured()) {
    return { error: "No reachable RecoveryManager configured for this environment" };
  }

  try {
    const signer = getSigner(privateKey);
    // A guardian wallet is generated by this app and may never have held any
    // native currency, so it cannot pay for its own approval.
    if (PLATFORM_PRIVATE_KEY) await ensureGas(await signer.getAddress());

    const receipt = await send(call(getRecoveryContract(signer)), label);
    return { txHash: receipt.hash };
  } catch (error) {
    resetSigner(privateKey);
    const message = error instanceof Error ? error.message : "Unknown chain error";
    console.warn(`[chain] ${label} not anchored:`, message);
    return { error: message };
  }
}

export async function setupGuardiansOnChain(
  studentPrivateKey: string,
  guardianAddresses: string[],
  threshold: number
): Promise<ChainWriteResult> {
  return recoveryWrite(studentPrivateKey, "setupGuardians", (contract) =>
    contract.setupGuardians(guardianAddresses, threshold)
  );
}

export interface ChainHealth {
  configured: boolean;
  reachable: boolean;
  chainId?: number;
  blockNumber?: number;
  network: string;
  rpcUrl: string;
  explorerBase: string;
  contracts: { soulbound: boolean; registry: boolean; recovery: boolean };
  /**
   * Whether a platform relayer key is present. Without it no institution can
   * be authorized to mint, so anchoring is permanently unavailable however
   * healthy the RPC looks.
   */
  relayer: boolean;
  detail?: string;
}

export async function checkChainHealth(): Promise<ChainHealth> {
  const settings = chainSettings();
  const health: ChainHealth = {
    configured: settings.configured,
    reachable: false,
    network: "unknown",
    // The RPC URL can carry an API key; show only the host.
    rpcUrl: safeHost(settings.rpcUrl),
    explorerBase: settings.explorerBase,
    contracts: { soulbound: false, registry: false, recovery: false },
    relayer: Boolean(PLATFORM_PRIVATE_KEY),
  };

  if (!settings.configured) {
    health.detail = settings.localOnly
      ? "Configured for a local Hardhat node, which is not reachable from this deployment."
      : "No contract addresses configured.";
    return health;
  }

  try {
    const provider = getProvider();
    const [network, blockNumber] = await Promise.all([
      withTimeout(provider.getNetwork(), "getNetwork"),
      withTimeout(provider.getBlockNumber(), "getBlockNumber"),
    ]);
    health.reachable = true;
    health.chainId = Number(network.chainId);
    health.blockNumber = blockNumber;
    health.network = network.name === "unknown" ? `chain ${network.chainId}` : network.name;
  } catch (error) {
    health.detail = error instanceof Error ? error.message : "RPC unreachable";
    return health;
  }

  const probes: [keyof ChainHealth["contracts"], string, () => Promise<unknown>][] = [
    ["soulbound", CONTRACTS.SoulboundCertificate, () => getSoulboundContract().name()],
    ["registry", CONTRACTS.CredentialRegistry, () => getRegistryContract().totalCredentials()],
    ["recovery", CONTRACTS.RecoveryManager, () => getRecoveryContract().RECOVERY_COOLDOWN()],
  ];

  await Promise.all(
    probes.map(async ([key, address, probe]) => {
      if (!address) return;
      try {
        await withTimeout(probe(), `${key} probe`);
        health.contracts[key] = true;
      } catch {
        health.contracts[key] = false;
      }
    })
  );

  if (!health.relayer) {
    health.detail =
      "No platform relayer key is configured, so institutions cannot be authorized to mint. Certificates are still hashed and signed by the issuer.";
  }

  return health;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid RPC URL";
  }
}
