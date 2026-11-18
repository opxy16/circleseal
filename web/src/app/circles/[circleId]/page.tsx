"use client";

import { ArrowLeft, Clock, Crown, HandCoins, History, PlayCircle, Scale, Undo2, UserPlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { keccak256, toBytes, type Address } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { Avatar } from "@/components/avatar";
import { Funds } from "@/components/funds";
import { Guilloche } from "@/components/seal";
import { Badge, Button, Card, CardHeader, CopyButton, LoadingCard, Notice, Stat, TxLink, WhatsAppButton } from "@/components/ui";
import { WalletGate } from "@/components/wallet";
import {
  chainNow,
  circleCall,
  circleHistory,
  contribute,
  fmt,
  joinCircle,
  paidInRound,
  readCircle,
  readRotation,
  roundLabel,
  STATUS_TONE,
  tokenInfo,
  untilLabel,
  type CircleMember,
  type CircleView,
  type HistoryItem,
  type TokenInfo,
  type TxResult,
} from "@/lib/circle";
import { explorerTx } from "@/lib/config";
import { appUrl, whatsappShare } from "@/lib/links";
import { circleName, saveCircleName, shortAddr } from "@/lib/local";
import { useQieNames } from "@/lib/qieid";

export default function CirclePage() {
  const { circleId } = useParams<{ circleId: string }>();
  const id = /^\d+$/.test(circleId ?? "") ? BigInt(circleId) : null;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/circles" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All circles
      </Link>
      {id === null ? (
        <Notice tone="bad">This circle link isn&apos;t valid.</Notice>
      ) : (
        <WalletGate purpose="Unlock to view and take part in this circle.">{(account) => <Circle id={id} account={account} />}</WalletGate>
      )}
    </div>
  );
}

type Data = {
  circle: CircleView;
  token: TokenInfo;
  rotation: CircleMember[];
  paid: Record<string, boolean>;
  history: HistoryItem[];
};

