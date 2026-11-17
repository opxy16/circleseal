"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { Funds } from "@/components/funds";
import { ChevronRight, RefreshCcw } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, LoadingCard, Notice, PageHeader, Segmented } from "@/components/ui";
import { WalletGate } from "@/components/wallet";
import {
  circlesOf,
  createCircle,
  faucetAvailable,
  fmt,
  parseAmount,
  readCircle,
  roundLabel,
  STATUS_TONE,
  tokenInfo,
  type CircleView,
  type TokenInfo,
} from "@/lib/circle";
import { addresses } from "@/lib/config";
import { circleName, saveCircleName } from "@/lib/local";

const ROUNDS = [
  ...(faucetAvailable ? [{ label: "5 min (test)", seconds: 300 }] : []),
  { label: "Daily", seconds: 86_400 },
  { label: "Weekly", seconds: 604_800 },
  { label: "Monthly", seconds: 2_592_000 },
];

export default function CirclesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="Circle mode"
        title="Savings circles"
        description="A rotating ajo in a dollar stablecoin, run by code instead of a collector. Everyone posts a bond and pays each round, and the pot goes to a different member each time."
      />
      <WalletGate purpose="Your wallet holds your circle savings.">{(account) => <Circles account={account} />}</WalletGate>
    </div>
  );
}

function Circles({ account }: { account: PrivateKeyAccount }) {
  const router = useRouter();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [circles, setCircles] = useState<CircleView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contribution, setContribution] = useState("20");
  const [bond, setBond] = useState("20");
  const [members, setMembers] = useState("4");
  const [round, setRound] = useState(ROUNDS[0].seconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!addresses.stablecoin) return;
    try {
      setToken(await tokenInfo(addresses.stablecoin));
      const ids = await circlesOf(account.address);
      setCircles(await Promise.all(ids.map(readCircle)));
    } catch {
      setLoadError("Couldn't reach the network. Check your connection and reload.");
    }
  }, [account.address]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const trimmed = name.trim();
    const n = Number(members);
    if (trimmed.length < 3) return setError("Give the circle a name (at least 3 characters).");
    if (!(Number(contribution) > 0)) return setError("Enter how much each member pays per round.");
    if (!(Number(bond) >= 0)) return setError("Enter a bond amount (0 for none).");
    if (!Number.isInteger(n) || n < 2 || n > 50) return setError("A circle needs 2 to 50 members.");
    setBusy(true);
    setError(null);
    try {
      const res = await createCircle(account, {
        token: token.address,
        contribution: parseAmount(contribution, token),
        bond: parseAmount(bond, token),
        roundDuration: round,
        maxMembers: n,
        metaHash: keccak256(toBytes(trimmed)),
      });
      if (res.circleId === null) throw new Error("Circle created, but its number couldn't be read. Reload the page.");
      saveCircleName(res.circleId, trimmed);
      router.push(`/circles/${res.circleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the circle.");
      setBusy(false);
    }
  };

  return (
    <>
      <Funds address={account.address} account={account} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">Your circles</h2>
        {loadError && <Notice tone="bad">{loadError}</Notice>}
        {!circles && !loadError && <LoadingCard label="Reading your circles from QIE…" />}
        {circles?.length === 0 && (
          <EmptyState icon={<RefreshCcw className="h-5 w-5" aria-hidden />} title="No circles yet">
            Start one below, or open an invite link from a friend.
          </EmptyState>
        )}
        <ul className="flex flex-col gap-2">
          {circles?.map((c) => (
            <li key={String(c.id)}>
              <Link href={`/circles/${c.id}`} className="group block">
                <Card className="flex items-center gap-4 transition-colors group-hover:border-brand">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-stamp-soft text-stamp">
                    <RefreshCcw className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{circleName(c.id) ?? `Circle #${c.id}`}</p>
                    <p className="text-sm text-muted">
                      {token ? fmt(c.contributionAmount, token) : "…"} · {roundLabel(c.roundDuration)} · {c.memberCount}/{c.maxMembers} members
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardHeader title="Start a circle" description="You join first and post the same bond as everyone else. Payout order is join order." />
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field
            id="cname"
            label="Circle name"
            placeholder="e.g. Class of 2019 savings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Stays on your phone and in your invite link. Only a fingerprint goes on-chain."
          />
          <div className="grid grid-cols-2 gap-3">
            <Field id="contribution" label={`Each round (${token?.symbol ?? "…"})`} inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.target.value)} />
            <Field id="bond" label={`Bond (${token?.symbol ?? "…"})`} inputMode="decimal" value={bond} onChange={(e) => setBond(e.target.value)} hint="Covers a missed round." />
          </div>
          <Field id="members" label="Members (2–50)" inputMode="numeric" value={members} onChange={(e) => setMembers(e.target.value.replace(/\D/g, ""))} />
          <Segmented label="Round length" options={ROUNDS.map((r) => ({ label: r.label, value: r.seconds }))} value={round} onChange={setRound} />
          {token && Number(contribution) > 0 && Number(members) >= 2 && (
            <Notice>
              Each member pays {contribution} {token.symbol} a round for {members} rounds and receives the pot of{" "}
              {(Number(contribution) * Number(members)).toLocaleString("en-NG")} {token.symbol} once. You need {bond || 0} {token.symbol} now
              for your bond. Early recipients have part of the pot kept back to prepay their remaining rounds; a bigger bond
              means they get more of it up front.
            </Notice>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" size="lg" loading={busy} disabled={!token}>
            {busy ? "Creating circle…" : "Create circle"}
          </Button>
        </form>
      </Card>
    </>
  );
}
