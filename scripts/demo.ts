/**
 * CircleSeal walkthrough on a local, throwaway blockchain (Hardhat in-memory network).
 * Run with:  npx hardhat run scripts/demo.ts
 * Nothing here touches QIE or any real money.
 */
import { ethers, network } from "hardhat";
import type { AjoCircle, AjoForwarder, AjoPassbook, MockStable } from "../typechain-types";

const line = () => console.log("-".repeat(72));
const title = (t: string) => {
  console.log("");
  line();
  console.log("  " + t);
  line();
};
const ok = (t: string) => console.log("  [OK]      " + t);
const blocked = (t: string) => console.log("  [BLOCKED] " + t);
const info = (t: string) => console.log("            " + t);
const naira = (kobo: bigint) => "NGN " + (Number(kobo) / 100).toLocaleString("en-NG");
const usd = (units: bigint) => (Number(units) / 1e6).toFixed(2) + " QUSDC";
const short = (a: string) => a.slice(0, 6) + "..." + a.slice(-4);

async function expectRevert(promise: Promise<unknown>, contract: { interface: any }): Promise<string> {
  try {
    await promise;
    return "NOT REVERTED (unexpected)";
  } catch (e: any) {
    const data = e?.data ?? e?.error?.data ?? e?.info?.error?.data;
    try {
      const parsed = contract.interface.parseError(data);
      return parsed?.name ?? "reverted";
    } catch {
      return e?.shortMessage ?? "reverted";
    }
  }
}