function Circle({ id, account }: { id: bigint; account: PrivateKeyAccount }) {
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ label: string; tx: TxResult } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  const names = useQieNames(
    data
      ? [
          data.circle.organizer,
          ...data.rotation.map((m) => m.address),
          ...data.history.map((h) => ("member" in h ? h.member : h.recipient)),
        ]
      : [],
  );

  const load = useCallback(async () => {
    try {
      const circle = await readCircle(id);
      const [token, rotation, history, now] = await Promise.all([tokenInfo(circle.token), readRotation(id), circleHistory(id), chainNow()]);
      let paid: Record<string, boolean> = {};
      if (circle.status === "Active") {
        const round = Math.min(Math.floor((now - circle.startTime) / circle.roundDuration), circle.memberCount);
        if (round < circle.memberCount) paid = await paidInRound(id, round, rotation.map((m) => m.address));
      }
      setData({ circle, token, rotation, paid, history });
      setClock(now);

      // Name: from this device, or from the invite link (checked against the on-chain fingerprint).
      const matches = (n: string | null) => !!n && keccak256(toBytes(n)) === circle.metaHash;
      const saved = circleName(id);
      const fromLink = new URLSearchParams(window.location.search).get("n");
      if (matches(saved)) setName(saved);
      else if (matches(fromLink) && fromLink) {
        saveCircleName(id, fromLink);
        setName(fromLink);
      }
    } catch {
      setLoadError("Circle not found, or the network can't be reached.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Tick the countdown every second; re-read the chain every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => setClock((c) => c + 1), 1_000);
    const r = setInterval(load, 15_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [load]);

  if (loadError) return <Notice tone="bad">{loadError}</Notice>;
  if (!data) return <LoadingCard label="Reading the circle from QIE…" />;

  const { circle, token, rotation, paid, history } = data;
  const me = rotation.find((m) => m.address.toLowerCase() === account.address.toLowerCase());
  const isOrganizer = circle.organizer.toLowerCase() === account.address.toLowerCase();
  const label = name ?? `Circle #${circle.id}`;
  const full = circle.memberCount >= circle.maxMembers;
  const pot = circle.contributionAmount * BigInt(circle.status === "Open" ? circle.maxMembers : circle.memberCount);
  const anyMissed = rotation.some((m) => m.missed > 0);

  const elapsedRound = circle.status === "Active" ? Math.floor((clock - circle.startTime) / circle.roundDuration) : -1;
  const round = Math.min(elapsedRound, circle.memberCount);
  const roundOpen = circle.status === "Active" && round < circle.memberCount && round >= circle.settledRounds;
  const roundEndsIn = circle.startTime + (round + 1) * circle.roundDuration - clock;
  const settleReady = circle.status === "Active" && clock >= circle.startTime + (circle.settledRounds + 1) * circle.roundDuration;
  const iPaid = me ? paid[me.address.toLowerCase()] : false;
  const iPrepaid = me ? me.held >= circle.contributionAmount : false;
  const paidCount = Object.values(paid).filter(Boolean).length;
  const progress = circle.status === "Open" ? 0 : Math.round((circle.settledRounds / Math.max(circle.memberCount, 1)) * 100);

  const who = (a: Address) =>
    a.toLowerCase() === account.address.toLowerCase() ? "You" : (names[a.toLowerCase()] ?? shortAddr(a));

  const act = async (labelText: string, fn: () => Promise<TxResult>) => {
    setBusy(labelText);
    setError(null);
    try {
      const tx = await fn();
      setLast({ label: labelText, tx });
      await load();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const inviteUrl = appUrl(`/circles/${circle.id}${name ? `?n=${encodeURIComponent(name)}` : ""}`);
  const inviteText = `Join my savings circle "${label}" on CircleSeal: ${fmt(circle.contributionAmount, token)} per round, ${circle.maxMembers} members, ${roundLabel(circle.roundDuration)}. The rules are enforced by code.`;

  const withdrawable =
    me && !me.withdrawn
      ? me.bond + me.held + (circle.status === "Completed" && me.missed === 0 && circle.honestCount > 0 ? circle.reserve / BigInt(circle.honestCount) : 0n)
      : 0n;

  return (
    <>
      {/* Overview */}
      <Card className="relative overflow-hidden p-0">
        <Guilloche size={260} rings={2} lines={9} k={11} className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 text-stamp opacity-20" turn={circle.status === "Active"} />
        <div className="relative flex items-start justify-between gap-3 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-stamp">Savings circle</p>
            <h1 className="font-display mt-1 text-balance break-words text-3xl leading-[1.05]">{label}</h1>
            <p className="mt-1 text-sm text-muted">
              {roundLabel(circle.roundDuration)} · organised by {who(circle.organizer)}
            </p>
          </div>
          <Badge tone={STATUS_TONE[circle.status]}>{circle.status}</Badge>
        </div>
        <div className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x">
          <div className="p-4"><Stat label="Each round" value={fmt(circle.contributionAmount, token)} /></div>
          <div className="p-4"><Stat label="Bond" value={fmt(circle.bondAmount, token)} /></div>
          <div className="p-4"><Stat label="Members" value={`${circle.memberCount}/${circle.maxMembers}`} /></div>
          <div className="p-4"><Stat label={circle.status === "Open" ? "Pot when full" : "Pot per round"} value={fmt(pot, token)} /></div>
        </div>
        {circle.status !== "Open" && circle.status !== "Cancelled" && (
          <div className="border-t border-line px-5 py-4">
            <div className="mb-2 flex justify-between text-xs text-muted">
              <span>Rounds settled</span>
              <span className="tabular-nums">
                {circle.settledRounds} of {circle.memberCount}
              </span>
            </div>
            <div className="flex gap-1" role="progressbar" aria-label="Rounds settled" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              {Array.from({ length: circle.memberCount }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 flex-1 rounded-sm transition-colors duration-500 ${i < circle.settledRounds ? "bg-brand" : i === circle.settledRounds && circle.status === "Active" ? "bg-stamp" : "bg-surface-2"}`}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Someone new needs funds before they can join, so show the wallet first. */}
      {!me && circle.status === "Open" && <Funds address={account.address} account={account} refreshKey={refreshKey} />}

      {/* Open: join / share / start */}
      {circle.status === "Open" && (
        <Card className="flex flex-col gap-4">
          {!me ? (
            <>
              <CardHeader
                title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-brand" aria-hidden /> Join this circle</span>}
                description={`Joining posts your bond of ${fmt(circle.bondAmount, token)}. When it's your turn, the contract keeps back enough of the pot to prepay your remaining rounds beyond what your bond covers, so nobody can take the pot and walk away. If you never miss, your bond comes back at the end, plus a share of anything deducted from members who did.`}
              />
              <Button size="lg" loading={!!busy} disabled={full} onClick={() => act("Joined the circle", () => joinCircle(account, circle))}>
                {full ? "Circle is full" : `Join and post ${fmt(circle.bondAmount, token)} bond`}
              </Button>
            </>
          ) : (
            <>
              <CardHeader
                eyebrow={full ? "Ready to start" : "Waiting for members"}
                title={full ? "Everyone's in" : `${circle.maxMembers - circle.memberCount} more to go`}
                description={
                  full
                    ? isOrganizer
                      ? "Start the circle to open round 1."
                      : "Waiting for the organizer to start round 1."
                    : "Share this link with the people you save with. Payout order is the order people join."
                }
              />
              {!full && (
                <div className="flex flex-wrap gap-2">
                  <WhatsAppButton href={whatsappShare(`${inviteText}\n${inviteUrl}`)} />
                  <CopyButton text={inviteUrl} />
                </div>
              )}
            </>
          )}
          {isOrganizer && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button loading={!!busy} disabled={circle.memberCount < 2} onClick={() => act("Started the circle", () => circleCall(account, "start", circle.id))}>
                {!busy && <PlayCircle className="h-4 w-4" aria-hidden />}
                {circle.memberCount < 2 ? "Need 2+ members to start" : `Start with ${circle.memberCount} members`}
              </Button>
              <Button variant="destructive" disabled={!!busy} onClick={() => act("Cancelled the circle", () => circleCall(account, "cancel", circle.id))}>
                <XCircle className="h-4 w-4" aria-hidden /> Cancel circle
              </Button>
            </div>
          )}
          {me && !isOrganizer && (
            <Button variant="ghost" size="sm" className="self-start" disabled={!!busy} onClick={() => act("Left the circle", () => circleCall(account, "leave", circle.id))}>
              <Undo2 className="h-4 w-4" aria-hidden /> Leave and get my bond back
            </Button>
          )}
        </Card>
      )}

      {/* Active: current round */}
      {circle.status === "Active" && (
        <Card className="flex flex-col gap-4">
          {roundOpen ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stamp">
                    Round {round + 1} of {circle.memberCount}
                  </p>
                  <p className="mt-1 font-wide text-xl font-bold tracking-tight">
                    {fmt(pot, token)} goes to {who(rotation[round].address)}
                  </p>
                  <p className="text-sm text-muted">
                    {paidCount} of {circle.memberCount} paid so far
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-right">
                  <p className="flex items-center justify-end gap-1 text-xs text-muted">
                    <Clock className="h-3 w-3" aria-hidden /> Ends in
                  </p>
                  <p className="font-display text-lg tabular-nums">{untilLabel(roundEndsIn)}</p>
                </div>
              </div>
              {me &&
                (iPaid ? (
                  <Notice tone="ok">You&apos;ve paid this round.</Notice>
                ) : iPrepaid ? (
                  <Notice tone="ok" title="This round is prepaid">
                    It comes out of the {fmt(me.held, token)} kept back from your payout. Nothing to do.
                  </Notice>
                ) : (
                  <Button size="lg" loading={!!busy} onClick={() => act(`Paid round ${round + 1}`, () => contribute(account, circle))}>
                    {!busy && <HandCoins className="h-4 w-4" aria-hidden />}
                    Pay {fmt(circle.contributionAmount, token)} for round {round + 1}
                  </Button>
                ))}
            </>
          ) : (
            <p className="text-sm text-muted">All rounds have ended. Settle the remaining rounds to finish the circle.</p>
          )}
          {settleReady && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-stamp p-4">
              <p className="text-sm">
                <span className="font-medium">Round {circle.settledRounds + 1} is over.</span> Settling pays{" "}
                {who(rotation[circle.settledRounds].address)}, covers any missed payments from the skipper&apos;s own holdback or bond, and keeps back
                enough of the pot to prepay the recipient&apos;s remaining rounds. Anyone in the circle can do it.
              </p>
              <Button variant="outline" disabled={!!busy} onClick={() => act(`Settled round ${circle.settledRounds + 1}`, () => circleCall(account, "settleRound", circle.id))}>
                <Scale className="h-4 w-4" aria-hidden /> Settle round {circle.settledRounds + 1}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Finished */}
      {(circle.status === "Completed" || circle.status === "Cancelled") && (
        <Card className="flex flex-col gap-4">
          <CardHeader
            title={circle.status === "Completed" ? "Circle complete" : "Circle cancelled"}
            description={
              circle.status === "Cancelled"
                ? "The circle was cancelled before it started. Every member can take their bond back."
                : !anyMissed
                  ? "Every round is settled and nobody missed a payment."
                  : circle.reserve > 0n
                    ? `Every round is settled. ${fmt(circle.reserve, token)} deducted from members who missed is shared by the ${circle.honestCount} who never did.`
                    : "Every round is settled. Missed payments were covered from the money the members who missed had locked in the circle, so nobody else lost out."
            }
          />
          {me && !me.withdrawn && withdrawable > 0n && (
            <Button size="lg" loading={!!busy} onClick={() => act("Withdrew bond", () => circleCall(account, "withdraw", circle.id))}>
              Withdraw {fmt(withdrawable, token)}
            </Button>
          )}
          {me?.withdrawn && <Notice tone="ok">You&apos;ve withdrawn your bond.</Notice>}
        </Card>
      )}

      {busy && <Notice>Sending to QIE… this can take a few seconds.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {last && !busy && (
        <Notice tone="ok">
          {last.label}. <TxLink hash={last.tx.hash} explorer={last.tx.explorer} />
        </Notice>
      )}

      {/* Rotation */}
      <Card>
        <CardHeader title="Rotation" description="Payout order is join order. Each member receives the pot once." />
        <ol className="-my-2 divide-y divide-line">
          {rotation.map((m, i) => {
            const done = i < circle.settledRounds;
            const current = roundOpen && i === round;
            const hasPaid = paid[m.address.toLowerCase()];
            return (
              <li key={m.address} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative">
                    <Avatar seed={m.address} name={who(m.address)} />
                    <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface bg-ink text-[9px] font-bold text-bg">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {who(m.address)}
                      {m.address.toLowerCase() === circle.organizer.toLowerCase() && <Crown className="h-3.5 w-3.5 text-stamp" aria-label="organizer" />}
                      {current && <Badge tone="stamp">Receiving</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {done ? `Received ${fmt(m.received, token)}` : `Round ${i + 1}`}
                      {m.missed > 0 && ` · missed ${m.missed}`}
                      {m.debt > 0n && ` · owes ${fmt(m.debt, token)}`}
                      {m.held > 0n && ` · ${fmt(m.held, token)} prepaid`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  {roundOpen &&
                    (hasPaid ? (
                      <Badge tone="brand">Paid</Badge>
                    ) : m.held >= circle.contributionAmount ? (
                      <Badge tone="brand">Prepaid</Badge>
                    ) : (
                      <Badge>Not yet</Badge>
                    ))}
                  <p className="mt-1 text-muted">Bond {fmt(m.bond, token)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-brand" aria-hidden /> On-chain history</span>}
            description="Every settlement, miss and withdrawal, read straight from the contract."
          />
          <ul className="-my-2 divide-y divide-line text-sm">
            {history.map((h, i) => (
              <li key={`${h.tx}-${i}`} className="flex items-start justify-between gap-3 py-3">
                <span className="flex min-w-0 gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${h.kind === "miss" ? "bg-bad" : h.kind === "settled" || h.kind === "prepaid" ? "bg-brand" : "bg-stamp"}`}
                    aria-hidden
                  />
                  <span className="text-pretty">
                    {h.kind === "settled" &&
                      `Round ${h.round + 1}: ${who(h.recipient)} received ${fmt(h.paidOut, token)}${h.debtDeducted > 0n ? ` (${fmt(h.debtDeducted, token)} debt deducted)` : ""}`}
                    {h.kind === "miss" &&
                      `Round ${h.round + 1}: ${who(h.member)} missed. ${h.fromBond > 0n ? `${fmt(h.fromBond, token)} covered from their own bond and holdback` : "Their bond was already used up"}${h.addedDebt > 0n ? `, ${fmt(h.addedDebt, token)} added as debt` : ""}`}
                    {h.kind === "withdrawn" && `${who(h.member)} withdrew ${fmt(h.amount, token)}`}
                    {h.kind === "held" && `Round ${h.round + 1}: ${fmt(h.held, token)} kept back to prepay ${who(h.recipient) === "You" ? "your" : `${who(h.recipient)}'s`} remaining rounds`}
                    {h.kind === "prepaid" && `Round ${h.round + 1}: ${who(h.member)}'s share paid from their holdback`}
                  </span>
                </span>
                <TxLink hash={h.tx} explorer={explorerTx(h.tx)} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(me || circle.status !== "Open") && <Funds address={account.address} account={account} refreshKey={refreshKey} />}
    </>
  );
}
