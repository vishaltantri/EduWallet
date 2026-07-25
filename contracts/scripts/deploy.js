import hre from "hardhat";
import fs from "fs";

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("╔════════════════════════════════════════════════╗");
  console.log("║       EduWallet Contract Deployment            ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH/MATIC");
  console.log("");

  // ─── 1. Deploy SoulboundCertificate ───
  console.log("1/3 Deploying SoulboundCertificate...");
  const SoulboundCertificate = await ethers.getContractFactory("SoulboundCertificate");
  const soulbound = await SoulboundCertificate.deploy();
  await soulbound.waitForDeployment();
  const soulboundAddress = await soulbound.getAddress();
  console.log("    ✅ SoulboundCertificate:", soulboundAddress);

  // ─── 2. Deploy CredentialRegistry ───
  console.log("2/3 Deploying CredentialRegistry...");
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("    ✅ CredentialRegistry:", registryAddress);

  // ─── 3. Deploy RecoveryManager ───
  console.log("3/3 Deploying RecoveryManager...");
  const RecoveryManager = await ethers.getContractFactory("RecoveryManager");
  const recovery = await RecoveryManager.deploy();
  await recovery.waitForDeployment();
  const recoveryAddress = await recovery.getAddress();
  console.log("    ✅ RecoveryManager:", recoveryAddress);

  console.log("");
  console.log("═══════════════════════════════════════════════");
  console.log("All contracts deployed successfully!");
  console.log("═══════════════════════════════════════════════");
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      SoulboundCertificate: soulboundAddress,
      CredentialRegistry: registryAddress,
      RecoveryManager: recoveryAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputPath = "./deployments.json";
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
