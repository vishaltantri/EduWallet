# EduWallet — Decentralized Academic Credentials

A blockchain-based system for issuing, managing, and verifying tamper-proof academic
credentials using soulbound tokens on Polygon.

## The verification model

The chain is an anchor, not the proof of last resort. Every certificate carries two
guarantees that hold **without an RPC connection**:

1. **A content commitment.** A `keccak256` hash is taken over a canonical, ordered
   serialisation of the certificate's facts (student, institution, degree, dates,
   IPFS CID). Change one character and the hash changes.
2. **An issuer signature.** The institution's wallet signs that hash (EIP-191). A
   verifier recovers the signing address from the signature and compares it with the
   issuer's published wallet address.

So a verifier does not have to trust this website — only the institution's key. When
Polygon is reachable, the certificate is additionally minted as a soulbound ERC-721
and the transaction hash is recorded. When it is not, the certificate is still fully
verifiable and the UI says plainly that it has not been anchored, rather than
implying otherwise.

## Project structure

```
EduWallet/
├── contracts/                          # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── SoulboundCertificate.sol    # Non-transferable NFT (ERC-721 + ERC-5192)
│   │   ├── CredentialRegistry.sol      # Issuer & credential metadata registry
│   │   └── RecoveryManager.sol         # Social recovery with institutional guardians
│   ├── test/                           # 48 tests
│   └── scripts/deploy.js
└── frontend/                           # Next.js 16 application
    └── src/
        ├── app/                        # Pages & API routes
        ├── components/                 # UI components
        └── lib/
            ├── db.ts                   # Storage adapter (KV → file → memory)
            ├── crypto.ts               # Password hashing, JWT, key custody
            ├── credential.ts           # Canonical hashing, signing, W3C VC export
            ├── verification.ts         # Integrity checks and verification outcomes
            ├── issuance.ts             # Issuance pipeline (single + bulk CSV)
            └── blockchain.ts           # Contract calls with timeouts & degradation
```

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local     # fill in what you have; everything is optional
npm run dev
```

Then register an institution account, register a student, issue a certificate from
the institution dashboard, and open the verification link.

## Smart contract commands

```bash
npm run contracts:compile
npm run contracts:test
npm run contracts:deploy
```

## Features

### For institutions
- **Single and bulk issuance** — issue one certificate, or a whole cohort from a CSV
  with a dry-run validation pass first.
- **Revocation with a stated reason** — a revoked certificate immediately shows as
  withdrawn on every link already handed out, with the reason visible. The original
  signature is preserved, because the document really was issued.
- **Analytics** — issuance volume by month, credential mix by degree type, which
  certificates are being checked, and recent verification activity.

### For students
- **Expiring, privacy-scoped share links** — a link that stops working after 24 hours,
  7 days, or 30 days, and can withhold the holder's name and wallet while still
  proving the institution signed the qualification.
- **W3C Verifiable Credential export** — download any certificate as a JSON-LD
  document with its signature attached, readable outside this app.
- **Public credential profile** at `/u/<wallet>` — a citable, verifiable résumé that
  lists only active, signature-valid credentials.
- **Verification audit trail** — how many times each credential was checked, and
  roughly from where.
- **Social recovery** — M-of-N institutional guardians.

### For verifiers
- **No account required.** Paste a link, a credential ID, or a wallet address at
  `/verify`.
- **Three explicit checks** — signed by the issuer, content matches the signed hash,
  and not revoked — each shown pass or fail rather than a single green tick.
- **Tamper detection** — if the stored certificate no longer matches its signature,
  verification reports that specifically instead of showing a valid-looking document.

## Security model

- Passwords are hashed with PBKDF2-SHA512 (100k iterations, per-user salt).
- Each wallet key is sealed twice: once with AES-256-GCM under a key derived from the
  user's password (per-user salt), and once under the server master key so the backend
  can sign certificates on an institution's behalf at issuance time. The first copy is
  unreadable by the server; the second is what makes custodial issuance possible.
- Session tokens are HMAC-SHA256 JWTs with constant-time signature comparison, and the
  client validates them against `/api/auth/me` on load instead of trusting
  `localStorage`.
- Auth endpoints are rate-limited per client.
- Soulbound tokens cannot be transferred, approved, or sold.

## Storage

`frontend/src/lib/db.ts` picks a backend at runtime:

| Mode | When | Durability |
|:--|:--|:--|
| `kv` | `KV_REST_API_URL` + `KV_REST_API_TOKEN` set | Durable, shared across instances |
| `file` | Local development | Durable on that machine (`frontend/data/`) |
| `memory` | Serverless with no KV configured | **Lost on cold start** |

**On Vercel, set up a KV / Upstash Redis database.** Without one, each serverless
instance keeps its own copy of the data in memory and accounts disappear between
requests. The app detects this and shows a banner saying so rather than failing
silently.

## Tech stack

| Layer | Technology |
|:---|:---|
| Blockchain | Polygon Amoy (EVM, Solidity 0.8.27) |
| Smart contracts | Hardhat, OpenZeppelin v5, ERC-721, ERC-5192 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Next.js route handlers, custom JWT auth |
| Storage | Upstash/Vercel KV, IPFS (Pinata) for certificate metadata |
| Credentials | keccak256 + EIP-191 signatures, W3C VC Data Model 2.0 export |
