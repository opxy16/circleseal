"use client";

import { decodeEventLog, getAbiItem, type Address, type Hex } from "viem";
import { AjoPassbookAbi } from "./abi/AjoPassbook";
import { getLogsChunked, publicClient } from "./chain";
import { addresses } from "./config";

export type GroupView = {
  id: bigint;
  collector: Address;
  metaHash: Hex;
  currency: Hex;
  contributionAmount: bigint;
  periodSeconds: number;
  createdAt: bigint;
  closed: boolean;
};

export type MemberView = {
  address: Address;
  status: number; // 0 none, 1 invited, 2 active, 3 left
  memberCode: Hex;
  contributions: number;
  payouts: number;
  totalContributed: bigint;
  totalReceived: bigint;
  lastPeriod: number;
};

export async function readGroup(id: bigint): Promise<GroupView> {
  const g = await publicClient.readContract({ address: addresses.passbook, abi: AjoPassbookAbi, functionName: "getGroup", args: [id] });
  return {
    id,
    collector: g.collector,
    metaHash: g.metaHash,
    currency: g.currency,
    contributionAmount: g.contributionAmount,
    periodSeconds: Number(g.periodSeconds),
    createdAt: g.createdAt,
    closed: g.closed,
  };
}

export async function readMember(groupId: bigint, member: Address): Promise<MemberView> {
  const m = await publicClient.readContract({
    address: addresses.passbook,
    abi: AjoPassbookAbi,
    functionName: "getMember",
    args: [groupId, member],
  });
  return {
    address: member,
    status: Number(m.status),
    memberCode: m.memberCode,
    contributions: Number(m.contributions),
    payouts: Number(m.payouts),
    totalContributed: m.totalContributed,
    totalReceived: m.totalReceived,
    lastPeriod: Number(m.lastPeriod),
  };
}

export async function groupsCollectedBy(collector: Address): Promise<bigint[]> {
  const logs = await getLogsChunked({
    address: addresses.passbook,
    event: getAbiItem({ abi: AjoPassbookAbi, name: "GroupCreated" }),
    args: { collector },
  });
  return logs.map((l) => decodeEventLog({ abi: AjoPassbookAbi, ...l }).args as { groupId: bigint }).map((a) => a.groupId);
}

export async function membersOf(groupId: bigint): Promise<Address[]> {
  const logs = await getLogsChunked({
    address: addresses.passbook,
    event: getAbiItem({ abi: AjoPassbookAbi, name: "MemberJoined" }),
    args: { groupId },
  });
  const seen = new Set<Address>();
  for (const l of logs) seen.add((decodeEventLog({ abi: AjoPassbookAbi, ...l }).args as { member: Address }).member);
  return [...seen];
}

export async function groupsJoinedBy(member: Address): Promise<bigint[]> {
  const logs = await getLogsChunked({
    address: addresses.passbook,
    event: getAbiItem({ abi: AjoPassbookAbi, name: "MemberJoined" }),
    args: { member },
  });
  const ids = new Set<bigint>();
  for (const l of logs) ids.add((decodeEventLog({ abi: AjoPassbookAbi, ...l }).args as { groupId: bigint }).groupId);
  return [...ids];
}

export async function thriftRecord(wallet: Address) {
  const r = await publicClient.readContract({ address: addresses.passbook, abi: AjoPassbookAbi, functionName: "thriftRecord", args: [wallet] });
  return {
    groupsJoined: Number(r.groupsJoined),
    contributions: Number(r.contributions),
    payouts: Number(r.payouts),
    firstActivityAt: r.firstActivityAt,
    lastActivityAt: r.lastActivityAt,
  };
}

/** Group id created in a given transaction (read from the GroupCreated event). */
export async function groupIdFromTx(hash: Hex): Promise<bigint | null> {
  const receipt = await publicClient.getTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: AjoPassbookAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "GroupCreated") return (ev.args as { groupId: bigint }).groupId;
    } catch {
      /* not a passbook event */
    }
  }
  return null;
}
