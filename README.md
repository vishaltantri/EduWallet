# EduWallet — Decentralized Academic Credentials

A blockchain-based system for issuing, managing, and verifying tamper-proof academic credentials using Soulbound Tokens on Polygon.

## 🏗 Project Structure

```
EduWallet/
├── contracts/               # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── SoulboundCertificate.sol    # Non-transferable NFT (ERC-721 + ERC-5192)
│   │   ├── CredentialRegistry.sol      # Issuer & credential metadata registry
│   │   └── RecoveryManager.sol         # Social recovery with institutional guardians
│   ├── test/                           # 48 comprehensive tests
│   ├── scripts/deploy.js               # Deployment script
│   └── hardhat.config.js
├── frontend/                # Next.js web application
│   └── src/
│       ├── app/             # Pages & API routes
│       ├── components/      # Reusable UI components
│       └── lib/             # Auth context, user store
└── EduWallet_Project_Documentation.docx
```

## 🚀 Quick Start

```bash
# 1. Start the frontend dev server
npm run dev

# 2. Open http://localhost:3000

# 3. Register as a university, then as a student
# 4. Issue a certificate from the university dashboard
# 5. View it on the student dashboard
# 6. Share the public verification link
```

## 📜 Smart Contract Commands

```bash
npm run contracts:compile    # Compile Solidity contracts
npm run contracts:test       # Run all 48 tests
npm run contracts:deploy     # Deploy to Polygon Amoy testnet
```

## 🔑 Key Features

- **Soulbound Certificates** — Non-transferable NFTs that can't be sold or faked
- **No Seed Phrases** — Users login with email/password; wallets are managed server-side
- **Social Recovery** — Institutional guardians (registrar, advisor) can help recover accounts
- **Instant Verification** — Public link, no login required
- **Near-Zero Cost** — Polygon L2 means fractions of a cent per certificate

## 🛡 Security Model

- Private keys are encrypted with AES-256-GCM, derived from user passwords
- No centralized `.env` file with keys (addressing Gap 8 in the literature)
- Soulbound tokens prevent credential trading
- M-of-N guardian recovery with 24-hour cooldown prevents rushed takeovers

## 📋 Environment Setup

1. Copy `contracts/.env.example` to `contracts/.env` and fill in:
   - `ALCHEMY_API_KEY` — from [alchemy.com](https://alchemy.com)
   - `DEPLOYER_PRIVATE_KEY` — MetaMask export (test wallet only!)
   - `POLYGONSCAN_API_KEY` — for contract verification

## 📚 Tech Stack

| Layer | Technology |
|:---|:---|
| Blockchain | Polygon Amoy (EVM, Solidity 0.8.27) |
| Smart Contracts | Hardhat, OpenZeppelin v5, ERC-721, ERC-5192 |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes, JWT Auth |
| Storage | IPFS (Pinata) for certificate PDFs |
| Wallet | Server-managed EOA with AES-256-GCM encryption |
