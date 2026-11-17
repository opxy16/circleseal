"use client";

import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  decodeEventLog,
  erc20Abi,
  formatUnits,
  getAbiItem,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { AjoCircleAbi } from "./abi/AjoCircle";
import { getLogsChunked, publicClient } from "./chain";
import { addresses, chain, explorerTx, useLegacyTx } from "./config";

/**
 * Circle mode: a rotating savings circle in a stablecoin, enforced by the AjoCircle contract.
 * Unlike passbook mode, money moves on-chain here, so each member's own wallet signs and
 * sends the transactions (paying a tiny gas fee in QIE).
 */

export const CircleStatus = ["None", "Open", "Active", "Completed", "Cancelled"] as const;

export type CircleView = {
  id: bigint;
  token: Address;
  organizer: Address;
  metaHash: Hex;
  contributionAmount: bigint;
  bondAmount: bigint;
  roundDuration: number;
  maxMembers: number;
  memberCount: number;
  settledRounds: number;
  startTime: number;
  status: (typeof CircleStatus)[number];
  reserve: bigint;
  honestCount: number;
};

export type CircleMember = {
  address: Address;
  joined: boolean;
  withdrawn: boolean;
  position: number;
  missed: number;
  bond: bigint;
  debt: bigint;
  received: bigint;
  held: bigint; // part of their payout kept back to prepay their remaining rounds
};

export type TokenInfo = { address: Address; symbol: string; decimals: number };

const tokenCache = new Map<string, TokenInfo>();
export async function tokenInfo(token: Address): Promise<TokenInfo> {
  const hit = tokenCache.get(token.toLowerCase());
  if (hit) return hit;
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  const info = { address: token, symbol, decimals };
  tokenCache.set(token.toLowerCase(), info);
  return info;
}

export const fmt = (amount: bigint, t: TokenInfo) =>
  `${Number(formatUnits(amount, t.decimals)).toLocaleString("en-NG", { maximumFractionDigits: 2 })} ${t.symbol}`;
export const parseAmount = (input: string, t: TokenInfo) => parseUnits(input.replace(/,/g, "").trim() || "0", t.decimals);

export async function readCircle(id: bigint): Promise<CircleView> {
  const c = await publicClient.readContract({ address: addresses.circle, abi: AjoCircleAbi, functionName: "getCircle", args: [id] });
  return {
    id,
    token: c.token,
    organizer: c.organizer,
    metaHash: c.metaHash,
    contributionAmount: c.contributionAmount,
    bondAmount: c.bondAmount,
    roundDuration: Number(c.roundDuration),
    maxMembers: Number(c.maxMembers),
    memberCount: Number(c.memberCount),
    settledRounds: Number(c.settledRounds),
    startTime: Number(c.startTime),
    status: CircleStatus[Number(c.status)],
    reserve: c.reserve,
    honestCount: Number(c.honestCount),
  };
}

export async function readCircleMember(id: bigint, who: Address): Promise<CircleMember> {
  const m = await publicClient.readContract({ address: addresses.circle, abi: AjoCircleAbi, functionName: "getMember", args: [id, who] });
  return {
    address: who,
    joined: m.joined,
    withdrawn: m.withdrawn,
    position: Number(m.position),
    missed: Number(m.missed),
    bond: m.bond,
    debt: m.debt,
    received: m.received,
    held: m.held,
  };
}

export async function readRotation(id: bigint): Promise<CircleMember[]> {
  const order = await publicClient.readContract({ address: addresses.circle, abi: AjoCircleAbi, functionName: "getMembers", args: [id] });
  return Promise.all(order.map((a) => readCircleMember(id, a)));
}

/** Which members have paid in a given round. */
export async function paidInRound(id: bigint, round: number, members: Address[]): Promise<Record<string, boolean>> {
  const flags = await Promise.all(
    members.map((m) =>
      publicClient.readContract({ address: addresses.circle, abi: AjoCircleAbi, functionName: "paidInRound", args: [id, BigInt(round), m] }),
    ),
  );
  return Object.fromEntries(members.map((m, i) => [m.toLowerCase(), flags[i]]));
}

/** Circles this wallet has ever joined (including ones it organises), newest first. */
export async function circlesOf(who: Address): Promise<bigint[]> {
  const logs = await getLogsChunked({
    address: addresses.circle,
    event: getAbiItem({ abi: AjoCircleAbi, name: "MemberJoined" }),
    args: { member: who },
  });
  const ids = new Set<bigint>();
  for (const l of logs) ids.add((decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { circleId: bigint }).circleId);
  return [...ids].sort((a, b) => (a > b ? -1 : 1));
}

