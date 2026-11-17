"use client";

import { decodeEventLog, getAbiItem, type Address } from "viem";
import { AjoPassbookAbi } from "./abi/AjoPassbook";
import { getLogsChunked } from "./chain";
import { circlesOf, readCircle, readCircleMember, type CircleMember, type CircleView } from "./circle";
import { addresses } from "./config";
import { groupsJoinedBy, readGroup, readMember, thriftRecord, type GroupView, type MemberView } from "./reads";

/**
 * A member's savings proof: everything here is read live from CircleSeal's contracts for one
 * wallet address, so a lender can check it themselves. Nothing comes from CircleSeal's servers.
 */

export type GroupProof = {
  group: GroupView;
  me: MemberView;
  /** Distinct periods paid, the first and latest period, and how many periods that span covers. */
  periodsPaid: number;
  firstPeriod: number;
  lastPeriod: number;
  span: number;
  firstPaidAt: number;
  lastPaidAt: number;
};

export type CircleProof = { circle: CircleView; me: CircleMember };

export type Proof = {
  address: Address;
  record: Awaited<ReturnType<typeof thriftRecord>>;
  groups: GroupProof[];
  circles: CircleProof[];
  totals: {
    saved: bigint;
    received: bigint;
    payments: number;
    periodsPaid: number;
    periodsSpanned: number;
    circleRoundsMissed: number;
    circlesCompleted: number;
  };
};

type ReceiptArgs = { groupId: bigint; period: number | bigint; paidAt: bigint };

export async function loadProof(address: Address): Promise<Proof> {
  const [record, groupIds, receiptLogs, circleIds] = await Promise.all([
    thriftRecord(address),
    groupsJoinedBy(address),
    getLogsChunked({
      address: addresses.passbook,
      event: getAbiItem({ abi: AjoPassbookAbi, name: "ContributionRecorded" }),
      args: { member: address },
    }),
    addresses.circle ? circlesOf(address) : Promise.resolve([] as bigint[]),
  ]);

  const receipts = receiptLogs.map(
    (l) => decodeEventLog({ abi: AjoPassbookAbi, data: l.data, topics: l.topics }).args as unknown as ReceiptArgs,
  );

  const groups: GroupProof[] = await Promise.all(
    groupIds.map(async (id) => {
      const [group, me] = await Promise.all([readGroup(id), readMember(id, address)]);
      const mine = receipts.filter((r) => r.groupId === id);
      const periods = [...new Set(mine.map((r) => Number(r.period)))].sort((a, b) => a - b);
      const times = mine.map((r) => Number(r.paidAt)).sort((a, b) => a - b);
      const firstPeriod = periods[0] ?? 0;
      const lastPeriod = periods[periods.length - 1] ?? 0;
      return {
        group,
        me,
        periodsPaid: periods.length,
        firstPeriod,
        lastPeriod,
        span: periods.length ? lastPeriod - firstPeriod + 1 : 0,
        firstPaidAt: times[0] ?? 0,
        lastPaidAt: times[times.length - 1] ?? 0,
      };
    }),
  );

  const circles: CircleProof[] = (
    await Promise.all(circleIds.map(async (id) => ({ circle: await readCircle(id), me: await readCircleMember(id, address) })))
  ).filter((c) => c.me.joined);

  return {
    address,
    record,
    groups: groups.sort((a, b) => b.lastPaidAt - a.lastPaidAt),
    circles,
    totals: {
      saved: groups.reduce((s, g) => s + g.me.totalContributed, 0n),
      received: groups.reduce((s, g) => s + g.me.totalReceived, 0n),
      payments: record.contributions,
      periodsPaid: groups.reduce((s, g) => s + g.periodsPaid, 0),
      periodsSpanned: groups.reduce((s, g) => s + g.span, 0),
      circleRoundsMissed: circles.reduce((s, c) => s + c.me.missed, 0),
      circlesCompleted: circles.filter((c) => c.circle.status === "Completed").length,
    },
  };
}

/** How long someone has been saving, in plain words: "3 days", "5 months", "2 years". */
export function savingFor(from: number, to: number): string | null {
  if (!from || !to) return null;
  const days = Math.floor((to - from) / 86_400) + 1;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (days < 45) return plural(days, "day");
  const months = Math.round(days / 30.44);
  if (months < 24) return plural(months, "month");
  return plural(Math.floor(months / 12), "year");
}
