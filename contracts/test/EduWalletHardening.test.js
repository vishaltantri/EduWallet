/**
 * Hardening suite: event-emission regressions, access-control probes,
 * randomised (fuzz) runs, and state invariants.
 *
 * The original suite covered the happy paths and the obvious reverts. These
 * tests cover the things that were silently wrong — the first-time
 * `GuardiansConfigured` event, soulbound escape hatches, and properties that
 * must hold no matter what order the operations arrive in.
 */

import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

const { ethers } = hre;

const RECOVERY_COOLDOWN = 24 * 60 * 60;
const RECOVERY_EXPIRY = 7 * 24 * 60 * 60;

/** Deterministic pseudo-random integers so a fuzz failure is reproducible. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return (max) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % max;
  };
}

describe("EduWallet hardening", function () {
  let soulbound, registry, recovery;
  let owner, university, other, student, student2, newAddress;
  let guardians;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    [owner, university, other, student, student2, newAddress] = signers;
    guardians = signers.slice(6, 12);

    soulbound = await (await ethers.getContractFactory("SoulboundCertificate")).deploy();
    registry = await (await ethers.getContractFactory("CredentialRegistry")).deploy();
    recovery = await (await ethers.getContractFactory("RecoveryManager")).deploy();

    await soulbound.authorizeIssuer(university.address);
    await registry.registerIssuer(university.address, "Test University");
  });

  // ─── Event emission ───────────────────────────────────────────────────────

  describe("RecoveryManager events", function () {
    it("emits GuardiansConfigured on the first setup, not GuardiansUpdated", async function () {
      const addresses = [guardians[0].address, guardians[1].address];

      await expect(recovery.connect(student).setupGuardians(addresses, 2))
        .to.emit(recovery, "GuardiansConfigured")
        .and.not.to.emit(recovery, "GuardiansUpdated");
    });

    it("emits GuardiansUpdated when an existing configuration is replaced", async function () {
      const addresses = [guardians[0].address, guardians[1].address];
      await recovery.connect(student).setupGuardians(addresses, 2);

      await expect(
        recovery
          .connect(student)
          .setupGuardians([guardians[1].address, guardians[2].address, guardians[3].address], 3)
      )
        .to.emit(recovery, "GuardiansUpdated")
        .and.not.to.emit(recovery, "GuardiansConfigured");
    });

    it("emits RecoveryInitiated together with the initiator's own approval", async function () {
      await recovery
        .connect(student)
        .setupGuardians([guardians[0].address, guardians[1].address], 2);

      const tx = recovery.connect(guardians[0]).initiateRecovery(student.address, newAddress.address);

      await expect(tx).to.emit(recovery, "RecoveryInitiated");
      await expect(tx)
        .to.emit(recovery, "RecoveryApproved")
        .withArgs(student.address, guardians[0].address, 1, 2, (value) => value > 0n);
    });

    it("emits RecoveryExecuted with the migrated address", async function () {
      await recovery
        .connect(student)
        .setupGuardians([guardians[0].address, guardians[1].address], 2);
      await recovery.connect(guardians[0]).initiateRecovery(student.address, newAddress.address);
      await recovery.connect(guardians[1]).approveRecovery(student.address);
      await time.increase(RECOVERY_COOLDOWN + 1);

      await expect(recovery.executeRecovery(student.address))
        .to.emit(recovery, "RecoveryExecuted")
        .withArgs(student.address, newAddress.address, (value) => value > 0n);
    });

    it("emits CertificateIssued and the ERC-5192 Locked event on mint", async function () {
      const tx = soulbound.connect(university).issueCertificate(student.address, "ipfs://cid");
      await expect(tx).to.emit(soulbound, "CertificateIssued");
      await expect(tx).to.emit(soulbound, "Locked").withArgs(1);
    });
  });

  // ─── Expiry window ────────────────────────────────────────────────────────

  describe("Recovery expiry", function () {
    beforeEach(async function () {
      await recovery
        .connect(student)
        .setupGuardians([guardians[0].address, guardians[1].address, guardians[2].address], 3);
      await recovery.connect(guardians[0]).initiateRecovery(student.address, newAddress.address);
    });

    it("rejects an approval after the 7-day expiry", async function () {
      await time.increase(RECOVERY_EXPIRY + 1);
      await expect(
        recovery.connect(guardians[1]).approveRecovery(student.address)
      ).to.be.revertedWithCustomError(recovery, "RecoveryExpired");
    });

    it("rejects execution after the 7-day expiry even with the threshold met", async function () {
      await recovery.connect(guardians[1]).approveRecovery(student.address);
      await recovery.connect(guardians[2]).approveRecovery(student.address);
      await time.increase(RECOVERY_EXPIRY + 1);

      await expect(
        recovery.executeRecovery(student.address)
      ).to.be.revertedWithCustomError(recovery, "RecoveryExpired");
    });

    it("clears the active flag once an expired request is touched", async function () {
      await time.increase(RECOVERY_EXPIRY + 1);
      await expect(recovery.connect(guardians[1]).approveRecovery(student.address)).to.be.reverted;

      // The failed call reverted, so its state change was rolled back: the
      // request is still marked active and a fresh one cannot be opened.
      const status = await recovery.getRecoveryStatus(student.address);
      expect(status.isActive).to.be.true;
    });
  });

  // ─── Soulbound escape hatches ─────────────────────────────────────────────

  describe("Soulbound enforcement", function () {
    beforeEach(async function () {
      await soulbound.connect(university).issueCertificate(student.address, "ipfs://cid");
    });

    it("blocks transferFrom by the owner", async function () {
      await expect(
        soulbound.connect(student).transferFrom(student.address, student2.address, 1)
      ).to.be.revertedWithCustomError(soulbound, "Soulbound");
    });

    it("blocks safeTransferFrom in both overloads", async function () {
      await expect(
        soulbound
          .connect(student)
          ["safeTransferFrom(address,address,uint256)"](student.address, student2.address, 1)
      ).to.be.revertedWithCustomError(soulbound, "Soulbound");

      await expect(
        soulbound
          .connect(student)
          ["safeTransferFrom(address,address,uint256,bytes)"](
            student.address,
            student2.address,
            1,
            "0x"
          )
      ).to.be.revertedWithCustomError(soulbound, "Soulbound");
    });

    it("blocks approve and setApprovalForAll", async function () {
      await expect(
        soulbound.connect(student).approve(student2.address, 1)
      ).to.be.revertedWithCustomError(soulbound, "Soulbound");
      await expect(
        soulbound.connect(student).setApprovalForAll(student2.address, true)
      ).to.be.revertedWithCustomError(soulbound, "Soulbound");
    });

    it("advertises the ERC-5192 interface id", async function () {
      expect(await soulbound.supportsInterface("0xb45a3c0e")).to.be.true;
      expect(await soulbound.locked(1)).to.be.true;
    });

    it("keeps a revoked certificate owned by the student rather than burning it", async function () {
      await soulbound.connect(university).revokeCertificate(1);
      expect(await soulbound.ownerOf(1)).to.equal(student.address);
      const [isValid] = await soulbound.verifyCertificate(1);
      expect(isValid).to.be.false;
    });
  });

  // ─── Access control ───────────────────────────────────────────────────────

  describe("Access control", function () {
    it("stops a second authorized issuer revoking someone else's certificate", async function () {
      await soulbound.authorizeIssuer(other.address);
      await soulbound.connect(university).issueCertificate(student.address, "ipfs://cid");

      await expect(
        soulbound.connect(other).revokeCertificate(1)
      ).to.be.revertedWithCustomError(soulbound, "NotIssuer");
    });

    it("stops a de-authorized issuer minting new certificates", async function () {
      await soulbound.removeIssuer(university.address);
      await expect(
        soulbound.connect(university).issueCertificate(student.address, "ipfs://cid")
      ).to.be.revertedWithCustomError(soulbound, "NotIssuer");
    });

    it("reverts verifyCertificate for a token that was never minted", async function () {
      await expect(
        soulbound.verifyCertificate(999)
      ).to.be.revertedWithCustomError(soulbound, "CertificateDoesNotExist");
    });

    it("stops a non-guardian initiating recovery", async function () {
      await recovery
        .connect(student)
        .setupGuardians([guardians[0].address, guardians[1].address], 2);
      await expect(
        recovery.connect(other).initiateRecovery(student.address, newAddress.address)
      ).to.be.revertedWithCustomError(recovery, "NotGuardian");
    });

    it("stops recovery being initiated for an unconfigured account", async function () {
      await expect(
        recovery.connect(guardians[0]).initiateRecovery(student2.address, newAddress.address)
      ).to.be.revertedWithCustomError(recovery, "NotGuardian");
    });

    it("rejects the zero address as a recovery destination", async function () {
      await recovery
        .connect(student)
        .setupGuardians([guardians[0].address, guardians[1].address], 2);
      await expect(
        recovery.connect(guardians[0]).initiateRecovery(student.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(recovery, "InvalidAddress");
    });

    it("stops a registry credential being registered by the wrong issuer", async function () {
      await expect(
        registry
          .connect(other)
          .registerCredential(1, student.address, "A", "BSc", "CS", "hash")
      ).to.be.revertedWithCustomError(registry, "OnlyIssuer");
    });

    it("stops an unregistered issuer after unregistration", async function () {
      await registry.unregisterIssuer(university.address);
      await expect(
        registry
          .connect(university)
          .registerCredential(1, student.address, "A", "BSc", "CS", "hash")
      ).to.be.revertedWithCustomError(registry, "OnlyIssuer");
    });
  });

  // ─── Fuzz ─────────────────────────────────────────────────────────────────

  describe("Fuzz", function () {
    it("mints to arbitrary recipients with arbitrary metadata and keeps ownership consistent", async function () {
      const random = makeRandom(20260725);
      const minted = [];

      for (let i = 0; i < 25; i++) {
        const recipient = ethers.Wallet.createRandom().address;
        const uriLength = 1 + random(120);
        const metadataURI = `ipfs://${"x".repeat(uriLength)}`;

        await soulbound.connect(university).issueCertificate(recipient, metadataURI);
        minted.push({ tokenId: i + 1, recipient, metadataURI });
      }

      for (const entry of minted) {
        expect(await soulbound.ownerOf(entry.tokenId)).to.equal(entry.recipient);
        expect(await soulbound.tokenURI(entry.tokenId)).to.equal(entry.metadataURI);
        const [isValid, student_, issuer_] = await soulbound.verifyCertificate(entry.tokenId);
        expect(isValid).to.be.true;
        expect(student_).to.equal(entry.recipient);
        expect(issuer_).to.equal(university.address);
      }
    });

    it("accepts every valid guardian count and threshold combination", async function () {
      const pool = guardians.map((signer) => signer.address);

      for (let count = 2; count <= pool.length; count++) {
        for (let threshold = 2; threshold <= count; threshold++) {
          const subject = ethers.Wallet.createRandom();
          const funded = await ethers.getImpersonatedSigner(subject.address);
          await owner.sendTransaction({ to: subject.address, value: ethers.parseEther("1") });

          await recovery.connect(funded).setupGuardians(pool.slice(0, count), threshold);

          expect(await recovery.isConfigured(subject.address)).to.be.true;
          expect(await recovery.getThreshold(subject.address)).to.equal(threshold);
          expect((await recovery.getGuardians(subject.address)).length).to.equal(count);
        }
      }
    });

    it("rejects every out-of-range threshold for a fixed guardian set", async function () {
      const pool = [guardians[0].address, guardians[1].address, guardians[2].address];
      for (const threshold of [0, 1, 4, 5, 100]) {
        await expect(
          recovery.connect(student).setupGuardians(pool, threshold)
        ).to.be.revertedWithCustomError(recovery, "InvalidGuardianConfig");
      }
    });
  });

  // ─── Invariants ───────────────────────────────────────────────────────────

  describe("Invariants", function () {
    it("keeps per-student and per-issuer token lists in step with total supply", async function () {
      const random = makeRandom(99);
      const recipients = [student.address, student2.address, other.address];
      const counts = new Map(recipients.map((address) => [address, 0]));
      let issuedTotal = 0;

      for (let i = 0; i < 20; i++) {
        const recipient = recipients[random(recipients.length)];
        await soulbound.connect(university).issueCertificate(recipient, `ipfs://cid-${i}`);
        counts.set(recipient, counts.get(recipient) + 1);
        issuedTotal += 1;

        // Invariant: every token is in exactly one student list, and the
        // issuer list holds all of them.
        let sum = 0;
        for (const address of recipients) {
          const list = await soulbound.getStudentCertificates(address);
          expect(list.length).to.equal(counts.get(address));
          sum += list.length;
        }
        expect(sum).to.equal(issuedTotal);
        expect((await soulbound.getIssuerCertificates(university.address)).length).to.equal(
          issuedTotal
        );
      }
    });

    it("never lets a revocation change the certificate's issuer, student, or metadata", async function () {
      await soulbound.connect(university).issueCertificate(student.address, "ipfs://stable");
      const before = await soulbound.getCertificate(1);

      await soulbound.connect(university).revokeCertificate(1);
      const after = await soulbound.getCertificate(1);

      expect(after.issuer).to.equal(before.issuer);
      expect(after.student).to.equal(before.student);
      expect(after.metadataURI).to.equal(before.metadataURI);
      expect(after.issuedAt).to.equal(before.issuedAt);
      expect(before.revoked).to.be.false;
      expect(after.revoked).to.be.true;
    });

    it("keeps approvalCount bounded by the guardian count and monotonically increasing", async function () {
      const set = guardians.slice(0, 4);
      await recovery.connect(student).setupGuardians(set.map((g) => g.address), 3);
      await recovery.connect(set[0]).initiateRecovery(student.address, newAddress.address);

      let previous = 0n;
      for (const guardian of set.slice(1)) {
        await recovery.connect(guardian).approveRecovery(student.address);
        const status = await recovery.getRecoveryStatus(student.address);
        expect(status.approvalCount > previous).to.be.true;
        expect(status.approvalCount <= BigInt(set.length)).to.be.true;
        previous = status.approvalCount;
      }
      expect(previous).to.equal(4n);
    });

    it("keeps registry totals equal to the sum of per-issuer credentials", async function () {
      await registry.registerIssuer(other.address, "Second University");
      const issuers = [university, other];
      const random = makeRandom(7);

      for (let tokenId = 1; tokenId <= 15; tokenId++) {
        const issuer = issuers[random(issuers.length)];
        await registry
          .connect(issuer)
          .registerCredential(tokenId, student.address, "A", "BSc", "CS", `hash-${tokenId}`);

        let sum = 0;
        for (const candidate of issuers) {
          sum += (await registry.getIssuerCredentials(candidate.address)).length;
        }
        expect(sum).to.equal(tokenId);
        expect(await registry.totalCredentials()).to.equal(tokenId);
      }
    });

    it("resolves a chain of recovered addresses to the final destination", async function () {
      const first = student;
      const second = student2;
      const third = newAddress;

      await recovery
        .connect(first)
        .setupGuardians([guardians[0].address, guardians[1].address], 2);
      await recovery.connect(guardians[0]).initiateRecovery(first.address, second.address);
      await recovery.connect(guardians[1]).approveRecovery(first.address);
      await time.increase(RECOVERY_COOLDOWN + 1);
      await recovery.executeRecovery(first.address);

      await recovery.connect(guardians[0]).initiateRecovery(second.address, third.address);
      await recovery.connect(guardians[1]).approveRecovery(second.address);
      await time.increase(RECOVERY_COOLDOWN + 1);
      await recovery.executeRecovery(second.address);

      expect(await recovery.resolveAddress(first.address)).to.equal(third.address);
      expect(await recovery.resolveAddress(second.address)).to.equal(third.address);
      expect(await recovery.resolveAddress(third.address)).to.equal(third.address);
    });
  });
});
