import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { AjoForwarder, AjoPassbook } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const NGN = ethers.hexlify(ethers.toUtf8Bytes("NGN")); // bytes3
const DAILY = 86_400;
const AMOUNT = 200_000n; // ₦2,000 in kobo

const contributionTypes = {
  Contribution: [
    { name: "groupId", type: "uint256" },
    { name: "member", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "period", type: "uint32" },
    { name: "ref", type: "bytes32" },
    { name: "paidAt", type: "uint64" },
  ],
};

const payoutTypes = {
  Payout: [
    { name: "groupId", type: "uint256" },
    { name: "member", type: "address" },
    { name: "amount", type: "uint128" },
    { name: "cycle", type: "uint32" },
    { name: "ref", type: "bytes32" },
    { name: "paidAt", type: "uint64" },
  ],
};

const forwardRequestTypes = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
};

async function deployFixture() {
  const [relayer, collector, ada, bayo, stranger] = await ethers.getSigners();
  const forwarder = (await (await ethers.getContractFactory("AjoForwarder")).deploy()) as unknown as AjoForwarder;
  const passbook = (await (await ethers.getContractFactory("AjoPassbook")).deploy(
    await forwarder.getAddress(),
  )) as unknown as AjoPassbook;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = {
    name: "AjoProof",
    version: "1",
    chainId,
    verifyingContract: await passbook.getAddress(),
  };
  return { passbook, forwarder, relayer, collector, ada, bayo, stranger, domain, chainId };
}

async function groupWithMembersFixture() {
  const base = await deployFixture();
  const { passbook, collector, ada, bayo } = base;
  const metaHash = ethers.keccak256(ethers.toUtf8Bytes("Yaba market daily ajo"));
  await passbook.connect(collector).createGroup(metaHash, NGN, AMOUNT, DAILY);
  const groupId = 1n;
  await passbook.connect(collector).inviteMember(groupId, ada.address, ethers.id("ADA-01"));
  await passbook.connect(collector).inviteMember(groupId, bayo.address, ethers.id("BAYO-02"));
  await passbook.connect(ada).acceptInvite(groupId);
  await passbook.connect(bayo).acceptInvite(groupId);
  return { ...base, groupId, metaHash };
}

async function contribution(
  groupId: bigint,
  member: HardhatEthersSigner,
  period: number,
  overrides: Partial<{ amount: bigint; ref: string; paidAt: bigint }> = {},
) {
  return {
    groupId,
    member: member.address,
    amount: overrides.amount ?? AMOUNT,
    period,
    ref: overrides.ref ?? ethers.hexlify(ethers.randomBytes(32)),
    paidAt: overrides.paidAt ?? BigInt(await time.latest()),
  };
}

