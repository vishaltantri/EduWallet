# EduWallet — Usage, Features & Demo Guide

Everything in one place: how to run it, what every feature does, and a scripted
walkthrough for showing it to a supervisor, panel, or viva.

---

## Table of contents

1. [The idea in sixty seconds](#1-the-idea-in-sixty-seconds)
2. [Running it](#2-running-it)
3. [Roles and page map](#3-roles-and-page-map)
4. [Feature reference](#4-feature-reference)
5. [The demo script (12 minutes)](#5-the-demo-script-12-minutes)
6. [The showstopper: proving tamper-detection live](#6-the-showstopper-proving-tamper-detection-live)
7. [Questions you will be asked, and the answers](#7-questions-you-will-be-asked-and-the-answers)
8. [Troubleshooting](#8-troubleshooting)
9. [API reference](#9-api-reference)
10. [Environment variables](#10-environment-variables)

---

## 1. The idea in sixty seconds

A paper degree certificate is trivial to forge and slow to check — an employer emails a
registrar and waits days. Putting a scan in a database fixes the speed but not the trust:
you are now trusting whoever runs the database.

EduWallet gives every certificate two properties that a verifier can check **without
trusting this website**:

| Property | How | What it stops |
|:--|:--|:--|
| **Content commitment** | `keccak256` over a canonical, ordered serialisation of the certificate's facts | Editing a degree, a name, or a date after issuance |
| **Issuer signature** | The institution's wallet signs that hash (EIP-191) | Anyone — including EduWallet's own operators — inventing a certificate |

Both hold offline. When Polygon is reachable the certificate is *additionally* minted as a
soulbound ERC-721 and the transaction hash is recorded. When it is not, the certificate is
still fully verifiable and the interface says so plainly rather than pretending otherwise.

> **The design point worth stating out loud:** the blockchain is an *anchor*, not the
> foundation. A system whose verification collapses when an RPC endpoint is down has not
> solved the trust problem, only relocated it.

---

## 2. Running it

### Local

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Nothing in `.env.local` is mandatory — with an empty file the
app runs in off-chain mode with local file storage, and every feature except Polygon
anchoring and IPFS pinning works.

### Production build (what Vercel actually runs)

```bash
cd frontend
npm run build
npm start
```

Use this when demoing from a laptop. It is faster, has no dev-mode overlay, and behaves
like the deployed site.

### Deploying to Vercel

1. Push the repo and import it into Vercel; the root directory is `frontend`.
2. **Add a KV database** (Vercel KV or Upstash Redis, free tier). The integration sets
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. Without this, every serverless
   instance keeps its own copy of the data in memory and accounts disappear between
   requests — the app will show an amber "Demo storage mode" banner telling you so.
3. Set `JWT_SECRET` and `WALLET_MASTER_KEY` to long random strings.
4. Leave the `NEXT_PUBLIC_*` chain variables blank unless you have deployed the contracts
   to Polygon Amoy. A `localhost` RPC is detected and skipped in production rather than
   hanging the request.

### Smart contracts (optional)

```bash
npm run contracts:compile
npm run contracts:test      # 48 tests
npm run contracts:deploy
```

Copy the deployed addresses into `NEXT_PUBLIC_SOULBOUND_ADDRESS`,
`NEXT_PUBLIC_REGISTRY_ADDRESS`, `NEXT_PUBLIC_RECOVERY_ADDRESS`, and point
`NEXT_PUBLIC_RPC_URL` at your Alchemy endpoint.

### Checking what mode you are in

Open <http://localhost:3000/api/system/status> or look at the "Registry status" panel on
the `/verify` page. It reports storage durability, IPFS reachability (it actually probes
Pinata rather than just checking a key is present), and chain connectivity.

---

## 3. Roles and page map

There are two account types and one unauthenticated audience.

| Page | Who | What it is |
|:--|:--|:--|
| `/` | Anyone | Landing page |
| `/register` | Anyone | Create a student or institution account |
| `/login` | Anyone | Sign in |
| `/university/dashboard` | Institution | Issue, bulk-issue, revoke, analytics |
| `/student/dashboard` | Student | Credentials, share links, verification history |
| `/student/recovery` | Student | Social recovery guardians + wallet key export |
| `/verify` | **No account** | Verification front door — accepts a link, ID, or address |
| `/verify/<id>` | **No account** | Full verification result for one credential |
| `/verify/share/<token>` | **No account** | A scoped, expiring share link |
| `/verify/demo` | **No account** | A self-contained sample certificate |
| `/u/<wallet>` | **No account** | Public, verifiable credential profile |

A wallet is generated automatically at registration and its key is encrypted — students and
registrars never see a seed phrase unless they deliberately ask for one.

---

## 4. Feature reference

### 4.1 For institutions

**Issue a certificate** — `/university/dashboard` → *Issue Certificate* tab.

Fields: student email (must already have an EduWallet account), student name, degree type,
major, plus optional grade/classification and completion date. A confirmation modal shows
exactly what will be signed.

What happens when you press Confirm, in order:

1. The student is resolved by email and checked to be a student account.
2. Metadata is pinned to IPFS via Pinata. *(Soft failure — if Pinata is unconfigured or
   rejects the key, the metadata is recorded locally and you get a warning toast. It never
   invents a fake `Qm...` hash.)*
3. A token ID is allocated from an atomic counter.
4. The certificate is hashed and **signed by your institution's wallet**. This is the step
   that matters — it is what a verifier checks.
5. It is anchored on Polygon. *(Soft failure — if no chain is reachable the certificate is
   marked "not anchored" and remains fully verifiable.)*

**Bulk issuance** — *Bulk Upload* tab. Paste or upload a CSV, up to 100 rows.

```csv
email,name,degree,major,grade,completion_date
aisha@example.edu,Aisha Khan,Bachelor of Technology,Computer Science,First Class,2026-05-30
ravi@example.edu,Ravi Menon,Master of Science,Data Science,Distinction,2026-06-15
```

- Required columns: `email`, `name`, `degree`, `major`
- Optional: `grade`, `completion_date`
- Aliases accepted: `student_email`, `student_name`, `degree_type`, `field_of_study`, `completion`
- Column order does not matter; quoted fields containing commas are handled
- **Validate only** runs a dry pass and reports problems without issuing anything
- Rows are issued one at a time, so a failure on row 7 does not roll back rows 1–6 — the
  result lists what succeeded and what did not, with reasons

**Revocation** — *Credentials* tab → *Revoke*. A reason is required and is shown to anyone
who opens the certificate. The signature and hash are deliberately **preserved**: the
document really was issued, and a verifier should see a genuine-but-withdrawn credential
rather than one that silently vanishes. If the certificate was anchored on-chain, the
revocation is pushed on-chain too.

**Analytics** — *Analytics* tab: certificates issued per month (6-month window), credential
mix by degree type, unique students, how many are signed and anchored, most-checked
certificates, and a live feed of who has been verifying your credentials and what they saw.

### 4.2 For students

**Credential cards** — each shows the degree, institution, grade, token number, and badges
for status (`Active` / `Revoked`), signature (`Signature verified` / `Signature mismatch` /
`Unsigned (legacy)`) and anchoring (`On-chain`).

**Share links** — *Share* on any credential. This is the privacy feature.

| Option | Effect |
|:--|:--|
| Expiry | 24 hours, 7 days, 30 days, or never |
| Withhold name | The verifier sees the degree, the institution, and a valid issuer signature — but not your name or wallet address |
| Label | Private note to yourself ("Application — Acme Corp") |

Links can be revoked at any time and stop working immediately, even if the recipient
bookmarked them. Up to 25 active links at once. The *Share Links* section shows view counts
and expiry for each one.

> **Why this matters academically:** a permanent `/verify/<id>` link names the holder and
> lives forever. An employer screening 200 applicants usually needs to confirm one degree,
> once. A scoped, expiring, optionally anonymous link is the minimum-disclosure version of
> the same proof.

**Verification history** — click the "Verified N×" link under any credential to expand
when it was checked, roughly from where, and whether it came through a share link. Origin is
recorded at city/country level from edge headers, never as a raw IP address.

**Download W3C credential** — exports the certificate as a W3C Verifiable Credential Data
Model 2.0 JSON-LD document with the EIP-191 signature attached as its proof. Readable by
other wallets and credential viewers, and usable offline.

**Public profile** — `/u/<your wallet address>`, linked from the dashboard. A citable
verifiable résumé. Only credentials that are **active and signature-valid** are listed —
anything revoked, unsigned, or tampered is excluded, because a page anyone can cite should
not carry anything unverifiable.

**Social recovery** — `/student/recovery`. Add 2–5 guardians (each must be a registered
institution account, identified by email) and set an M-of-N threshold. You cannot be your
own guardian.

**Wallet key export** — also on `/student/recovery`. Re-enter your password and the private
key to your wallet is revealed once. This is the answer to "isn't this just a custodial
database?": the key sealed under your password is opened with your password, and you can
import it into MetaMask and take your soulbound credentials with you.

### 4.3 For verifiers (no account)

`/verify` accepts any of: a full verification URL, a credential ID, or a `0x` wallet
address (which routes to that holder's public profile).

The result page runs three named checks and shows each one passing or failing individually,
rather than a single green tick:

1. **Signed by the issuing institution** — is there a signature at all?
2. **Content matches the hash signed at issuance** — has anything been edited since?
3. **Signature recovers to the issuer's wallet** — did that institution actually sign it?

Plus a revocation check. The four possible outcomes:

| Outcome | Banner | Meaning |
|:--|:--|:--|
| `valid` | Green — Credential Verified | Signed, intact, not revoked |
| `revoked` | Red — Credential Revoked | Genuine, but withdrawn by the issuer; reason shown |
| `tampered` | Amber — Signature Does Not Match | The stored record no longer matches what was signed |
| `not_found` | Red — Verification Failed | No such credential, or an expired/revoked share link |

`tampered` deliberately outranks `revoked`: a document whose contents no longer match its
signature is a forgery question, not an administrative one.

The page also shows the credential hash, the issuer address, the IPFS CID, the chain anchor
(with an explorer link when anchored), a QR code, how many times it has been checked before,
and buttons to copy the link, download the W3C credential, and print.

### 4.4 System behaviour worth demonstrating

**Honest status reporting.** The navbar badge shows the real chain state — green with the
network name when connected, amber "Off-chain mode" when not. It is not a decoration.

**Graceful degradation.** IPFS down, Pinata key revoked, RPC unreachable, contracts not
deployed — each of these degrades one claim and is labelled, rather than breaking issuance.

**Storage transparency.** If the deployment has no durable database, signed-in users see a
banner saying their data is ephemeral. A demo that quietly loses data is worse than one that
admits it.

**Session integrity.** Tokens live 24 hours and are validated against the server on page
load; an expired session shows a "Your session expired" bar instead of silently rendering
empty dashboards.

**Rate limiting.** Login (10 per 15 min), registration (20 per hour), and wallet export
(5 per 15 min) are throttled per client.

---

## 5. The demo script (12 minutes)

### Before you start

- Run the **production build** (`npm run build && npm start`), not `npm run dev`.
- Have two browser windows ready — one normal, one private/incognito. The private window
  plays "the employer" and proves no account is needed.
- Zoom the browser to ~110% if you are projecting.
- Decide your two demo emails in advance and write them on a sticky note. Passwords must be
  **at least 8 characters**.

If you want a pre-populated demo instead of registering live, the local dataset already
contains:

| Account | Email | Password |
|:--|:--|:--|
| Institution | `registrar@iitb.test` | `supersecret1` |
| Student | `aisha@iitb.test` | `supersecret1` |

---

### Scene 0 — The problem (30 seconds, no clicking)

> "Verifying a degree today means emailing a registrar and waiting three to fifteen days,
> and it costs the employer twenty-five to a hundred dollars per check. Meanwhile a
> convincing forgery takes twenty minutes in an image editor. I want to show you a system
> where the check takes four seconds, costs nothing, and the forgery is detectable."

Have `/` open. Point at the comparison table near the bottom.

---

### Scene 1 — The institution registers (1 minute)

1. `/register` → choose **University Staff**.
2. Fill in: your name as registrar, **Institution Name** (say `Global Tech University`),
   email `registrar@globaltech.test`, password `demopassword1`.
3. Point out the institution name field: *"This is what appears on every certificate and is
   what a verifier sees — it is not a display nicety."*
4. Press Create Account.

> "No seed phrase, no MetaMask, no gas. A wallet was just generated and its private key
> encrypted twice — once under this password, once under a server key so certificates can be
> signed on the registrar's behalf. I'll come back to why that second copy exists."

---

### Scene 2 — Validation, deliberately (45 seconds)

Still on the institution dashboard, try to issue to a student who does not exist:

- Student email `ghost@nowhere.test`, any name, any degree.
- Confirm.

You get: *"No EduWallet account for ghost@nowhere.test. The student must register first."*

> "Certificates are issued **to a wallet**, not to a string. There has to be a real holder."

---

### Scene 3 — The student registers (45 seconds)

1. Sign out, `/register` → **Student**.
2. Name `Aisha Khan`, email `aisha@globaltech.test`, password `demopassword1`.
3. Land on an empty dashboard. Point at the three-step explainer.

---

### Scene 4 — Issuance (1 minute 30 seconds)

1. Sign back in as the registrar.
2. Issue to `aisha@globaltech.test`: `Bachelor of Technology`, `Computer Science`, grade
   `First Class`, completion date.
3. Read the confirmation modal aloud, then confirm.
4. Watch the toasts. **Do not hide the warnings** — if Pinata or the chain is unavailable,
   say so:

> "Notice it told me IPFS pinning was unavailable and the chain anchor is pending. It still
> issued, because neither of those is what makes the certificate trustworthy. The signature
> is — and that succeeded."

5. You land on the *Credentials* tab. Point at the badges: `Active`, `Signed`.

---

### Scene 5 — Bulk issuance (1 minute)

1. *Bulk Upload* tab → **Load example** → change one email to your student's, leave the
   other as a non-existent address.
2. Press **Validate only**. Two rows parse cleanly.
3. Press **Issue all**. Result: *"Issued 1 of 2 certificates"* — with the failing row and
   its reason listed.

> "A university issues a cohort, not a certificate. Partial success is reported per row
> rather than failing the whole upload."

---

### Scene 6 — The student's view (1 minute 30 seconds)

1. Sign in as the student.
2. Point at the badges on the credential card: **Signature verified**.
3. Click **"Verified N×"** to expand the verification history.

> "The holder can see every time their credential was checked and roughly where from. That
> is a signal you simply do not get from a paper certificate — you never find out who looked
> at it."

4. Click **Download VC** and open the file. Scroll to the `proof` block.

> "That's a W3C Verifiable Credential. The `proofValue` is the institution's signature. This
> file is portable — it does not need EduWallet to be readable."

---

### Scene 7 — Privacy-scoped sharing (1 minute 30 seconds)

1. Click **Share** on the credential.
2. Set expiry to **24 hours** and tick **"Withhold my name and wallet address"**.
3. Create link — it is copied to the clipboard.
4. Paste it into the **private window**.

> "This is the employer. No account, no login."

5. The certificate verifies — but the holder is shown as *"Withheld by credential holder"*.

> "The employer can confirm that Global Tech University signed a First Class BTech in
> Computer Science. They cannot learn who holds it, and the link stops working tomorrow.
> That's minimum disclosure — the cryptography proves the claim without exposing the person."

6. Back in the student window, **Revoke** the share link. Reload the private window: gone.

---

### Scene 8 — Full verification (1 minute 30 seconds)

In the private window, open `/verify` and paste the credential ID (or use the permanent
link from the student's *View certificate* button).

Walk through the result page slowly:

- The four progress steps — *"these name what the server is actually doing"*
- **Cryptographic Proof**: three checks, each individually ticked
- The **credential hash** — *"keccak256 over the certificate's facts, in a fixed order"*
- **Signature recovers to 0x…** — *"that address is the institution's. Recovered from the
  signature itself, not looked up in a table."*
- **Chain anchor** — whatever it honestly says
- QR code, verification count

> "Nothing on this page requires trusting EduWallet. Recover the signer from the signature,
> compare it to the institution's published address — you can do that in ten lines of
> ethers.js without this website existing."

---

### Scene 9 — Revocation (1 minute)

1. Institution window → *Credentials* tab → **Revoke** on the first certificate.
2. Reason: `Issued in error — duplicate of certificate #3`.
3. In the **private window**, reload the verification page *that was already open*.

Red banner: **Credential Revoked**, with the reason and date.

> "The employer did not have to ask again. The link they already had told them. And notice
> the signature checks still pass — this certificate genuinely was issued, and then
> withdrawn. That's a different fact from 'this is fake', and the system reports them
> differently."

4. Reload `/u/<student wallet>`: the revoked credential is gone from the public profile.

---

### Scene 10 — Self-custody (45 seconds)

1. Student window → **Social Recovery** → scroll to *"Own your wallet outright"*.
2. Click **Export wallet key**, enter the password, reveal.

> "The usual objection to a custodial education wallet is that the student never really owns
> anything. This key was sealed with a key derived from their password — the server cannot
> open it alone. Import it into MetaMask and the soulbound credentials travel with it,
> because they are bound to this address, not to this website."

Close the dialog. Also show the guardian setup above it and explain M-of-N recovery for the
case where the password is lost.

---

### Scene 11 — Close (30 seconds)

Open `/verify` and show the **Registry status** panel.

> "One last thing: the system tells you what it can and cannot currently do. Chain
> unreachable, IPFS unconfigured, storage ephemeral — all stated. A demo that hides its
> failure modes is teaching the wrong lesson about trust."

---

## 6. The showstopper: proving tamper-detection live

Save this for last or for a sceptical questioner. **It requires local file storage**, so run
`npm run dev` or `npm start` locally (not the Vercel deployment).

1. Open a valid certificate's verification page and leave it visible. Green banner.
2. Open `frontend/data/credentials.json` in an editor.
3. Find that credential and change something meaningful — turn `"major": "Computer Science"`
   into `"major": "Quantum Rocket Surgery"`, or bump a grade.
4. Save the file. Reload the verification page.

**Amber banner: "Signature Does Not Match."** The proof panel shows exactly which check
failed — *"Content does not match the signed hash"* — while *"Signature recovers to 0x…"*
still passes.

> "I just did the thing a corrupt administrator, or a compromised database, or I myself
> would do: I edited the record directly. I have full write access to the storage layer and
> it made no difference. To make that edit stick I would need the institution's private key,
> which is not on this machine."

Then reload `/u/<wallet>` — the tampered credential has also dropped off the public profile.

**Put the file back afterwards** (change `Quantum Rocket Surgery` back to `Computer
Science`) and reload to show the green banner return. That round trip is what proves the
check is live rather than a stored flag.

---

## 7. Questions you will be asked, and the answers

**"Isn't this just a database with extra steps?"**
A database requires trusting its operator. Here the operator cannot forge or edit a
certificate — demo §6 proves it. The signing key belongs to the institution.

**"What if Polygon is down?"**
Verification still works. Anchoring is a secondary provenance claim; the signature is the
primary one. The UI labels the difference instead of hiding it.

**"The server holds the private keys — so it's custodial."**
Partly, and deliberately: asking a 21-year-old graduate to safeguard a seed phrase for a
document they need in forty years is a worse failure mode than custody. But there are two
escapes — the password-sealed copy the student can export at any time (§4.2), and M-of-N
institutional social recovery. The server-held copy exists so a registrar can issue 300
certificates without re-entering a password 300 times.

**"Can a student edit their own certificate?"**
No. They hold no signing key for it. Any edit breaks the content hash.

**"What stops someone enumerating all certificates?"**
Credential IDs are UUIDv4 and share tokens are 144 bits of randomness. Neither is
sequential or guessable.

**"Why not store everything on-chain?"**
Cost and privacy. Personal data on an immutable public ledger cannot be corrected or erased,
which is a legal problem, not just a technical one. Hashes and signatures go on-chain;
personal data stays off it.

**"What are the honest limitations?"**
Worth volunteering before you are asked:
- Collections are read-modify-written whole, so heavy concurrent writes could drop a record;
  production would need per-record keys or transactions.
- Institution accounts self-register — there is no accreditation authority deciding who is a
  real university. A production system needs a root of trust for issuers.
- Guardian registration is recorded off-chain, because pushing it on-chain needs the
  student's key, which only they can unseal.
- The verification log is capped at the most recent 500 events.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|:--|:--|:--|
| Amber "Demo storage mode" banner | No durable database configured | Add Vercel KV / Upstash and set `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Accounts vanish between page loads on Vercel | Same as above | Same as above |
| "IPFS pinning unavailable" toast on issuance | `PINATA_JWT` missing, malformed, or revoked | Regenerate the key in Pinata; check `/api/system/status` for the exact error |
| Navbar shows "Off-chain mode" | No reachable RPC or no contract addresses | Expected with a `localhost` RPC. Deploy contracts and set the `NEXT_PUBLIC_*` variables to change it |
| "Student not found" when issuing | The student has not registered | Register them first — certificates bind to a wallet |
| "Password must be at least 8 characters" | Minimum was raised from 6 | Use 8+; existing shorter passwords still sign in |
| "Session expired" bar | Token older than 24 hours | Sign in again |
| "Too many sign-in attempts" | Rate limiter | Wait, or restart the server to clear per-instance counters |
| Certificate shows "Unsigned (legacy)" | Issued before signing existed | Sign out and back in as that institution to re-key its wallet, then re-issue |

---

## 9. API reference

Every endpoint returns JSON. Authenticated ones expect `Authorization: Bearer <token>`.

### Public — no authentication

| Method | Path | Purpose |
|:--|:--|:--|
| `GET` | `/api/verify/:id` | Verify a credential; records a verification event |
| `GET` | `/api/verify/share/:token` | Resolve a share link (410 if expired or revoked) |
| `GET` | `/api/profile/:address` | Public credential profile for a wallet |
| `GET` | `/api/credentials/:id/vc` | Download the W3C Verifiable Credential |
| `GET` | `/api/system/status` | Storage, IPFS, and chain health |

### Authentication

| Method | Path | Purpose |
|:--|:--|:--|
| `POST` | `/api/auth/register` | Create an account and wallet |
| `POST` | `/api/auth/login` | Sign in; re-keys legacy wallets transparently |
| `GET` | `/api/auth/me` | Validate the current session |
| `POST` | `/api/auth/wallet-export` | Reveal the wallet private key (password required) |

### Institution only

| Method | Path | Purpose |
|:--|:--|:--|
| `POST` | `/api/credentials/issue` | Issue one certificate |
| `POST` | `/api/credentials/bulk` | Issue from CSV (`dryRun: true` to validate only) |
| `POST` | `/api/credentials/:id/revoke` | Revoke, with a required reason |
| `GET` | `/api/credentials/issuer/:address` | List credentials this institution issued |
| `GET` | `/api/analytics/issuer` | Issuance and verification analytics |

### Student only

| Method | Path | Purpose |
|:--|:--|:--|
| `GET` | `/api/credentials/student/:address` | Own credentials, with integrity reports |
| `GET` | `/api/credentials/:id/verifications` | Verification history (holder or issuer only) |
| `GET`/`POST` | `/api/share` | List or create share links |
| `DELETE` | `/api/share/:token` | Revoke a share link |
| `GET`/`POST` | `/api/recovery/setup` | Read or configure guardians |

### A one-line verification, from a terminal

Useful to show that the API is not tied to the UI:

```bash
curl -s https://YOUR-APP.vercel.app/api/verify/<credential-id> | jq '.outcome, .integrity'
```

---

## 10. Environment variables

All are optional; the app degrades and reports rather than failing.

| Variable | Purpose |
|:--|:--|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Durable shared storage. **Set these on Vercel.** |
| `JWT_SECRET` | Signs session tokens |
| `WALLET_MASTER_KEY` | Encrypts the server-held copy of wallet keys. Long-lived — rotating it forces institutions to sign in again before they can issue |
| `PINATA_JWT`, `PINATA_GATEWAY` | IPFS metadata pinning |
| `NEXT_PUBLIC_SOULBOUND_ADDRESS` | Soulbound certificate contract |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Credential registry contract |
| `NEXT_PUBLIC_RECOVERY_ADDRESS` | Recovery manager contract |
| `NEXT_PUBLIC_RPC_URL` | Polygon RPC endpoint |
| `NEXT_PUBLIC_EXPLORER_URL` | Block explorer base for transaction links |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL used in W3C credentials and share links |
| `CHAIN_TIMEOUT_MS` | How long to wait on an on-chain write before giving up (default 12000) |