export type HistoryItem =
  | { kind: "settled"; round: number; recipient: Address; paidOut: bigint; debtDeducted: bigint; tx: Hex }
  | { kind: "miss"; round: number; member: Address; fromBond: bigint; addedDebt: bigint; tx: Hex }
  | { kind: "withdrawn"; member: Address; amount: bigint; tx: Hex }
  | { kind: "held"; round: number; recipient: Address; held: bigint; tx: Hex }
  | { kind: "prepaid"; round: number; member: Address; amount: bigint; tx: Hex };

export async function circleHistory(id: bigint): Promise<HistoryItem[]> {
  const [settled, misses, withdrawals, holds, prepaid] = await Promise.all(
    (["RoundSettled", "MissCovered", "Withdrawn", "PayoutHeld", "PaidFromHoldback"] as const).map((name) =>
      getLogsChunked({ address: addresses.circle, event: getAbiItem({ abi: AjoCircleAbi, name }), args: { circleId: id } }),
    ),
  );
  const out: (HistoryItem & { block: bigint; index: number })[] = [];
  const order = (l: { blockNumber: bigint | null; logIndex: number | null }) => ({ block: l.blockNumber ?? 0n, index: l.logIndex ?? 0 });
  for (const l of settled) {
    const a = decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { round: bigint; recipient: Address; paidOut: bigint; debtDeducted: bigint };
    out.push({ kind: "settled", round: Number(a.round), recipient: a.recipient, paidOut: a.paidOut, debtDeducted: a.debtDeducted, tx: l.transactionHash!, ...order(l) });
  }
  for (const l of misses) {
    const a = decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { round: bigint; member: Address; fromBond: bigint; addedDebt: bigint };
    out.push({ kind: "miss", round: Number(a.round), member: a.member, fromBond: a.fromBond, addedDebt: a.addedDebt, tx: l.transactionHash!, ...order(l) });
  }
  for (const l of holds) {
    const a = decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { round: bigint; recipient: Address; held: bigint };
    out.push({ kind: "held", round: Number(a.round), recipient: a.recipient, held: a.held, tx: l.transactionHash!, ...order(l) });
  }
  for (const l of prepaid) {
    const a = decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { round: bigint; member: Address; amount: bigint };
    out.push({ kind: "prepaid", round: Number(a.round), member: a.member, amount: a.amount, tx: l.transactionHash!, ...order(l) });
  }
  for (const l of withdrawals) {
    const a = decodeEventLog({ abi: AjoCircleAbi, ...l }).args as { member: Address; amount: bigint };
    out.push({ kind: "withdrawn", member: a.member, amount: a.amount, tx: l.transactionHash!, ...order(l) });
  }
  const rank = { miss: 0, prepaid: 0, settled: 1, held: 2, withdrawn: 3 } as const;
  return out.sort((a, b) =>
    a.block !== b.block ? (a.block > b.block ? -1 : 1) : rank[a.kind] - rank[b.kind] || a.index - b.index,
  );
}

export async function balances(who: Address, token: Address) {
  const [gas, stable] = await Promise.all([
    publicClient.getBalance({ address: who }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] }),
  ]);
  return { gas, stable };
}

export async function chainNow(): Promise<number> {
  const block = await publicClient.getBlock();
  return Number(block.timestamp);
}

// ---------------------------------------------------------------------------
// Writes (sent directly from the member's in-app wallet)
// ---------------------------------------------------------------------------

const FRIENDLY: Record<string, string> = {
  InvalidParams: "Check the circle settings: amounts must be above zero and 2–50 members.",
  CircleNotFound: "Circle not found.",
  WrongStatus: "The circle isn't at the right stage for that.",
  NotOrganizer: "Only the organizer can do that.",
  AlreadyJoined: "You're already in this circle.",
  NotMember: "This wallet isn't in the circle.",
  CircleFull: "This circle is full.",
  OrganizerCannotLeave: "The organizer can't leave. Cancel the circle instead.",
  NotEnoughMembers: "You need at least 2 members to start.",
  RoundNotActive: "No round is open for payment right now.",
  AlreadyPaid: "You've already paid this round.",
  AlreadyPrepaid: "This round is already prepaid from your payout.",
  RoundNotOver: "This round hasn't ended yet.",
  NothingToWithdraw: "There's nothing for you to withdraw.",
};