async function main() {
  const [relayer, ngozi, ada, bayo, chidi, emeka] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("");
  console.log("  CircleSeal demo  |  network: " + network.name + " (local, throwaway)  |  chain " + chainId);
  console.log("  Cast: Mama Ngozi (collector), Ada, Bayo, Chidi, Emeka (members), Relayer (pays gas)");

  // ---------------------------------------------------------------------
  // Deploy
  // ---------------------------------------------------------------------
  const forwarder = (await (await ethers.getContractFactory("AjoForwarder")).deploy()) as unknown as AjoForwarder;
  const passbook = (await (await ethers.getContractFactory("AjoPassbook")).deploy(
    await forwarder.getAddress(),
  )) as unknown as AjoPassbook;
  const circle = (await (await ethers.getContractFactory("AjoCircle")).deploy()) as unknown as AjoCircle;
  const qusdc = (await (await ethers.getContractFactory("MockStable")).deploy()) as unknown as MockStable;

  title("PART 1  -  PASSBOOK MODE  (members pay cash; nobody needs crypto)");
  ok("Contracts deployed: AjoPassbook " + short(await passbook.getAddress()) + ", AjoForwarder " + short(await forwarder.getAddress()));

  const domain = { name: "CircleSeal", version: "1", chainId, verifyingContract: await passbook.getAddress() };
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

  const DAILY = 200_000n; // NGN 2,000 in kobo
  await passbook
    .connect(ngozi)
    .createGroup(ethers.id("Yaba Market Daily Ajo"), ethers.hexlify(ethers.toUtf8Bytes("NGN")), DAILY, 86_400);
  const groupId = 1n;
  ok("Mama Ngozi created 'Yaba Market Daily Ajo': " + naira(DAILY) + " per day");
  info("(only a hash of the group name goes on-chain, never names or phone numbers)");

  await passbook.connect(ngozi).inviteMember(groupId, bayo.address, ethers.id("BAYO-02"));
  await passbook.connect(bayo).acceptInvite(groupId);
  ok("Bayo was invited and accepted (member code BAYO-02)");

  // Ada joins with a brand-new wallet that has ZERO balance: the relayer pays her gas.
  const adaWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await passbook.connect(ngozi).inviteMember(groupId, adaWallet.address, ethers.id("ADA-01"));
  const fwdTypes = {
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
  const latest = (await ethers.provider.getBlock("latest"))!.timestamp;
  const req = {
    from: adaWallet.address,
    to: await passbook.getAddress(),
    value: 0n,
    gas: 200_000n,
    nonce: await forwarder.nonces(adaWallet.address),
    deadline: latest + 3_600,
    data: passbook.interface.encodeFunctionData("acceptInvite", [groupId]),
  };
  const signature = await adaWallet.signTypedData(
    { name: "AjoForwarder", version: "1", chainId, verifyingContract: await forwarder.getAddress() },
    fwdTypes,
    req,
  );
  const adaBalance = await ethers.provider.getBalance(adaWallet.address);
  await (await forwarder.connect(relayer).execute({ ...req, signature })).wait();
  ok("Ada joined with a brand-new wallet holding " + ethers.formatEther(adaBalance) + " QIE: the relayer paid her gas");

  // Three days of contributions, each co-signed by Ngozi and the member, submitted by the relayer.
  const nowTs = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const members = [
    { who: "Ada", signer: adaWallet as unknown as typeof ada },
    { who: "Bayo", signer: bayo },
  ];
  let receipts = 0;
  for (let day = 1; day <= 3; day++) {
    for (const m of members) {
      const c = {
        groupId,
        member: m.signer.address,
        amount: DAILY,
        period: day,
        ref: ethers.hexlify(ethers.randomBytes(32)),
        paidAt: nowTs,
      };
      const cs = await ngozi.signTypedData(domain, contributionTypes, c);
      const ms = await m.signer.signTypedData(domain, contributionTypes, c);
      const tx = await passbook.connect(relayer).recordContribution(c, cs, ms);
      const rc = await tx.wait();
      receipts++;
      ok(`Day ${day}: ${m.who} paid ${naira(DAILY)} cash  ->  receipt co-signed & recorded (tx ${short(rc!.hash)})`);
    }
  }

  console.log("");
  console.log("  Now let's try to cheat:");
  {
    // 1) Collector claims Ada paid, without Ada's signature.
    const c = { groupId, member: adaWallet.address, amount: DAILY, period: 4, ref: ethers.id("fake-1"), paidAt: nowTs };
    const cs = await ngozi.signTypedData(domain, contributionTypes, c);
    const reason = await expectRevert(passbook.recordContribution(c, cs, cs), passbook);
    blocked("Collector tries to record a payment Ada never confirmed  ->  " + reason);
  }
  {
    // 2) Amount changed after both signed.
    const c = { groupId, member: bayo.address, amount: DAILY, period: 4, ref: ethers.id("tamper-1"), paidAt: nowTs };
    const cs = await ngozi.signTypedData(domain, contributionTypes, c);
    const ms = await bayo.signTypedData(domain, contributionTypes, c);
    const reason = await expectRevert(passbook.recordContribution({ ...c, amount: DAILY * 10n }, cs, ms), passbook);
    blocked("Someone changes NGN 2,000 to NGN 20,000 after signing  ->  " + reason);
  }
  {
    // 3) Record the same payment twice.
    const c = { groupId, member: bayo.address, amount: DAILY, period: 5, ref: ethers.id("dup-1"), paidAt: nowTs };
    const cs = await ngozi.signTypedData(domain, contributionTypes, c);
    const ms = await bayo.signTypedData(domain, contributionTypes, c);
    await (await passbook.connect(relayer).recordContribution(c, cs, ms)).wait();
    receipts++;
    const reason = await expectRevert(passbook.connect(relayer).recordContribution(c, cs, ms), passbook);
    blocked("Same payment submitted twice  ->  " + reason);
  }
  {
    // 4) An outsider tries to slip in.
    const c = { groupId, member: emeka.address, amount: DAILY, period: 1, ref: ethers.id("outsider"), paidAt: nowTs };
    const cs = await ngozi.signTypedData(domain, contributionTypes, c);
    const ms = await emeka.signTypedData(domain, contributionTypes, c);
    const reason = await expectRevert(passbook.recordContribution(c, cs, ms), passbook);
    blocked("Emeka (not a member) tries to get a receipt  ->  " + reason);
  }

  // Payout: Ngozi hands Ada her turn's money; both confirm.
  const p = {
    groupId,
    member: adaWallet.address,
    amount: DAILY * 30n,
    cycle: 1,
    ref: ethers.hexlify(ethers.randomBytes(32)),
    paidAt: nowTs,
  };
  await (
    await passbook
      .connect(relayer)
      .recordPayout(p, await ngozi.signTypedData(domain, payoutTypes, p), await adaWallet.signTypedData(domain, payoutTypes, p))
  ).wait();
  ok("Payout: Ngozi gave Ada " + naira(p.amount) + " for her turn  ->  both confirmed, recorded");

  console.log("");
  console.log("  Ada's passbook (read straight from the chain):");
  const adaM = await passbook.getMember(groupId, adaWallet.address);
  const adaR = await passbook.thriftRecord(adaWallet.address);
  info("contributions: " + adaM.contributions + "   total paid: " + naira(adaM.totalContributed));
  info("payouts: " + adaM.payouts + "   total received: " + naira(adaM.totalReceived));
  info("lifetime thrift record  ->  groups joined: " + adaR.groupsJoined + ", contributions: " + adaR.contributions + ", payouts: " + adaR.payouts);
  info("Ada's own QIE spent on all of this: " + ethers.formatEther(adaBalance - (await ethers.provider.getBalance(adaWallet.address))));

  // ---------------------------------------------------------------------
  // Circle mode
  // ---------------------------------------------------------------------
  title("PART 2  -  CIRCLE MODE  (crypto users; rotation enforced in QUSDC)");
  const WEEK = 7 * 86_400;
  const CONTRIB = 10_000_000n; // 10 QUSDC
  const BOND = 10_000_000n;
  const cast = [
    { who: "Ngozi", s: ngozi },
    { who: "Ada  ", s: ada },
    { who: "Bayo ", s: bayo },
    { who: "Chidi", s: chidi },
  ];
  for (const m of cast) {
    await qusdc.mint(m.s.address, 100_000_000n);
    await qusdc.connect(m.s).approve(await circle.getAddress(), ethers.MaxUint256);
  }
  const startBal = await Promise.all(cast.map((m) => qusdc.balanceOf(m.s.address)));
  info("Everyone starts with " + usd(startBal[0]) + " (test token standing in for QUSDC)");

  await circle.connect(ngozi).createCircle(await qusdc.getAddress(), CONTRIB, BOND, WEEK, 4, ethers.id("Freelancers circle"));
  const cid = 1n;
  for (const m of cast.slice(1)) await circle.connect(m.s).join(cid);
  await circle.connect(ngozi).start(cid);
  ok("Circle started: 4 members, " + usd(CONTRIB) + " per week, bond " + usd(BOND) + " each");
  info("Turn order: Ngozi -> Ada -> Bayo -> Chidi");
  info("Plot twist: Ngozi takes the first pot and then stops paying. Chidi also skips week 2.");
  const nameOf = (a: string) => cast.find((m) => m.s.address.toLowerCase() === a.toLowerCase())?.who.trim() ?? a;

  for (let round = 0; round < 4; round++) {
    console.log("");
    console.log(`  Week ${round + 1}  (recipient: ${cast[round].who.trim()})`);
    for (const m of cast) {
      const name = m.who.trim();
      if (round > 0 && name === "Ngozi") continue; // walked away after getting paid
      if (round === 1 && name === "Chidi") {
        info("Chidi doesn't pay this week...");
        continue;
      }
      // Rounds already prepaid from a member's payout holdback need no payment.
      if ((await circle.getMember(cid, m.s.address)).held >= CONTRIB) continue;
      await circle.connect(m.s).contribute(cid);
    }
    await ethers.provider.send("evm_increaseTime", [WEEK]);
    await ethers.provider.send("evm_mine", []);
    const tx = await circle.connect(relayer).settleRound(cid);
    const rc = await tx.wait();
    const after: string[] = [];
    for (const log of rc!.logs) {
      try {
        const ev = circle.interface.parseLog(log);
        if (ev?.name === "MissCovered") ok(`${nameOf(ev.args.member)} skipped: ${usd(ev.args.fromBond)} taken from THEIR OWN bond`);
        if (ev?.name === "PaidFromHoldback") ok(`${nameOf(ev.args.member)}'s share paid from the payout the contract held back`);
        if (ev?.name === "RoundSettled") ok(`${cast[round].who.trim()} receives the pot: ${usd(ev.args.paidOut)}`);
        if (ev?.name === "PayoutHeld") after.push(`${usd(ev.args.held)} more is held back to prepay ${nameOf(ev.args.recipient)}'s remaining weeks`);
      } catch {
        /* not ours */
      }
    }
    after.forEach((m) => info(m));
  }

  console.log("");
  const cheat = await expectRevert(circle.connect(ada).contribute(cid), circle);
  blocked("Anyone trying to pay or pull money after the circle ended  ->  " + cheat);

  for (const m of cast) {
    try {
      await (await circle.connect(m.s).withdraw(cid)).wait();
    } catch {
      /* nothing left */
    }
  }
  console.log("");
  console.log("  Final result (net change per person):");
  const endBal = await Promise.all(cast.map((m) => qusdc.balanceOf(m.s.address)));
  cast.forEach((m, i) => {
    const diff = endBal[i] - startBal[i];
    info(`${m.who}  ${diff >= 0n ? "+" : ""}${usd(diff)}`);
  });
  info("Contract left holding: " + usd(await qusdc.balanceOf(await circle.getAddress())) + " (tiny rounding dust at most)");
  info("Ngozi walked away after being paid, and Chidi skipped a week, but every honest member");
  info("ended even: the skipped payments came out of the skippers' own holdback and bonds.");

  console.log("");
  line();
  console.log("  Demo finished. Receipts recorded: " + receipts + ". All of this ran on a local test chain.");
  line();
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
