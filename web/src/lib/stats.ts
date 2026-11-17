"use client";

import { decodeEventLog, getAbiItem, type Abi, type Address, type Hex, type Log } from "viem";
import { AjoCircleAbi } from "./abi/AjoCircle";
import { AjoPassbookAbi } from "./abi/AjoPassbook";
import { getLogsChunked, publicClient } from "./chain";
import { addresses } from "./config";

/**
 * Public, wallet-free statistics read straight from CircleSeal's contract events.
 * Nothing here comes from a database: anyone can recompute every number from the chain.
 */

export type Activity = {
  kind: "group" | "join" | "receipt" | "payout" | "circle" | "circleJoin" | "contribution" | "settled" | "held" | "miss" | "prepaid";
  text: string;
  amount?: { value: bigint; unit: "ngn" | "token" };
  who?: Address;
  tx: Hex;
  block: bigint;
  index: number;
  time?: number;
};

export type Stats = {
  passbook: { groups: number; members: number; receipts: number; payouts: number; recorded: bigint; paidOut: bigint };
  circle: { circles: number; members: number; contributions: number; contributed: bigint; paidOut: bigint; covered: number };
  wallets: number;
  transactions: number;
  /** Network fees CircleSeal's relayer paid so passbook members never needed crypto. */
  sponsored: { transactions: number; fees: bigint; complete: boolean };
  recent: Activity[];
};

type Decoded = { args: Record<string, unknown>; log: Log };

async function events(abi: Abi, address: Address, name: string): Promise<Decoded[]> {
  if (!address) return [];
  const logs = await getLogsChunked({ address, event: getAbiItem({ abi, name } as never) as never });
  return logs.map((log) => ({ args: decodeEventLog({ abi, data: log.data, topics: log.topics }).args as unknown as Record<string, unknown>, log }));
}