function explain(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      if (FRIENDLY[name]) return FRIENDLY[name];
    }
    if (/insufficient funds/i.test(err.message)) return `Not enough ${chain.nativeCurrency.symbol} in your wallet to pay the network fee.`;
    if (/transfer amount exceeds balance|ERC20InsufficientBalance/i.test(err.message)) return "Not enough stablecoin in your wallet.";
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export type TxResult = { hash: Hex; explorer: string | null };

async function send(account: PrivateKeyAccount, params: { address: Address; abi: unknown; functionName: string; args: readonly unknown[] }) {
  const wallet = createWalletClient({ account, chain, transport: http() });
  try {
    const { request } = await publicClient.simulateContract({ account, ...(params as object) } as never);
    const hash = await wallet.writeContract(useLegacyTx ? ({ ...(request as object), type: "legacy" } as never) : (request as never));
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("The transaction failed on-chain.");
    return { hash, explorer: explorerTx(hash), receipt };
  } catch (e) {
    throw new Error(explain(e));
  }
}

/** Approve the circle contract to pull exactly what's needed, if it can't already. */
async function ensureAllowance(account: PrivateKeyAccount, token: Address, amount: bigint) {
  if (amount === 0n) return;
  const current = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [account.address, addresses.circle] });
  if (current >= amount) return;
  await send(account, { address: token, abi: erc20Abi, functionName: "approve", args: [addresses.circle, amount] });
}

export async function createCircle(
  account: PrivateKeyAccount,
  p: { token: Address; contribution: bigint; bond: bigint; roundDuration: number; maxMembers: number; metaHash: Hex },
): Promise<TxResult & { circleId: bigint | null }> {
  await ensureAllowance(account, p.token, p.bond);
  const { hash, explorer, receipt } = await send(account, {
    address: addresses.circle,
    abi: AjoCircleAbi,
    functionName: "createCircle",
    args: [p.token, p.contribution, p.bond, p.roundDuration, p.maxMembers, p.metaHash],
  });
  let circleId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: AjoCircleAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "CircleCreated") circleId = (ev.args as { circleId: bigint }).circleId;
    } catch {
      /* token event */
    }
  }
  return { hash, explorer, circleId };
}

export async function joinCircle(account: PrivateKeyAccount, c: CircleView): Promise<TxResult> {
  await ensureAllowance(account, c.token, c.bondAmount);
  const { hash, explorer } = await send(account, { address: addresses.circle, abi: AjoCircleAbi, functionName: "join", args: [c.id] });
  return { hash, explorer };
}

export async function contribute(account: PrivateKeyAccount, c: CircleView): Promise<TxResult> {
  await ensureAllowance(account, c.token, c.contributionAmount);
  const { hash, explorer } = await send(account, { address: addresses.circle, abi: AjoCircleAbi, functionName: "contribute", args: [c.id] });
  return { hash, explorer };
}

type SimpleCall = "leave" | "cancel" | "start" | "settleRound" | "withdraw";
export async function circleCall(account: PrivateKeyAccount, fn: SimpleCall, id: bigint): Promise<TxResult> {
  const { hash, explorer } = await send(account, { address: addresses.circle, abi: AjoCircleAbi, functionName: fn, args: [id] });
  return { hash, explorer };
}

/** Test networks only: ask the server for a little gas and test stablecoin. */
export async function requestTestFunds(who: Address): Promise<void> {
  const res = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: who }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't get test funds. Try again.");
}

export const faucetAvailable = chain.id !== 1990;

export function roundLabel(seconds: number): string {
  if (seconds < 3_600) return `${Math.round(seconds / 60)}-minute rounds`;
  if (seconds === 86_400) return "daily rounds";
  if (seconds === 604_800) return "weekly rounds";
  if (seconds === 2_592_000) return "monthly rounds";
  return `${Math.round(seconds / 86_400)}-day rounds`;
}

export function untilLabel(secondsLeft: number): string {
  if (secondsLeft <= 0) return "now";
  const d = Math.floor(secondsLeft / 86_400);
  const h = Math.floor((secondsLeft % 86_400) / 3_600);
  const m = Math.floor((secondsLeft % 3_600) / 60);
  const s = secondsLeft % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export const STATUS_TONE: Record<string, "neutral" | "brand" | "stamp" | "bad"> = {
  Open: "brand",
  Active: "stamp",
  Completed: "neutral",
  Cancelled: "bad",
};
