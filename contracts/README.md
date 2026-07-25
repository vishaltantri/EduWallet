# EduWallet Contracts

Smart contracts for the EduWallet decentralized academic credentials system.

## Contracts

| Contract | Purpose |
|:---|:---|
| `SoulboundCertificate.sol` | Non-transferable NFT (ERC-721 + ERC-5192) for academic credentials |
| `CredentialRegistry.sol` | Central registry for issuers, students, and credential metadata |
| `RecoveryManager.sol` | Institutional-guardian social recovery for student accounts |

## Setup

```bash
npm install
cp .env.example .env  # Fill in your keys
```

## Commands

```bash
npx hardhat compile          # Compile contracts
npx hardhat test             # Run tests
npx hardhat run scripts/deploy.js --network polygonAmoy  # Deploy to testnet
```

## Network

- **Polygon Amoy Testnet** (Chain ID: 80002)
- Get free test MATIC: https://faucet.polygon.technology
