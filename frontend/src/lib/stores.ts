/**
 * Collection accessors on top of the storage adapter in `db.ts`.
 *
 * Everything is async because the durable backend speaks HTTP.
 */

import { Wallet } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { nextSequence, readCollection, writeCollection } from "./db";
import {
  createJWT,
  encryptForCustody,
  encryptPrivateKey,
  hashPassword,
  randomToken,
} from "./crypto";
import { ownsAddress, walletHistory } from "./models";
import type {
  RecoveryConfiguration,
  ShareLink,
  StoredCredential,
  StoredRecoveryRequest,
  StoredUser,
  UserRole,
  VerificationEvent,
  VerificationOutcome,
} from "./models";

const KEYS = {
  users: "users",
  credentials: "credentials",
  recovery: "recovery",
  recoveryRequests: "recovery_requests",
  verifications: "verifications",
  shares: "shares",
  tokenSequence: "seq:tokenId",
} as const;

/**
 * Verification log retention.
 *
 * The cap used to be 500 entries across every credential in the system, so a
 * single heavily checked certificate pushed everyone else's audit trail out
 * of the log — and the issuer analytics undercounted accordingly. Retention
 * is now bounded per credential first, with a global ceiling as a backstop.
 */
const MAX_EVENTS_PER_CREDENTIAL = 200;
const MAX_VERIFICATION_EVENTS = 5000;

// ─── Users ──────────────────────────────────────────────────────────────────

export function getUsers(): Promise<StoredUser[]> {
  return readCollection<StoredUser>(KEYS.users);
}

export function saveUsers(users: StoredUser[]): Promise<void> {
  return writeCollection(KEYS.users, users);
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const target = email.trim().toLowerCase();
  return (await getUsers()).find((user) => user.email.toLowerCase() === target);
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  return (await getUsers()).find((user) => user.id === id);
}

/**
 * Find the account that holds an address — including one it held before a
 * social recovery, so old credential links and public profiles keep working
 * after the holder migrates to a new wallet.
 */
export async function findUserByWallet(address: string): Promise<StoredUser | undefined> {
  const target = address.trim().toLowerCase();
  const users = await getUsers();
  return (
    users.find((user) => user.walletAddress.toLowerCase() === target) ??
    users.find((user) => ownsAddress(user, target))
  );
}

/** True when no other account already holds the address. */
export async function isWalletAddressAvailable(
  address: string,
  exceptUserId?: string
): Promise<boolean> {
  const target = address.trim().toLowerCase();
  const users = await getUsers();
  return !users.some((user) => user.id !== exceptUserId && ownsAddress(user, target));
}

/**
 * Credentials belonging to an account, across every address it has held.
 *
 * A credential's signature covers the address it was issued to, so recovery
 * cannot rewrite it. Lookups span the history instead.
 */
export async function getCredentialsForUser(user: StoredUser): Promise<StoredCredential[]> {
  const owned = new Set(walletHistory(user));
  return (await getCredentials()).filter((credential) =>
    owned.has(credential.studentAddress.toLowerCase())
  );
}

export async function updateUser(id: string, patch: Partial<StoredUser>): Promise<void> {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return;
  users[index] = { ...users[index], ...patch };
  await saveUsers(users);
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  institutionName?: string;
}): Promise<{ user: StoredUser; token: string }> {
  const wallet = Wallet.createRandom();
  const keySalt = randomToken(16);
  const sealed = encryptPrivateKey(wallet.privateKey, input.password, keySalt);

  const user: StoredUser = {
    id: uuidv4(),
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role,
    institutionName: input.role === "university" ? input.institutionName : undefined,
    passwordHash: hashPassword(input.password),
    walletAddress: wallet.address,
    encryptedPrivateKey: sealed.encrypted,
    iv: sealed.iv,
    authTag: sealed.authTag,
    keySalt,
    custody: encryptForCustody(wallet.privateKey),
    createdAt: new Date().toISOString(),
  };

  const users = await getUsers();
  users.push(user);
  await saveUsers(users);

  return { user, token: createJWT({ userId: user.id, role: user.role }) };
}

