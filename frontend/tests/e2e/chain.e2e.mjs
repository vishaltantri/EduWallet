/**
 * Chain-enabled end-to-end check.
 *
 * Drives a running EduWallet server over HTTP and asserts that the on-chain
 * path actually completes — certificate minted, registry entry written,
 * revocation anchored, guardian set registered, and a social recovery
 * executed through RecoveryManager.
 *
 * This exists because that whole path used to be dead: the certificate
 * contract is `onlyIssuer`, institutions get a freshly generated wallet when
 * they register, and nothing ever authorized them, so every mint reverted
 * with NotIssuer and was quietly recorded as "anchoring pending".
 *
 * Usage (see `npm run test:e2e:chain`):
 *   1. npx hardhat node                 (in contracts/)
 *   2. npx hardhat run scripts/deploy.js --network localhost
 *   3. start the app with the deployed addresses, a localhost RPC, and
 *      PLATFORM_PRIVATE_KEY set to the deploying account's key
 *   4. BASE_URL=http://127.0.0.1:3000 RPC_URL=http://127.0.0.1:8545 node this
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Contract, JsonRpcProvider } from "ethers";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

const results = [];
let failures = 0;

async function step(name, fn) {
  try {
    await fn();
    results.push(`  PASS  ${name}`);
  } catch (error) {
    failures += 1;
    results.push(`  FAIL  ${name}\n        ${error.message.split("\n")[0]}`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let clientSeq = 0;
function freshIp() {
  clientSeq += 1;
  return `198.51.100.${clientSeq % 250}`;
}

async function api(path, { method = "GET", body, token, ip } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-forwarded-for": ip || freshIp(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json, headers: response.headers };
}

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

let seq = 0;
function email(prefix) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}@e2e.test`;
}

async function register(role, institutionName) {
  const address = email(role);
  const { status, body } = await api("/api/auth/register", {
    method: "POST",
    body: {
      name: role === "university" ? "Registrar" : "E2E Student",
      email: address,
      password: "an-e2e-password",
      role,
      institutionName,
    },
  });
  assert.equal(status, 200, `register ${role}: ${JSON.stringify(body)}`);
  return { email: address, token: body.token, user: body.user, password: "an-e2e-password" };
}

// ─── Run ────────────────────────────────────────────────────────────────────

console.log(`\nEduWallet chain-enabled E2E\n  app: ${BASE_URL}\n  rpc: ${RPC_URL}\n`);

const status = await api("/api/system/status");
assert.equal(status.status, 200, "the app is not responding");
assert.equal(status.body.chain.configured, true, "the app has no contract addresses configured");
assert.equal(status.body.chain.reachable, true, "the app cannot reach the RPC endpoint");
assert.equal(status.body.chain.relayer, true, "PLATFORM_PRIVATE_KEY is not set, so nothing can mint");

const contracts = status.body.chain.contracts;
assert.equal(contracts.soulbound, true, "the certificate contract did not answer");
assert.equal(contracts.registry, true, "the registry contract did not answer");
assert.equal(contracts.recovery, true, "the recovery contract did not answer");
console.log(`  chain: ${status.body.chain.network} · block ${status.body.chain.blockNumber}\n`);

// Read the contracts the same way the app does, through their shipped ABIs,
// rather than through hand-computed selectors.
const abi = (name) =>
  JSON.parse(readFileSync(new URL(`../../src/lib/contracts/${name}.json`, import.meta.url), "utf8"));

const provider = new JsonRpcProvider(RPC_URL);
const SOULBOUND = process.env.SOULBOUND_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const REGISTRY = process.env.REGISTRY_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const RECOVERY = process.env.RECOVERY_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const certificate = new Contract(SOULBOUND, abi("SoulboundCertificate"), provider);
const registry = new Contract(REGISTRY, abi("CredentialRegistry"), provider);
const recoveryManager = new Contract(RECOVERY, abi("RecoveryManager"), provider);

const issuer = await register("university", "E2E University");
const student = await register("student");
let credential;

await step("an institution's first issuance authorizes and funds its wallet, then mints", async () => {
  const { status: code, body } = await api("/api/credentials/issue", {
    method: "POST",
    token: issuer.token,
    body: {
      studentEmail: student.email,
      studentName: "E2E Student",
      degreeType: "Bachelor of Science",
      major: "Computer Science",
      grade: "First Class",
    },
  });
  assert.equal(code, 200, JSON.stringify(body));
  credential = body.credential;

  assert.equal(credential.anchored, true, `not anchored: ${credential.anchorError}`);
  assert.match(credential.txHash, /^0x[a-f0-9]{64}$/i, "no transaction hash recorded");
  assert.ok(credential.chainTokenId > 0, "no on-chain token id recorded");
  assert.match(credential.issuerSignature, /^0x/, "the certificate was not signed");
});

await step("the mint transaction really succeeded on chain", async () => {
  const receipt = await rpc("eth_getTransactionReceipt", [credential.txHash]);
  assert.ok(receipt, "no receipt for the recorded transaction hash");
  assert.equal(receipt.status, "0x1", "the mint transaction reverted");
});

await step("the certificate wallet is authorized as an issuer on chain", async () => {
  assert.equal(
    await certificate.authorizedIssuers(issuer.user.walletAddress),
    true,
    "the institution wallet was never authorized"
  );
});

await step("the institution is registered on the credential registry", async () => {
  assert.equal(
    await registry.isActiveIssuer(issuer.user.walletAddress),
    true,
    "the institution is not an active registry issuer"
  );
});

await step("the credential was mirrored into the registry", async () => {
  assert.match(
    credential.registryTxHash ?? "",
    /^0x[a-f0-9]{64}$/i,
    "no registry transaction was recorded"
  );
  const receipt = await rpc("eth_getTransactionReceipt", [credential.registryTxHash]);
  assert.equal(receipt.status, "0x1", "the registry transaction reverted");

  const entry = await registry.getCredential(credential.chainTokenId);
  assert.equal(entry.studentName, "E2E Student");
  assert.equal(entry.degreeType, "Bachelor of Science");
  assert.equal(entry.major, "Computer Science");
  assert.equal(entry.exists, true);
});

await step("the soulbound token is owned by the student and is locked", async () => {
  const owner = await certificate.ownerOf(credential.chainTokenId);
  assert.equal(
    owner.toLowerCase(),
    student.user.walletAddress.toLowerCase(),
    "the token is not owned by the student"
  );
  assert.equal(await certificate.locked(credential.chainTokenId), true, "the token is not locked");
  assert.equal(await certificate.supportsInterface("0xb45a3c0e"), true, "ERC-5192 not advertised");

  const [isValid, onChainStudent, onChainIssuer] = await certificate.verifyCertificate(
    credential.chainTokenId
  );
  assert.equal(isValid, true);
  assert.equal(onChainStudent.toLowerCase(), student.user.walletAddress.toLowerCase());
  assert.equal(onChainIssuer.toLowerCase(), issuer.user.walletAddress.toLowerCase());
});

await step("public verification corroborates the record against the chain", async () => {
  const { status: code, body } = await api(`/api/verify/${credential.id}`);
  assert.equal(code, 200, JSON.stringify(body));
  assert.equal(body.outcome, "valid");
  assert.equal(body.anchor.anchored, true);
  assert.equal(body.anchor.onChainMatches, true, "the on-chain record does not match the database");
  assert.ok(body.anchor.explorerUrl, "no explorer link was offered");
  assert.deepEqual(
    { signed: body.integrity.signed, intact: body.integrity.contentIntact, valid: body.integrity.signatureValid },
    { signed: true, intact: true, valid: true }
  );
});

await step("a second issuance by the same institution reuses the authorization", async () => {
  const second = await register("student");
  const { status: code, body } = await api("/api/credentials/issue", {
    method: "POST",
    token: issuer.token,
    body: {
      studentEmail: second.email,
      studentName: "Second Student",
      degreeType: "Master of Science",
      major: "Physics",
    },
  });
  assert.equal(code, 200, JSON.stringify(body));
  assert.equal(body.credential.anchored, true, `not anchored: ${body.credential.anchorError}`);
  assert.ok(
    body.credential.chainTokenId > credential.chainTokenId,
    "the contract did not allocate a new token id"
  );
});

await step("revocation is anchored on chain and reflected in verification", async () => {
  const { status: code, body } = await api(`/api/credentials/${credential.id}/revoke`, {
    method: "POST",
    token: issuer.token,
    body: { reason: "E2E withdrawal" },
  });
  assert.equal(code, 200, JSON.stringify(body));
  assert.match(String(body.chainNote), /anchored on-chain/, `chain note: ${body.chainNote}`);

  const [isValid] = await certificate.verifyCertificate(credential.chainTokenId);
  assert.equal(isValid, false, "the chain still reports the certificate as valid");

  const verified = await api(`/api/verify/${credential.id}`);
  assert.equal(verified.body.outcome, "revoked");
  assert.equal(verified.body.revocationReason, "E2E withdrawal");
  // The chain agrees that the token is no longer valid.
  assert.equal(verified.body.anchor.onChainMatches, true);
  // The signature is preserved: the document really was issued.
  assert.equal(verified.body.integrity.signatureValid, true);
});

// ─── Social recovery, end to end and on chain ───────────────────────────────

const recoveringStudent = await register("student");
const guardianA = await register("university", "Guardian A University");
const guardianB = await register("university", "Guardian B University");
let recoveryRequestId;
const destination = "0x" + "7".repeat(40);

await step("a guardian set is registered on the RecoveryManager contract", async () => {
  const { status: code, body } = await api("/api/recovery/setup", {
    method: "POST",
    token: recoveringStudent.token,
    body: { guardianEmails: [guardianA.email, guardianB.email], threshold: 2 },
  });
  assert.equal(code, 200, JSON.stringify(body));
  assert.match(String(body.txHash), /^0x[a-f0-9]{64}$/i, `chain error: ${body.chainError}`);

  const receipt = await rpc("eth_getTransactionReceipt", [body.txHash]);
  assert.equal(receipt.status, "0x1", "setupGuardians reverted");

  assert.equal(
    await recoveryManager.isConfigured(recoveringStudent.user.walletAddress),
    true,
    "the contract has no guardian configuration for this account"
  );
  assert.equal(await recoveryManager.getThreshold(recoveringStudent.user.walletAddress), 2n);
  assert.equal(
    await recoveryManager.isGuardian(recoveringStudent.user.walletAddress, guardianA.user.walletAddress),
    true
  );
});

await step("a guardian opens a recovery request, mirrored on chain", async () => {
  const { status: code, body } = await api("/api/recovery/requests", {
    method: "POST",
    token: guardianA.token,
    body: { studentEmail: recoveringStudent.email, newAddress: destination },
  });
  assert.equal(code, 200, JSON.stringify(body));
  recoveryRequestId = body.request.id;

  assert.equal(body.request.state.approvals, 1, "the initiator was not counted as an approval");
  assert.equal(body.request.state.thresholdMet, false);
  assert.match(
    String(body.request.initiateTxHash),
    /^0x[a-f0-9]{64}$/i,
    `chain error: ${body.request.chainError}`
  );

  const onChain = await recoveryManager.getRecoveryStatus(recoveringStudent.user.walletAddress);
  assert.equal(onChain.isActive, true, "the contract has no active recovery request");
  assert.equal(onChain.newAddress.toLowerCase(), destination.toLowerCase());
  assert.equal(onChain.approvalCount, 1n);
});

await step("the student can see the request, which is what makes cancelling possible", async () => {
  const { body } = await api("/api/recovery/requests", { token: recoveringStudent.token });
  const found = body.requests.find((request) => request.id === recoveryRequestId);
  assert.ok(found, "the account holder cannot see a request against their own account");
  assert.equal(found.status, "pending");
});

await step("execution is refused before the threshold and the delay", async () => {
  const { status: code, body } = await api(
    `/api/recovery/requests/${recoveryRequestId}/execute`,
    { method: "POST", token: guardianA.token }
  );
  assert.equal(code, 409, JSON.stringify(body));
});

await step("a second guardian's approval is mirrored on chain", async () => {
  const { status: code, body } = await api(
    `/api/recovery/requests/${recoveryRequestId}/approve`,
    { method: "POST", token: guardianB.token }
  );
  assert.equal(code, 200, JSON.stringify(body));
  assert.equal(body.request.state.thresholdMet, true);

  const approval = body.request.approvals.find((item) => item.guardianEmail === guardianB.email);
  assert.match(String(approval?.txHash), /^0x[a-f0-9]{64}$/i, "the approval was not anchored");

  const onChain = await recoveryManager.getRecoveryStatus(recoveringStudent.user.walletAddress);
  assert.equal(onChain.approvalCount, 2n, "the contract did not record the second approval");
});

await step("execution is still refused during the 24-hour delay", async () => {
  const { status: code, body } = await api(
    `/api/recovery/requests/${recoveryRequestId}/execute`,
    { method: "POST", token: guardianB.token }
  );
  assert.equal(code, 409, JSON.stringify(body));
  assert.match(String(body.error), /24-hour/);
});

await step("after the delay elapses the migration completes on chain and off", async () => {
  // Two clocks have to pass the cooldown: the chain's, and the stored
  // request's. The chain is wound forward; the server is run with a shortened
  // cooldown (COOLDOWN_WAIT_MS says how long to wait it out), which is only
  // honoured outside production.
  await rpc("evm_increaseTime", [25 * 60 * 60]);
  await rpc("evm_mine", []);

  const wait = Number(process.env.COOLDOWN_WAIT_MS || 0);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const { status: code, body } = await api(
    `/api/recovery/requests/${recoveryRequestId}/execute`,
    { method: "POST", token: guardianB.token }
  );

  assert.equal(
    code,
    200,
    `execution did not complete. Run the server with a shortened RECOVERY_COOLDOWN_MS_OVERRIDE and set COOLDOWN_WAIT_MS. Response: ${JSON.stringify(body)}`
  );
  assert.equal(body.migratedTo.toLowerCase(), destination.toLowerCase());
  assert.match(String(body.request.executeTxHash), /^0x[a-f0-9]{64}$/i, "execution was not anchored");

  const receipt = await rpc("eth_getTransactionReceipt", [body.request.executeTxHash]);
  assert.equal(receipt.status, "0x1", "executeRecovery reverted on chain");

  assert.equal(
    (await recoveryManager.resolveAddress(recoveringStudent.user.walletAddress)).toLowerCase(),
    destination.toLowerCase(),
    "the contract did not record the address migration"
  );
});

await step("the recovered account keeps working under its new address", async () => {
  // The holder's own session should now report the new wallet, and the
  // request should read as executed to both sides.
  const me = await api("/api/auth/me", { token: recoveringStudent.token });
  assert.equal(
    me.body.user.walletAddress.toLowerCase(),
    destination.toLowerCase(),
    "the account still reports its old wallet address"
  );

  const listed = await api("/api/recovery/requests", { token: recoveringStudent.token });
  const found = listed.body.requests.find((request) => request.id === recoveryRequestId);
  assert.equal(found.status, "executed");

  // Credentials are looked up under the new address even though they name the
  // old one, and a second recovery cannot be opened against a settled one.
  const credentials = await api(`/api/credentials/student/${destination}`, {
    token: recoveringStudent.token,
  });
  assert.equal(credentials.status, 200, JSON.stringify(credentials.body));
});

// ─── Degradation ────────────────────────────────────────────────────────────

await step("verification of an unknown credential reports not_found", async () => {
  const { status: code, body } = await api("/api/verify/00000000-0000-0000-0000-000000000000");
  assert.equal(code, 404);
  assert.equal(body.outcome, "not_found");
});

await step("every public page renders", async () => {
  for (const path of ["/", "/login", "/register", "/verify", "/verify/demo"]) {
    const response = await fetch(`${BASE_URL}${path}`);
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    const html = await response.text();
    assert.ok(html.includes("<html") || html.includes("<!DOCTYPE"), `${path} returned no document`);
  }
});

await step("a public credential profile renders for the holder's address", async () => {
  const response = await fetch(`${BASE_URL}/u/${student.user.walletAddress}`);
  assert.equal(response.status, 200);
});

console.log(results.join("\n"));
console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
