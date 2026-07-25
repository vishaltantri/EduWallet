import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

const { ethers } = hre;

describe("EduWallet Smart Contracts", function () {
  let soulbound, registry, recovery;
  let owner, university, student, student2;
  let guardian1, guardian2, guardian3;

  beforeEach(async function () {
    [owner, university, student, student2, guardian1, guardian2, guardian3] =
      await ethers.getSigners();

    // Deploy all contracts
    const SoulboundCertificate = await ethers.getContractFactory("SoulboundCertificate");
    soulbound = await SoulboundCertificate.deploy();

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy();

    const RecoveryManager = await ethers.getContractFactory("RecoveryManager");
    recovery = await RecoveryManager.deploy();
  });

  // ═══════════════════════════════════════════════════════
  // SoulboundCertificate Tests
  // ═══════════════════════════════════════════════════════
  describe("SoulboundCertificate", function () {
    beforeEach(async function () {
      // Authorize university as issuer
      await soulbound.authorizeIssuer(university.address);
    });

    describe("Issuer Management", function () {
      it("should authorize an issuer", async function () {
        expect(await soulbound.authorizedIssuers(university.address)).to.be.true;
      });

      it("should remove an issuer", async function () {
        await soulbound.removeIssuer(university.address);
        expect(await soulbound.authorizedIssuers(university.address)).to.be.false;
      });

      it("should only allow owner to authorize issuers", async function () {
        await expect(
          soulbound.connect(student).authorizeIssuer(student.address)
        ).to.be.revertedWithCustomError(soulbound, "OwnableUnauthorizedAccount");
      });
    });

    describe("Certificate Issuance", function () {
      it("should issue a certificate to a student", async function () {
        const metadataURI = "ipfs://QmTestHash123";
        const tx = await soulbound
          .connect(university)
          .issueCertificate(student.address, metadataURI);

        await expect(tx).to.emit(soulbound, "CertificateIssued");

        // Verify ownership
        expect(await soulbound.ownerOf(1)).to.equal(student.address);
      });

      it("should store correct certificate data", async function () {
        const metadataURI = "ipfs://QmTestHash123";
        await soulbound
          .connect(university)
          .issueCertificate(student.address, metadataURI);

        const cert = await soulbound.getCertificate(1);
        expect(cert.issuer).to.equal(university.address);
        expect(cert.student).to.equal(student.address);
        expect(cert.metadataURI).to.equal(metadataURI);
        expect(cert.revoked).to.be.false;
      });

      it("should increment token IDs", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash1");
        await soulbound.connect(university).issueCertificate(student2.address, "ipfs://hash2");

        expect(await soulbound.ownerOf(1)).to.equal(student.address);
        expect(await soulbound.ownerOf(2)).to.equal(student2.address);
      });

      it("should reject non-issuer minting", async function () {
        await expect(
          soulbound.connect(student).issueCertificate(student.address, "ipfs://hash")
        ).to.be.revertedWithCustomError(soulbound, "NotIssuer");
      });

      it("should track student certificates", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash1");
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash2");

        const tokens = await soulbound.getStudentCertificates(student.address);
        expect(tokens.length).to.equal(2);
        expect(tokens[0]).to.equal(1);
        expect(tokens[1]).to.equal(2);
      });
    });

    describe("Certificate Verification", function () {
      it("should verify a valid certificate", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");

        const [isValid, certStudent, issuer, uri, issuedAt] =
          await soulbound.verifyCertificate(1);

        expect(isValid).to.be.true;
        expect(certStudent).to.equal(student.address);
        expect(issuer).to.equal(university.address);
        expect(uri).to.equal("ipfs://hash");
        expect(issuedAt).to.be.gt(0);
      });

      it("should show revoked certificate as invalid", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");
        await soulbound.connect(university).revokeCertificate(1);

        const [isValid] = await soulbound.verifyCertificate(1);
        expect(isValid).to.be.false;
      });

      it("should revert for non-existent certificate", async function () {
        await expect(soulbound.verifyCertificate(999)).to.be.revertedWithCustomError(
          soulbound,
          "CertificateDoesNotExist"
        );
      });
    });

    describe("Certificate Revocation", function () {
      it("should revoke a certificate", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");
        await soulbound.connect(university).revokeCertificate(1);

        const cert = await soulbound.getCertificate(1);
        expect(cert.revoked).to.be.true;
      });

      it("should reject revocation by non-issuer", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");

        await expect(
          soulbound.connect(student).revokeCertificate(1)
        ).to.be.revertedWithCustomError(soulbound, "NotIssuer");
      });

      it("should reject double revocation", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");
        await soulbound.connect(university).revokeCertificate(1);

        await expect(
          soulbound.connect(university).revokeCertificate(1)
        ).to.be.revertedWithCustomError(soulbound, "CertificateAlreadyRevoked");
      });
    });

    describe("Soulbound Properties", function () {
      it("should prevent token transfers", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");

        await expect(
          soulbound.connect(student).transferFrom(student.address, student2.address, 1)
        ).to.be.revertedWithCustomError(soulbound, "Soulbound");
      });

      it("should prevent approvals", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");

        await expect(
          soulbound.connect(student).approve(student2.address, 1)
        ).to.be.revertedWithCustomError(soulbound, "Soulbound");
      });

      it("should prevent setApprovalForAll", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");

        await expect(
          soulbound.connect(student).setApprovalForAll(student2.address, true)
        ).to.be.revertedWithCustomError(soulbound, "Soulbound");
      });

      it("should report token as locked (ERC-5192)", async function () {
        await soulbound.connect(university).issueCertificate(student.address, "ipfs://hash");
        expect(await soulbound.locked(1)).to.be.true;
      });

      it("should support ERC-5192 interface", async function () {
        // ERC-5192 interface ID: 0xb45a3c0e
        expect(await soulbound.supportsInterface("0xb45a3c0e")).to.be.true;
      });

      it("should return correct tokenURI", async function () {
        const uri = "ipfs://QmTestMetadata";
        await soulbound.connect(university).issueCertificate(student.address, uri);
        expect(await soulbound.tokenURI(1)).to.equal(uri);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // CredentialRegistry Tests
  // ═══════════════════════════════════════════════════════
  describe("CredentialRegistry", function () {
    describe("Issuer Management", function () {
      it("should register an issuer", async function () {
        await registry.registerIssuer(university.address, "Test University");

        const info = await registry.getIssuerInfo(university.address);
        expect(info.institutionName).to.equal("Test University");
        expect(info.isActive).to.be.true;
      });

      it("should reject duplicate registration", async function () {
        await registry.registerIssuer(university.address, "Test University");

        await expect(
          registry.registerIssuer(university.address, "Test University Again")
        ).to.be.revertedWithCustomError(registry, "IssuerAlreadyRegistered");
      });

      it("should unregister an issuer", async function () {
        await registry.registerIssuer(university.address, "Test University");
        await registry.unregisterIssuer(university.address);

        expect(await registry.isActiveIssuer(university.address)).to.be.false;
      });

      it("should only allow owner to register issuers", async function () {
        await expect(
          registry.connect(student).registerIssuer(university.address, "Fake Uni")
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });

    describe("Credential Registration", function () {
      beforeEach(async function () {
        await registry.registerIssuer(university.address, "Test University");
      });

      it("should register a credential", async function () {
        await registry
          .connect(university)
          .registerCredential(
            1,
            student.address,
            "John Doe",
            "Bachelor of Science",
            "Computer Science",
            "QmIPFSHash123"
          );

        const cred = await registry.getCredential(1);
        expect(cred.studentName).to.equal("John Doe");
        expect(cred.degreeType).to.equal("Bachelor of Science");
        expect(cred.major).to.equal("Computer Science");
        expect(cred.institutionName).to.equal("Test University");
        expect(cred.ipfsHash).to.equal("QmIPFSHash123");
        expect(cred.exists).to.be.true;
      });

      it("should track student credentials", async function () {
        await registry
          .connect(university)
          .registerCredential(1, student.address, "John", "BSc", "CS", "hash1");
        await registry
          .connect(university)
          .registerCredential(2, student.address, "John", "MSc", "CS", "hash2");

        const tokens = await registry.getStudentCredentials(student.address);
        expect(tokens.length).to.equal(2);
      });

      it("should reject duplicate token registration", async function () {
        await registry
          .connect(university)
          .registerCredential(1, student.address, "John", "BSc", "CS", "hash1");

        await expect(
          registry
            .connect(university)
            .registerCredential(1, student.address, "John", "BSc", "CS", "hash1")
        ).to.be.revertedWithCustomError(registry, "CredentialAlreadyRegistered");
      });

      it("should reject unregistered issuer", async function () {
        await expect(
          registry
            .connect(student)
            .registerCredential(1, student.address, "John", "BSc", "CS", "hash1")
        ).to.be.revertedWithCustomError(registry, "OnlyIssuer");
      });

      it("should track total credentials", async function () {
        await registry
          .connect(university)
          .registerCredential(1, student.address, "John", "BSc", "CS", "hash1");

        expect(await registry.totalCredentials()).to.equal(1);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // RecoveryManager Tests
  // ═══════════════════════════════════════════════════════
  describe("RecoveryManager", function () {
    describe("Guardian Setup", function () {
      it("should setup guardians with threshold", async function () {
        await recovery
          .connect(student)
          .setupGuardians(
            [guardian1.address, guardian2.address, guardian3.address],
            2
          );

        const guardians = await recovery.getGuardians(student.address);
        expect(guardians.length).to.equal(3);
        expect(await recovery.getThreshold(student.address)).to.equal(2);
        expect(await recovery.isConfigured(student.address)).to.be.true;
      });

      it("should check guardian status", async function () {
        await recovery
          .connect(student)
          .setupGuardians(
            [guardian1.address, guardian2.address, guardian3.address],
            2
          );

        expect(await recovery.isGuardian(student.address, guardian1.address)).to.be.true;
        expect(await recovery.isGuardian(student.address, owner.address)).to.be.false;
      });

      it("should reject fewer than 2 guardians", async function () {
        await expect(
          recovery.connect(student).setupGuardians([guardian1.address], 1)
        ).to.be.revertedWithCustomError(recovery, "InvalidGuardianConfig");
      });

      it("should reject threshold less than 2", async function () {
        await expect(
          recovery
            .connect(student)
            .setupGuardians([guardian1.address, guardian2.address], 1)
        ).to.be.revertedWithCustomError(recovery, "InvalidGuardianConfig");
      });

      it("should reject threshold greater than guardian count", async function () {
        await expect(
          recovery
            .connect(student)
            .setupGuardians([guardian1.address, guardian2.address], 3)
        ).to.be.revertedWithCustomError(recovery, "InvalidGuardianConfig");
      });

      it("should reject self as guardian", async function () {
        await expect(
          recovery
            .connect(student)
            .setupGuardians([student.address, guardian2.address], 2)
        ).to.be.revertedWithCustomError(recovery, "GuardianCannotBeSelf");
      });

      it("should allow reconfiguring guardians", async function () {
        await recovery
          .connect(student)
          .setupGuardians([guardian1.address, guardian2.address], 2);

        await recovery
          .connect(student)
          .setupGuardians(
            [guardian2.address, guardian3.address, owner.address],
            2
          );

        const guardians = await recovery.getGuardians(student.address);
        expect(guardians.length).to.equal(3);
        expect(await recovery.isGuardian(student.address, guardian1.address)).to.be.false;
        expect(await recovery.isGuardian(student.address, guardian3.address)).to.be.true;
      });
    });

    describe("Recovery Flow", function () {
      const newAddress = "0x1234567890123456789012345678901234567890";

      beforeEach(async function () {
        await recovery
          .connect(student)
          .setupGuardians(
            [guardian1.address, guardian2.address, guardian3.address],
            2
          );
      });

      it("should initiate recovery by guardian", async function () {
        await expect(
          recovery.connect(guardian1).initiateRecovery(student.address, newAddress)
        ).to.emit(recovery, "RecoveryInitiated");
      });

      it("should reject initiation by non-guardian", async function () {
        await expect(
          recovery.connect(owner).initiateRecovery(student.address, newAddress)
        ).to.be.revertedWithCustomError(recovery, "NotGuardian");
      });

      it("should approve recovery by second guardian", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);

        await expect(
          recovery.connect(guardian2).approveRecovery(student.address)
        ).to.emit(recovery, "RecoveryApproved");
      });

      it("should reject duplicate approval", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);

        await expect(
          recovery.connect(guardian1).approveRecovery(student.address)
        ).to.be.revertedWithCustomError(recovery, "AlreadyApproved");
      });

      it("should execute recovery after threshold + cooldown", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);
        await recovery.connect(guardian2).approveRecovery(student.address);

        // Fast forward past cooldown (24 hours)
        await time.increase(24 * 60 * 60 + 1);

        await expect(recovery.executeRecovery(student.address))
          .to.emit(recovery, "RecoveryExecuted");

        // Verify address mapping
        expect(await recovery.recoveredAddresses(student.address)).to.equal(newAddress);
      });

      it("should reject execution before cooldown", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);
        await recovery.connect(guardian2).approveRecovery(student.address);

        // Don't wait for cooldown
        await expect(
          recovery.executeRecovery(student.address)
        ).to.be.revertedWithCustomError(recovery, "CooldownNotPassed");
      });

      it("should reject execution before threshold", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);

        // Only 1 approval, need 2
        await time.increase(24 * 60 * 60 + 1);

        await expect(
          recovery.executeRecovery(student.address)
        ).to.be.revertedWithCustomError(recovery, "ThresholdNotMet");
      });

      it("should allow student to cancel recovery", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);

        await expect(recovery.connect(student).cancelRecovery())
          .to.emit(recovery, "RecoveryCancelled");
      });

      it("should reject duplicate recovery initiation", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);

        await expect(
          recovery.connect(guardian2).initiateRecovery(student.address, newAddress)
        ).to.be.revertedWithCustomError(recovery, "RecoveryAlreadyActive");
      });

      it("should copy guardian config to new address after recovery", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);
        await recovery.connect(guardian2).approveRecovery(student.address);
        await time.increase(24 * 60 * 60 + 1);
        await recovery.executeRecovery(student.address);

        // Check guardian config was copied
        const newGuardians = await recovery.getGuardians(newAddress);
        expect(newGuardians.length).to.equal(3);
        expect(await recovery.isConfigured(newAddress)).to.be.true;
      });

      it("should resolve address chain", async function () {
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddress);
        await recovery.connect(guardian2).approveRecovery(student.address);
        await time.increase(24 * 60 * 60 + 1);
        await recovery.executeRecovery(student.address);

        // resolveAddress should follow the chain
        expect(await recovery.resolveAddress(student.address)).to.equal(newAddress);
      });
    });

    describe("Recovery Status", function () {
      it("should return correct recovery status", async function () {
        await recovery
          .connect(student)
          .setupGuardians(
            [guardian1.address, guardian2.address, guardian3.address],
            2
          );

        const newAddr = "0x1234567890123456789012345678901234567890";
        await recovery.connect(guardian1).initiateRecovery(student.address, newAddr);

        const [isActive, newAddress, initiatedBy, , approvalCount, threshold] =
          await recovery.getRecoveryStatus(student.address);

        expect(isActive).to.be.true;
        expect(newAddress).to.equal(newAddr);
        expect(initiatedBy).to.equal(guardian1.address);
        expect(approvalCount).to.equal(1);
        expect(threshold).to.equal(2);
      });
    });
  });
});