describe("AjoPassbook", () => {
  describe("groups and members", () => {
    it("creates a group owned by the caller", async () => {
      const { passbook, collector } = await loadFixture(deployFixture);
      await expect(passbook.connect(collector).createGroup(ethers.ZeroHash, NGN, AMOUNT, DAILY))
        .to.emit(passbook, "GroupCreated")
        .withArgs(1n, collector.address, ethers.ZeroHash, NGN, AMOUNT, DAILY);
      const g = await passbook.getGroup(1n);
      expect(g.collector).to.equal(collector.address);
      expect(g.contributionAmount).to.equal(AMOUNT);
      expect(await passbook.groupCount()).to.equal(1n);
    });

    it("rejects a zero amount or zero period", async () => {
      const { passbook, collector } = await loadFixture(deployFixture);
      await expect(passbook.connect(collector).createGroup(ethers.ZeroHash, NGN, 0, DAILY)).to.be.revertedWithCustomError(
        passbook,
        "InvalidAmount",
      );
      await expect(passbook.connect(collector).createGroup(ethers.ZeroHash, NGN, AMOUNT, 0)).to.be.revertedWithCustomError(
        passbook,
        "InvalidPeriod",
      );
    });

    it("only the collector can invite, and members must accept to become active", async () => {
      const { passbook, collector, ada, stranger } = await loadFixture(deployFixture);
      await passbook.connect(collector).createGroup(ethers.ZeroHash, NGN, AMOUNT, DAILY);
      await expect(passbook.connect(stranger).inviteMember(1n, ada.address, ethers.id("X")))
        .to.be.revertedWithCustomError(passbook, "NotCollector")
        .withArgs(1n, stranger.address);

      await passbook.connect(collector).inviteMember(1n, ada.address, ethers.id("ADA-01"));
      expect((await passbook.getMember(1n, ada.address)).status).to.equal(1n); // Invited
      expect(await passbook.activeMemberCount(1n)).to.equal(0n);

      await expect(passbook.connect(ada).acceptInvite(1n)).to.emit(passbook, "MemberJoined").withArgs(1n, ada.address);
      expect((await passbook.getMember(1n, ada.address)).status).to.equal(2n); // Active
      expect(await passbook.activeMemberCount(1n)).to.equal(1n);
      expect((await passbook.thriftRecord(ada.address)).groupsJoined).to.equal(1n);
    });

    it("cannot invite the collector or someone already in the group", async () => {
      const { passbook, collector, ada, groupId } = await loadFixture(groupWithMembersFixture);
      await expect(passbook.connect(collector).inviteMember(groupId, collector.address, ethers.ZeroHash)).to.be.revertedWithCustomError(
        passbook,
        "CollectorCannotBeMember",
      );
      await expect(passbook.connect(collector).inviteMember(groupId, ada.address, ethers.ZeroHash)).to.be.revertedWithCustomError(
        passbook,
        "AlreadyMember",
      );
    });

    it("an uninvited wallet cannot join", async () => {
      const { passbook, stranger, groupId } = await loadFixture(groupWithMembersFixture);
      await expect(passbook.connect(stranger).acceptInvite(groupId)).to.be.revertedWithCustomError(passbook, "NotInvited");
    });

    it("members can leave and collectors can remove members", async () => {
      const { passbook, collector, ada, bayo, groupId } = await loadFixture(groupWithMembersFixture);
      await expect(passbook.connect(ada).leaveGroup(groupId)).to.emit(passbook, "MemberLeft").withArgs(groupId, ada.address, false);
      await expect(passbook.connect(collector).removeMember(groupId, bayo.address))
        .to.emit(passbook, "MemberLeft")
        .withArgs(groupId, bayo.address, true);
      expect(await passbook.activeMemberCount(groupId)).to.equal(0n);
    });
  });

  describe("co-signed contribution receipts", () => {
    it("records a receipt signed by both collector and member, submitted by a relayer", async () => {
      const { passbook, relayer, collector, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);
      const c = await contribution(groupId, ada, 1);
      const collectorSig = await collector.signTypedData(domain, contributionTypes, c);
      const memberSig = await ada.signTypedData(domain, contributionTypes, c);
      const digest = await passbook.contributionDigest(c);

      await expect(passbook.connect(relayer).recordContribution(c, collectorSig, memberSig))
        .to.emit(passbook, "ContributionRecorded")
        .withArgs(groupId, ada.address, 1, AMOUNT, c.ref, c.paidAt, digest);

      const m = await passbook.getMember(groupId, ada.address);
      expect(m.contributions).to.equal(1n);
      expect(m.totalContributed).to.equal(AMOUNT);
      expect(m.lastPeriod).to.equal(1n);
      expect(await passbook.isRecorded(digest)).to.equal(true);
      expect((await passbook.thriftRecord(ada.address)).contributions).to.equal(1n);
    });

    it("rejects a receipt the collector did not sign", async () => {
      const { passbook, ada, bayo, groupId, domain } = await loadFixture(groupWithMembersFixture);
      const c = await contribution(groupId, ada, 1);
      const fakeCollectorSig = await bayo.signTypedData(domain, contributionTypes, c);
      const memberSig = await ada.signTypedData(domain, contributionTypes, c);
      await expect(passbook.recordContribution(c, fakeCollectorSig, memberSig)).to.be.revertedWithCustomError(
        passbook,
        "BadCollectorSignature",
      );
    });

    it("rejects a receipt the member did not sign (collector can't fake a payment)", async () => {
      const { passbook, collector, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);
      const c = await contribution(groupId, ada, 1);
      const collectorSig = await collector.signTypedData(domain, contributionTypes, c);
      await expect(passbook.recordContribution(c, collectorSig, collectorSig)).to.be.revertedWithCustomError(
        passbook,
        "BadMemberSignature",
      );
    });

    it("rejects a receipt whose amount was changed after signing", async () => {
      const { passbook, collector, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);
      const c = await contribution(groupId, ada, 1);
      const collectorSig = await collector.signTypedData(domain, contributionTypes, c);
      const memberSig = await ada.signTypedData(domain, contributionTypes, c);
      const tampered = { ...c, amount: c.amount * 10n };
      await expect(passbook.recordContribution(tampered, collectorSig, memberSig)).to.be.revertedWithCustomError(
        passbook,
        "BadCollectorSignature",
      );
    });

    it("rejects the same receipt twice, and the same payment reference twice", async () => {
      const { passbook, collector, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);
      const c = await contribution(groupId, ada, 1);
      const cs = await collector.signTypedData(domain, contributionTypes, c);
      const ms = await ada.signTypedData(domain, contributionTypes, c);
      await passbook.recordContribution(c, cs, ms);
      await expect(passbook.recordContribution(c, cs, ms)).to.be.revertedWithCustomError(passbook, "AlreadyRecorded");

      const sameRef = { ...c, period: 2 };
      const cs2 = await collector.signTypedData(domain, contributionTypes, sameRef);
      const ms2 = await ada.signTypedData(domain, contributionTypes, sameRef);
      await expect(passbook.recordContribution(sameRef, cs2, ms2)).to.be.revertedWithCustomError(passbook, "RefAlreadyUsed");
    });

    it("rejects receipts for non-members, future dates and closed groups", async () => {
      const { passbook, collector, stranger, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);

      const notMember = await contribution(groupId, stranger, 1);
      await expect(
        passbook.recordContribution(
          notMember,
          await collector.signTypedData(domain, contributionTypes, notMember),
          await stranger.signTypedData(domain, contributionTypes, notMember),
        ),
      ).to.be.revertedWithCustomError(passbook, "NotActiveMember");

      const future = await contribution(groupId, ada, 1, { paidAt: BigInt(await time.latest()) + 3_600n });
      await expect(
        passbook.recordContribution(
          future,
          await collector.signTypedData(domain, contributionTypes, future),
          await ada.signTypedData(domain, contributionTypes, future),
        ),
      ).to.be.revertedWithCustomError(passbook, "ReceiptInFuture");

      await passbook.connect(collector).closeGroup(groupId);
      const afterClose = await contribution(groupId, ada, 2);
      await expect(
        passbook.recordContribution(
          afterClose,
          await collector.signTypedData(domain, contributionTypes, afterClose),
          await ada.signTypedData(domain, contributionTypes, afterClose),
        ),
      ).to.be.revertedWithCustomError(passbook, "GroupIsClosed");
    });

    it("a signature for one deployment can't be replayed on another", async () => {
      const { passbook, collector, ada, groupId, domain, forwarder } = await loadFixture(groupWithMembersFixture);
      const other = (await (await ethers.getContractFactory("AjoPassbook")).deploy(await forwarder.getAddress())) as unknown as AjoPassbook;
      await other.connect(collector).createGroup(ethers.ZeroHash, NGN, AMOUNT, DAILY);
      await other.connect(collector).inviteMember(1n, ada.address, ethers.ZeroHash);
      await other.connect(ada).acceptInvite(1n);

      const c = await contribution(groupId, ada, 1);
      const cs = await collector.signTypedData(domain, contributionTypes, c); // signed for `passbook`
      const ms = await ada.signTypedData(domain, contributionTypes, c);
      await expect(other.recordContribution(c, cs, ms)).to.be.revertedWithCustomError(other, "BadCollectorSignature");
      await expect(passbook.recordContribution(c, cs, ms)).to.emit(passbook, "ContributionRecorded");
    });
  });

  describe("co-signed payout receipts", () => {
    it("records a payout, even after the member has left", async () => {
      const { passbook, collector, ada, groupId, domain } = await loadFixture(groupWithMembersFixture);
      await passbook.connect(ada).leaveGroup(groupId);
      const p = {
        groupId,
        member: ada.address,
        amount: AMOUNT * 30n,
        cycle: 1,
        ref: ethers.hexlify(ethers.randomBytes(32)),
        paidAt: BigInt(await time.latest()),
      };
      const digest = await passbook.payoutDigest(p);
      await expect(
        passbook.recordPayout(
          p,
          await collector.signTypedData(domain, payoutTypes, p),
          await ada.signTypedData(domain, payoutTypes, p),
        ),
      )
        .to.emit(passbook, "PayoutRecorded")
        .withArgs(groupId, ada.address, 1, AMOUNT * 30n, p.ref, p.paidAt, digest);
      const m = await passbook.getMember(groupId, ada.address);
      expect(m.payouts).to.equal(1n);
      expect(m.totalReceived).to.equal(AMOUNT * 30n);
    });
  });

  describe("gasless actions through the forwarder", () => {
    it("a member accepts an invite without holding any gas; the relayer pays", async () => {
      const { passbook, forwarder, relayer, collector, stranger, chainId } = await loadFixture(deployFixture);
      await passbook.connect(collector).createGroup(ethers.ZeroHash, NGN, AMOUNT, DAILY);
      await passbook.connect(collector).inviteMember(1n, stranger.address, ethers.id("NEW-03"));

      // Brand-new member wallet with zero balance.
      const member = ethers.Wallet.createRandom().connect(ethers.provider);
      await passbook.connect(collector).inviteMember(1n, member.address, ethers.id("NEW-04"));
      expect(await ethers.provider.getBalance(member.address)).to.equal(0n);

      const data = passbook.interface.encodeFunctionData("acceptInvite", [1n]);
      const request = {
        from: member.address,
        to: await passbook.getAddress(),
        value: 0n,
        gas: 200_000n,
        nonce: await forwarder.nonces(member.address),
        deadline: (await time.latest()) + 3_600,
        data,
      };
      const signature = await member.signTypedData(
        { name: "AjoForwarder", version: "1", chainId, verifyingContract: await forwarder.getAddress() },
        forwardRequestTypes,
        request,
      );

      await expect(forwarder.connect(relayer).execute({ ...request, signature }))
        .to.emit(passbook, "MemberJoined")
        .withArgs(1n, member.address);
      expect((await passbook.getMember(1n, member.address)).status).to.equal(2n);
    });
  });
});