// ─── Credentials ────────────────────────────────────────────────────────────

export function getCredentials(): Promise<StoredCredential[]> {
  return readCollection<StoredCredential>(KEYS.credentials);
}

export function saveCredentials(credentials: StoredCredential[]): Promise<void> {
  return writeCollection(KEYS.credentials, credentials);
}

export async function findCredentialById(id: string): Promise<StoredCredential | undefined> {
  return (await getCredentials()).find((credential) => credential.id === id);
}

export async function addCredential(credential: StoredCredential): Promise<void> {
  const credentials = await getCredentials();
  credentials.push(credential);
  await saveCredentials(credentials);
}

export async function updateCredential(
  id: string,
  patch: Partial<StoredCredential>
): Promise<StoredCredential | undefined> {
  const credentials = await getCredentials();
  const index = credentials.findIndex((credential) => credential.id === id);
  if (index === -1) return undefined;
  credentials[index] = { ...credentials[index], ...patch };
  await saveCredentials(credentials);
  return credentials[index];
}

/**
 * Allocate a token ID.
 *
 * The previous implementation kept `nextTokenId` in a module-level variable
 * seeded once at import time. Two lambda instances therefore both started
 * from the same number and minted duplicate token IDs. The counter now lives
 * in the store, seeded from the highest ID already issued.
 */
export async function allocateTokenId(): Promise<number> {
  const credentials = await getCredentials();
  const highest = credentials.reduce((max, credential) => Math.max(max, credential.tokenId), 0);
  return nextSequence(KEYS.tokenSequence, highest);
}

// ─── Verification log ───────────────────────────────────────────────────────

export function getVerificationEvents(): Promise<VerificationEvent[]> {
  return readCollection<VerificationEvent>(KEYS.verifications);
}

export async function recordVerification(input: {
  credentialId: string;
  outcome: VerificationOutcome;
  origin: string;
  shareToken?: string;
}): Promise<void> {
  const events = await getVerificationEvents();
  events.unshift({
    id: uuidv4(),
    credentialId: input.credentialId,
    verifiedAt: new Date().toISOString(),
    outcome: input.outcome,
    origin: input.origin,
    shareToken: input.shareToken,
  });
  await writeCollection(KEYS.verifications, pruneVerificationEvents(events));
}

/**
 * Trim the log newest-first, per credential and then overall.
 *
 * Exported for tests: the retention rule is the part of this that is easy to
 * get subtly wrong and hard to notice in production.
 */
export function pruneVerificationEvents(events: VerificationEvent[]): VerificationEvent[] {
  const seen = new Map<string, number>();
  const kept: VerificationEvent[] = [];

  for (const event of events) {
    const count = seen.get(event.credentialId) ?? 0;
    if (count >= MAX_EVENTS_PER_CREDENTIAL) continue;
    seen.set(event.credentialId, count + 1);
    kept.push(event);
    if (kept.length >= MAX_VERIFICATION_EVENTS) break;
  }

  return kept;
}

export async function getVerificationsFor(credentialId: string): Promise<VerificationEvent[]> {
  return (await getVerificationEvents()).filter((event) => event.credentialId === credentialId);
}

// ─── Share links ────────────────────────────────────────────────────────────

export function getShareLinks(): Promise<ShareLink[]> {
  return readCollection<ShareLink>(KEYS.shares);
}

export async function addShareLink(link: ShareLink): Promise<void> {
  const links = await getShareLinks();
  links.push(link);
  await writeCollection(KEYS.shares, links);
}

export async function findShareLink(token: string): Promise<ShareLink | undefined> {
  return (await getShareLinks()).find((link) => link.token === token);
}

export async function updateShareLink(
  token: string,
  patch: Partial<ShareLink>
): Promise<ShareLink | undefined> {
  const links = await getShareLinks();
  const index = links.findIndex((link) => link.token === token);
  if (index === -1) return undefined;
  links[index] = { ...links[index], ...patch };
  await writeCollection(KEYS.shares, links);
  return links[index];
}