export async function loadStats(): Promise<Stats> {
  const P = AjoPassbookAbi as Abi;
  const C = AjoCircleAbi as Abi;
  const [groups, pJoins, receipts, payouts, circles, cJoins, contribs, settled, held, misses, prepaid] = await Promise.all([
    events(P, addresses.passbook, "GroupCreated"),
    events(P, addresses.passbook, "MemberJoined"),
    events(P, addresses.passbook, "ContributionRecorded"),
    events(P, addresses.passbook, "PayoutRecorded"),
    events(C, addresses.circle, "CircleCreated"),
    events(C, addresses.circle, "MemberJoined"),
    events(C, addresses.circle, "Contributed"),
    events(C, addresses.circle, "RoundSettled"),
    events(C, addresses.circle, "PayoutHeld"),
    events(C, addresses.circle, "MissCovered"),
    events(C, addresses.circle, "PaidFromHoldback"),
  ]);

  const big = (v: unknown) => BigInt(v as bigint);
  const addr = (v: unknown) => (v as string).toLowerCase();
  const sum = (list: Decoded[], key: string) => list.reduce((s, e) => s + big(e.args[key]), 0n);

  const pbWallets = new Set([...groups.map((e) => addr(e.args.collector)), ...pJoins.map((e) => addr(e.args.member))]);
  const circleWallets = new Set(cJoins.map((e) => addr(e.args.member)));
  const allWallets = new Set([...pbWallets, ...circleWallets]);
  const txs = new Set(
    [groups, pJoins, receipts, payouts, circles, cJoins, contribs, settled, held, misses, prepaid].flat().map((e) => e.log.transactionHash),
  );

  const act = (e: Decoded, a: Omit<Activity, "tx" | "block" | "index">): Activity => ({
    ...a,
    tx: e.log.transactionHash as Hex,
    block: e.log.blockNumber ?? 0n,
    index: e.log.logIndex ?? 0,
  });
  const all: Activity[] = [
    ...groups.map((e) => act(e, { kind: "group", text: `Savings group #${e.args.groupId} created`, who: e.args.collector as Address })),
    ...pJoins.map((e) => act(e, { kind: "join", text: `Member joined group #${e.args.groupId}`, who: e.args.member as Address })),
    ...receipts.map((e) =>
      act(e, { kind: "receipt", text: `Receipt co-signed in group #${e.args.groupId}`, amount: { value: big(e.args.amount), unit: "ngn" }, who: e.args.member as Address }),
    ),
    ...payouts.map((e) =>
      act(e, { kind: "payout", text: `Payout confirmed in group #${e.args.groupId}`, amount: { value: big(e.args.amount), unit: "ngn" }, who: e.args.member as Address }),
    ),
    ...circles.map((e) => act(e, { kind: "circle", text: `Savings circle #${e.args.circleId} created`, who: e.args.organizer as Address })),
    ...cJoins.map((e) => act(e, { kind: "circleJoin", text: `Member joined circle #${e.args.circleId}`, who: e.args.member as Address })),
    ...contribs.map((e) =>
      act(e, {
        kind: "contribution",
        text: `Paid round ${Number(e.args.round) + 1} of circle #${e.args.circleId}`,
        amount: { value: big(e.args.amount), unit: "token" },
        who: e.args.member as Address,
      }),
    ),
    ...settled.map((e) =>
      act(e, {
        kind: "settled",
        text: `Circle #${e.args.circleId} round ${Number(e.args.round) + 1} paid out`,
        amount: { value: big(e.args.paidOut), unit: "token" },
        who: e.args.recipient as Address,
      }),
    ),
    ...held.map((e) =>
      act(e, { kind: "held", text: `Kept back to prepay remaining rounds`, amount: { value: big(e.args.held), unit: "token" }, who: e.args.recipient as Address }),
    ),
    ...misses.map((e) =>
      act(e, { kind: "miss", text: `Missed payment covered from the member's own funds`, amount: { value: big(e.args.fromBond), unit: "token" }, who: e.args.member as Address }),
    ),
    ...prepaid.map((e) =>
      act(e, { kind: "prepaid", text: `Round prepaid from holdback`, amount: { value: big(e.args.amount), unit: "token" }, who: e.args.member as Address }),
    ),
  ];
  const recent = all.sort((a, b) => (a.block !== b.block ? (a.block > b.block ? -1 : 1) : b.index - a.index)).slice(0, 12);

  // Timestamps for the recent items only (one request per distinct block).
  const blocks = [...new Set(recent.map((r) => r.block))];
  const times = new Map<bigint, number>();
  await Promise.all(
    blocks.map(async (n) => {
      try {
        times.set(n, Number((await publicClient.getBlock({ blockNumber: n })).timestamp));
      } catch {
        /* time is optional */
      }
    }),
  );
  recent.forEach((r) => (r.time = times.get(r.block)));

  return {
    passbook: {
      groups: groups.length,
      members: new Set(pJoins.map((e) => addr(e.args.member))).size,
      receipts: receipts.length,
      payouts: payouts.length,
      recorded: sum(receipts, "amount"),
      paidOut: sum(payouts, "amount"),
    },
    circle: {
      circles: circles.length,
      members: circleWallets.size,
      contributions: contribs.length + prepaid.length,
      contributed: sum(contribs, "amount") + sum(prepaid, "amount"),
      paidOut: sum(settled, "paidOut"),
      covered: misses.length,
    },
    wallets: allWallets.size,
    transactions: txs.size,
    sponsored: await sponsoredFees([groups, pJoins, receipts, payouts].flat().map((e) => e.log.transactionHash as Hex)),
    recent,
  };
}

/** Sum gas fees of the relayer-sent passbook transactions (capped so the page stays fast). */
const MAX_FEE_RECEIPTS = 300;
async function sponsoredFees(hashes: Hex[]): Promise<Stats["sponsored"]> {
  const unique = [...new Set(hashes)];
  const sample = unique.slice(-MAX_FEE_RECEIPTS);
  let fees = 0n;
  for (let i = 0; i < sample.length; i += 20) {
    const receipts = await Promise.all(
      sample.slice(i, i + 20).map((hash) => publicClient.getTransactionReceipt({ hash }).catch(() => null)),
    );
    for (const r of receipts) if (r) fees += r.gasUsed * (r.effectiveGasPrice ?? 0n);
  }
  return { transactions: unique.length, fees, complete: sample.length === unique.length };
}
