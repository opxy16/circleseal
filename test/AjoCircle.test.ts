import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { AjoCircle, MockStable } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const USDC = (n: number) => BigInt(Math.round(n * 1_000_000)); // 6 decimals
const CONTRIBUTION = USDC(10);
const BOND = USDC(10);
const WEEK = 7 * 86_400;

enum Status {
  None,
  Open,
  Active,
  Completed,
  Cancelled,
}

async function deployFixture() {
  const [organizer, ada, bayo, chidi, stranger] = await ethers.getSigners();
  const token = (await (await ethers.getContractFactory("MockStable")).deploy()) as unknown as MockStable;
  const circle = (await (await ethers.getContractFactory("AjoCircle")).deploy()) as unknown as AjoCircle;
  const circleAddr = await circle.getAddress();
  for (const s of [organizer, ada, bayo, chidi, stranger]) {
    await token.mint(s.address, USDC(1_000));
    await token.connect(s).approve(circleAddr, ethers.MaxUint256);
  }
  return { token, circle, organizer, ada, bayo, chidi, stranger };
}

/** Open circle of 4 (organizer, ada, bayo, chidi), not started yet. */
async function openCircleFixture() {
  const base = await deployFixture();
  const { circle, token, organizer, ada, bayo, chidi } = base;
  await circle
    .connect(organizer)
    .createCircle(await token.getAddress(), CONTRIBUTION, BOND, WEEK, 4, ethers.id("Lagos freelancers circle"));
  const id = 1n;
  await circle.connect(ada).join(id);
  await circle.connect(bayo).join(id);
  await circle.connect(chidi).join(id);
  return { ...base, id };
}

async function activeCircleFixture() {
  const base = await openCircleFixture();
  await base.circle.connect(base.organizer).start(base.id);
  return base;
}

async function payAll(circle: AjoCircle, id: bigint, members: HardhatEthersSigner[]) {
  for (const m of members) await circle.connect(m).contribute(id);
}

/** Pay for everyone whose current round isn't already prepaid from their holdback. */
async function payDue(circle: AjoCircle, id: bigint, members: HardhatEthersSigner[]) {
  for (const m of members) {
    if ((await circle.getMember(id, m.address)).held < CONTRIBUTION) await circle.connect(m).contribute(id);
  }
}

async function nextRound() {
  await time.increase(WEEK);
}