export async function getShareLinksForOwner(ownerId: string): Promise<ShareLink[]> {
  return (await getShareLinks()).filter((link) => link.ownerId === ownerId);
}

export function isShareLinkActive(link: ShareLink): boolean {
  if (link.revoked) return false;
  if (!link.expiresAt) return true;
  return new Date(link.expiresAt).getTime() > Date.now();
}

// ─── Recovery ───────────────────────────────────────────────────────────────

export function getRecoveryConfigurations(): Promise<RecoveryConfiguration[]> {
  return readCollection<RecoveryConfiguration>(KEYS.recovery);
}

export async function getRecoveryConfiguration(
  studentId: string
): Promise<RecoveryConfiguration | undefined> {
  return (await getRecoveryConfigurations()).find((item) => item.studentId === studentId);
}

export async function saveRecoveryConfiguration(
  configuration: RecoveryConfiguration
): Promise<void> {
  const configurations = await getRecoveryConfigurations();
  const index = configurations.findIndex((item) => item.studentId === configuration.studentId);
  if (index === -1) configurations.push(configuration);
  else configurations[index] = configuration;
  await writeCollection(KEYS.recovery, configurations);
}

// ─── Recovery requests ──────────────────────────────────────────────────────

export function getRecoveryRequests(): Promise<StoredRecoveryRequest[]> {
  return readCollection<StoredRecoveryRequest>(KEYS.recoveryRequests);
}

export async function addRecoveryRequest(request: StoredRecoveryRequest): Promise<void> {
  const requests = await getRecoveryRequests();
  requests.unshift(request);
  await writeCollection(KEYS.recoveryRequests, requests);
}

export async function findRecoveryRequestById(
  id: string
): Promise<StoredRecoveryRequest | undefined> {
  return (await getRecoveryRequests()).find((request) => request.id === id);
}

export async function updateRecoveryRequest(
  id: string,
  patch: Partial<StoredRecoveryRequest>
): Promise<StoredRecoveryRequest | undefined> {
  const requests = await getRecoveryRequests();
  const index = requests.findIndex((request) => request.id === id);
  if (index === -1) return undefined;
  requests[index] = { ...requests[index], ...patch };
  await writeCollection(KEYS.recoveryRequests, requests);
  return requests[index];
}

export async function getRecoveryRequestsForStudent(
  studentId: string
): Promise<StoredRecoveryRequest[]> {
  return (await getRecoveryRequests()).filter((request) => request.studentId === studentId);
}

/** Requests against any account that lists this wallet as a guardian. */
export async function getRecoveryRequestsForGuardian(
  guardianAddress: string
): Promise<StoredRecoveryRequest[]> {
  const target = guardianAddress.trim().toLowerCase();
  return (await getRecoveryRequests()).filter((request) =>
    request.guardianAddresses.some((address) => address.toLowerCase() === target)
  );
}

/**
 * Record a completed wallet migration.
 *
 * The previous address is kept so the account's existing credentials, share
 * links, and public profile continue to resolve.
 */
export async function migrateUserWallet(
  userId: string,
  newAddress: string
): Promise<StoredUser | undefined> {
  const users = await getUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return undefined;

  const current = users[index];
  if (current.walletAddress.toLowerCase() === newAddress.toLowerCase()) return current;

  const history = current.previousWalletAddresses ?? [];
  users[index] = {
    ...current,
    walletAddress: newAddress,
    previousWalletAddresses: [current.walletAddress, ...history],
    // The sealed key material still belongs to the old wallet. Record which
    // address it opens, and drop the server-side custody copy: the account's
    // current wallet is one only the holder controls, so the backend must not
    // claim it can sign for it.
    keyWalletAddress: current.keyWalletAddress ?? current.walletAddress,
    custody: undefined,
  };
  await saveUsers(users);
  return users[index];
}