describe("AjoCircle", () => {
  describe("setup", () => {
    it("creates a circle; the organizer joins first and posts the bond", async () => {
      const { circle, token, organizer } = await loadFixture(deployFixture);
      const before = await token.balanceOf(organizer.address);
      await expect(circle.connect(organizer).createCircle(await token.getAddress(), CONTRIBUTION, BOND, WEEK, 4, ethers.ZeroHash))
        .to.emit(circle, "MemberJoined")
        .withArgs(1n, organizer.address, 0);
      expect(before - (await token.balanceOf(organizer.address))).to.equal(BOND);
      const c = await circle.getCircle(1n);
      expect(c.status).to.equal(Status.Open);
      expect(c.memberCount).to.equal(1n);
    });

    it("rejects invalid parameters", async () => {
      const { circle, token, organizer } = await loadFixture(deployFixture);
      const t = await token.getAddress();
      await expect(circle.connect(organizer).createCircle(ethers.ZeroAddress, CONTRIBUTION, BOND, WEEK, 4, ethers.ZeroHash)).to.be.revertedWithCustomError(circle, "InvalidParams");
      await expect(circle.connect(organizer).createCircle(t, 0, BOND, WEEK, 4, ethers.ZeroHash)).to.be.revertedWithCustomError(circle, "InvalidParams");
      await expect(circle.connect(organizer).createCircle(t, CONTRIBUTION, BOND, 0, 4, ethers.ZeroHash)).to.be.revertedWithCustomError(circle, "InvalidParams");
      await expect(circle.connect(organizer).createCircle(t, CONTRIBUTION, BOND, WEEK, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(circle, "InvalidParams");
      await expect(circle.connect(organizer).createCircle(t, CONTRIBUTION, BOND, WEEK, 51, ethers.ZeroHash)).to.be.revertedWithCustomError(circle, "InvalidParams");
    });

    it("enforces capacity and single membership", async () => {
      const { circle, ada, stranger, id } = await loadFixture(openCircleFixture);
      await expect(circle.connect(ada).join(id)).to.be.revertedWithCustomError(circle, "AlreadyJoined");
      await expect(circle.connect(stranger).join(id)).to.be.revertedWithCustomError(circle, "CircleFull");
    });

    it("a member can leave before start, gets the bond back, and the order closes the gap", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(openCircleFixture);
      const before = await token.balanceOf(ada.address);
      await expect(circle.connect(ada).leave(id)).to.emit(circle, "MemberLeft").withArgs(id, ada.address);
      expect((await token.balanceOf(ada.address)) - before).to.equal(BOND);
      expect(await circle.getMembers(id)).to.deep.equal([organizer.address, bayo.address, chidi.address]);
      expect((await circle.getMember(id, bayo.address)).position).to.equal(1n);
      expect((await circle.getMember(id, chidi.address)).position).to.equal(2n);
      await expect(circle.connect(organizer).leave(id)).to.be.revertedWithCustomError(circle, "OrganizerCannotLeave");
    });

    it("only the organizer can start, and only with at least 2 members", async () => {
      const { circle, token, organizer, ada } = await loadFixture(deployFixture);
      await circle.connect(organizer).createCircle(await token.getAddress(), CONTRIBUTION, BOND, WEEK, 4, ethers.ZeroHash);
      await expect(circle.connect(organizer).start(1n)).to.be.revertedWithCustomError(circle, "NotEnoughMembers");
      await circle.connect(ada).join(1n);
      await expect(circle.connect(ada).start(1n)).to.be.revertedWithCustomError(circle, "NotOrganizer");
      await expect(circle.connect(organizer).start(1n)).to.emit(circle, "CircleStarted");
    });

    it("cancel before start lets everyone withdraw their bond", async () => {
      const { circle, token, organizer, ada, id } = await loadFixture(openCircleFixture);
      await expect(circle.connect(ada).cancel(id)).to.be.revertedWithCustomError(circle, "NotOrganizer");
      await circle.connect(organizer).cancel(id);
      const before = await token.balanceOf(ada.address);
      await circle.connect(ada).withdraw(id);
      expect((await token.balanceOf(ada.address)) - before).to.equal(BOND);
      await expect(circle.connect(ada).withdraw(id)).to.be.revertedWithCustomError(circle, "NothingToWithdraw");
    });
  });

  describe("rotation", () => {
    it("happy path: each member gets the pot once, early recipients' next rounds are prepaid, and everyone ends even", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      const members = [organizer, ada, bayo, chidi];
      const start = await Promise.all(members.map((m) => token.balanceOf(m.address)));

      // Round 0: organizer owes 3 more rounds (30), bond secures 10, so 20 is held back.
      // Round 1: ada owes 2 more (20), bond secures 10, so 10 is held back. Later rounds need none.
      const expected = [
        { paidOut: CONTRIBUTION * 2n, held: CONTRIBUTION * 2n },
        { paidOut: CONTRIBUTION * 3n, held: CONTRIBUTION },
        { paidOut: CONTRIBUTION * 4n, held: 0n },
        { paidOut: CONTRIBUTION * 4n, held: 0n },
      ];
      for (let round = 0; round < 4; round++) {
        await payDue(circle, id, members);
        await nextRound();
        const tx = circle.settleRound(id);
        await expect(tx).to.emit(circle, "RoundSettled").withArgs(id, round, members[round].address, expected[round].paidOut, 0);
        if (expected[round].held > 0n) {
          await expect(tx).to.emit(circle, "PayoutHeld").withArgs(id, round, members[round].address, expected[round].held);
        }
      }

      const c = await circle.getCircle(id);
      expect(c.status).to.equal(Status.Completed);
      expect(c.honestCount).to.equal(4n); // prepaid rounds are not misses

      for (const m of members) await circle.connect(m).withdraw(id);
      // Balances were read after bonds were posted: everyone ends exactly one bond above that (net zero).
      const end = await Promise.all(members.map((m) => token.balanceOf(m.address)));
      end.forEach((bal, i) => expect(bal).to.equal(start[i] + BOND));
      expect(await token.balanceOf(await circle.getAddress())).to.equal(0n);
    });

    it("an early recipient who stops paying can't cost anyone else a cent", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      const members = [organizer, ada, bayo, chidi];
      const start = await Promise.all(members.map((m) => token.balanceOf(m.address)));

      // Round 0: everyone pays, organizer takes the pot... then never pays again.
      await payAll(circle, id, members);
      await nextRound();
      await circle.settleRound(id);
      for (let round = 1; round < 4; round++) {
        await payDue(circle, id, [ada, bayo, chidi]);
        await nextRound();
        await circle.settleRound(id);
      }

      // Rounds 1-2 were prepaid from the organizer's holdback; round 3 came out of the organizer's bond.
      expect((await circle.getMember(id, organizer.address)).missed).to.equal(1n);
      for (let round = 1; round < 4; round++) {
        expect(await circle.collectedInRound(id, round)).to.equal(round === 3 ? CONTRIBUTION * 3n : CONTRIBUTION * 4n);
      }

      // Every honest member is made whole: their bond back, and they each received a full pot.
      for (const m of [ada, bayo, chidi]) await circle.connect(m).withdraw(id);
      for (const [i, m] of [organizer, ada, bayo, chidi].entries()) {
        if (i === 0) continue;
        expect(await token.balanceOf(m.address)).to.equal(start[i] + BOND);
      }
      // The organizer paid 1 round in cash, 2 from the holdback and 1 from the bond: nothing left.
      await expect(circle.connect(organizer).withdraw(id)).to.be.revertedWithCustomError(circle, "NothingToWithdraw");
      // Counting the bond they posted and lost, the organizer ends exactly even: walking away gained nothing.
      expect(await token.balanceOf(organizer.address)).to.equal(start[0] + BOND);
      expect(await token.balanceOf(await circle.getAddress())).to.equal(0n);
    });

    it("the 2-member case: the first recipient skips the last round and the other member still gets everything", async () => {
      const { circle, token, organizer, ada } = await loadFixture(deployFixture);
      await circle.connect(organizer).createCircle(await token.getAddress(), CONTRIBUTION, CONTRIBUTION, WEEK, 2, ethers.ZeroHash);
      await circle.connect(ada).join(1n);
      await circle.connect(organizer).start(1n);
      const adaStart = await token.balanceOf(ada.address);

      // Organizer skips round 0 (bond covers it) and still receives the pot, then skips round 1 too.
      await circle.connect(ada).contribute(1n);
      await nextRound();
      await circle.settleRound(1n);
      expect((await circle.getMember(1n, organizer.address)).held).to.equal(CONTRIBUTION);
      await circle.connect(ada).contribute(1n);
      await nextRound();
      await expect(circle.settleRound(1n)).to.emit(circle, "PaidFromHoldback").withArgs(1n, 1, organizer.address, CONTRIBUTION);

      expect((await circle.getMember(1n, ada.address)).received).to.equal(CONTRIBUTION * 2n);
      await circle.connect(ada).withdraw(1n);
      // Ada paid 2 rounds (20), received the full pot (20) and got her bond (10) back.
      expect((await token.balanceOf(ada.address)) - adaStart).to.equal(BOND);
    });

    it("a member can't pay a round that is already prepaid from their holdback", async () => {
      const { circle, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      await payAll(circle, id, [organizer, ada, bayo, chidi]);
      await nextRound();
      await circle.settleRound(id);
      await expect(circle.connect(organizer).contribute(id)).to.be.revertedWithCustomError(circle, "AlreadyPrepaid").withArgs(1);
    });

    it("a missed payment is covered from the defaulter's bond, so the pot is still full", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      await payAll(circle, id, [organizer, ada, bayo]); // chidi misses round 0
      await nextRound();
      const before = await token.balanceOf(organizer.address);
      await expect(circle.settleRound(id))
        .to.emit(circle, "MissCovered")
        .withArgs(id, 0, chidi.address, BOND, 0)
        .and.to.emit(circle, "RoundSettled")
        .withArgs(id, 0, organizer.address, CONTRIBUTION * 2n, 0);
      // Full pot of 40: 20 paid out now, 20 held back to prepay the organizer's next two rounds.
      expect((await token.balanceOf(organizer.address)) - before).to.equal(CONTRIBUTION * 2n);
      expect((await circle.getMember(id, organizer.address)).held).to.equal(CONTRIBUTION * 2n);
      const m = await circle.getMember(id, chidi.address);
      expect(m.bond).to.equal(0n);
      expect(m.missed).to.equal(1n);
    });

    it("when the bond runs out, the miss becomes debt deducted from the defaulter's own payout and shared with honest members", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      const all = [organizer, ada, bayo, chidi];
      // Rounds 0 and 1: chidi misses both. Round 0 is covered by the bond; round 1 becomes 10 debt.
      for (let round = 0; round < 2; round++) {
        await payDue(circle, id, [organizer, ada, bayo]);
        await nextRound();
        await circle.settleRound(id);
      }
      expect((await circle.getMember(id, chidi.address)).debt).to.equal(CONTRIBUTION);

      // Round 1 recipient (ada): the pot was only 30 because chidi's miss was not covered, and 10 of it
      // is held back to prepay her round 2.
      expect((await circle.getMember(id, ada.address)).received).to.equal(CONTRIBUTION * 2n);

      // Rounds 2 and 3: everyone pays what is due. Round 3 is chidi's turn: his 10 debt goes to the reserve.
      for (let round = 2; round < 4; round++) {
        await payDue(circle, id, all);
        await nextRound();
        await circle.settleRound(id);
      }
      const chidiState = await circle.getMember(id, chidi.address);
      expect(chidiState.debt).to.equal(0n);
      expect(chidiState.received).to.equal(CONTRIBUTION * 3n);

      const c = await circle.getCircle(id);
      expect(c.status).to.equal(Status.Completed);
      expect(c.reserve).to.equal(CONTRIBUTION);
      expect(c.honestCount).to.equal(3n);

      // Honest members get their bond back plus a third of the reserve; chidi has nothing left.
      const share = CONTRIBUTION / 3n;
      for (const m of [organizer, ada, bayo]) {
        const before = await token.balanceOf(m.address);
        await circle.connect(m).withdraw(id);
        expect((await token.balanceOf(m.address)) - before).to.equal(BOND + share);
      }
      await expect(circle.connect(chidi).withdraw(id)).to.be.revertedWithCustomError(circle, "NothingToWithdraw");
    });

    it("blocks double payment, payment by outsiders, early settlement, and late payment for a closed round", async () => {
      const { circle, ada, stranger, id } = await loadFixture(activeCircleFixture);
      await circle.connect(ada).contribute(id);
      await expect(circle.connect(ada).contribute(id)).to.be.revertedWithCustomError(circle, "AlreadyPaid").withArgs(0);
      await expect(circle.connect(stranger).contribute(id)).to.be.revertedWithCustomError(circle, "NotMember");
      await expect(circle.settleRound(id)).to.be.revertedWithCustomError(circle, "RoundNotOver").withArgs(0);

      // After all 4 rounds' time has passed, no further contributions are accepted.
      await time.increase(WEEK * 4);
      await expect(circle.connect(ada).contribute(id)).to.be.revertedWithCustomError(circle, "RoundNotActive");
    });

    it("rounds must be settled in order, and nothing happens before the circle starts", async () => {
      const { circle, ada, id } = await loadFixture(openCircleFixture);
      await expect(circle.connect(ada).contribute(id)).to.be.revertedWithCustomError(circle, "WrongStatus");
      await expect(circle.settleRound(id)).to.be.revertedWithCustomError(circle, "WrongStatus");
      await expect(circle.connect(ada).withdraw(id)).to.be.revertedWithCustomError(circle, "WrongStatus");
    });

    it("the contract only holds bonds, holdbacks and unsettled contributions", async () => {
      const { circle, token, organizer, ada, bayo, chidi, id } = await loadFixture(activeCircleFixture);
      const addr = await circle.getAddress();
      expect(await token.balanceOf(addr)).to.equal(BOND * 4n);
      await payAll(circle, id, [organizer, ada, bayo, chidi]);
      expect(await token.balanceOf(addr)).to.equal(BOND * 4n + CONTRIBUTION * 4n);
      await nextRound();
      await circle.settleRound(id);
      expect(await token.balanceOf(addr)).to.equal(BOND * 4n + CONTRIBUTION * 2n);
    });
  });
});
