"use client";

import { Activity as ActivityIcon, BookOpen, ExternalLink, FileCode2, RefreshCcw, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardHeader, LoadingCard, Notice, PageHeader, Stat, TxLink } from "@/components/ui";
import { fmt, tokenInfo, type TokenInfo } from "@/lib/circle";
import { addresses, chain, explorerAddress, explorerTx, isDeployed } from "@/lib/config";
import { naira, shortAddr } from "@/lib/local";
import { loadStats, type Activity, type Stats } from "@/lib/stats";
import { useQieNames } from "@/lib/qieid";
import { NumberTicker } from "@/components/fx";
import { nativeHasPrice, usd, useQiePrice } from "@/lib/price";
import { formatEther } from "viem";
import { Fuel, LineChart } from "lucide-react";

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const names = useQieNames(stats?.recent.map((a) => a.who) ?? []);
  const price = useQiePrice();

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [s, t] = await Promise.all([loadStats(), addresses.stablecoin ? tokenInfo(addresses.stablecoin) : Promise.resolve(null)]);
      setStats(s);
      setToken(t);
      setUpdated(new Date());
      setError(null);
    } catch {
      setError("Couldn't read the chain right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const tok = (v: bigint) => (token ? fmt(v, token) : "…");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        eyebrow={`Live on ${chain.name}`}
        title="On-chain activity"
        description="Every number on this page is read directly from AjoProof's contracts, with no database in between. Anyone can check them on the explorer."
        action={
          <Button variant="outline" onClick={load} loading={busy}>
            {!busy && <RefreshCw className="h-4 w-4" aria-hidden />} Refresh
          </Button>
        }
      />

      {!isDeployed && <Notice tone="stamp">Contracts aren&apos;t deployed on this network yet.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {!stats && !error && <LoadingCard label="Reading every AjoProof event from the chain…" />}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Wallets", value: stats.wallets, money: false },
              { label: "Transactions", value: stats.transactions, money: false },
              { label: "Receipts co-signed", value: stats.passbook.receipts, money: false },
              { label: "Savings recorded", value: Number(stats.passbook.recorded) / 100, money: true },
            ].map((k) => (
              <Card key={k.label}>
                <Stat
                  label={k.label}
                  value={<NumberTicker value={k.value} format={(n) => (k.money ? naira(Math.round(n) * 100) : Math.round(n).toLocaleString("en-NG"))} />}
                />
              </Card>
            ))}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader
                eyebrow="Passbook mode"
                title={<span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-brand" aria-hidden /> Co-signed receipts</span>}
                description="Cash and transfer ajo, recorded with both signatures."
              />
              <dl className="grid grid-cols-2 gap-4">
                <Stat label="Groups" value={stats.passbook.groups} />
                <Stat label="Members" value={stats.passbook.members} />
                <Stat label="Contributions" value={stats.passbook.receipts} sub={naira(stats.passbook.recorded)} />
                <Stat label="Payouts" value={stats.passbook.payouts} sub={naira(stats.passbook.paidOut)} />
              </dl>
            </Card>
            <Card>
              <CardHeader
                eyebrow="Circle mode"
                title={<span className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-stamp" aria-hidden /> Code-enforced circles</span>}
                description={`Rotating savings in ${token?.symbol ?? "a stablecoin"}, held by the contract.`}
              />
              <dl className="grid grid-cols-2 gap-4">
                <Stat label="Circles" value={stats.circle.circles} />
                <Stat label="Members" value={stats.circle.members} />
                <Stat label="Round payments" value={stats.circle.contributions} sub={tok(stats.circle.contributed)} />
                <Stat label="Paid out" value={tok(stats.circle.paidOut)} sub={`${stats.circle.covered} missed payment${stats.circle.covered === 1 ? "" : "s"} covered`} />
              </dl>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader
                eyebrow="Gas-free for members"
                title={<span className="flex items-center gap-2"><Fuel className="h-4 w-4 text-brand" aria-hidden /> Network fees AjoProof paid</span>}
                description="Members never buy crypto: the relayer pays every passbook transaction's fee."
              />
              <div className="grid grid-cols-2 gap-4">
                <Stat
                  label="Fees paid"
                  value={`${Number(formatEther(stats.sponsored.fees)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${chain.nativeCurrency.symbol}`}
                  sub={usd(stats.sponsored.fees, price) ?? undefined}
                />
                <Stat
                  label="Transactions sponsored"
                  value={stats.sponsored.transactions}
                  sub={stats.sponsored.complete ? undefined : "fees counted for the latest 300"}
                />
              </div>
            </Card>
            <Card>
              <CardHeader
                eyebrow="QIE oracle"
                title={<span className="flex items-center gap-2"><LineChart className="h-4 w-4 text-brand" aria-hidden /> QIE price</span>}
                description="Read from QIE's on-chain QIE/USDT price feed on mainnet."
              />
              {price ? (
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="QIE / USDT" value={`$${price.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`} sub={price.stale ? "feed hasn't updated recently" : undefined} />
                  <Stat
                    label="Last update"
                    value={new Date(price.updatedAt * 1000).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                    sub={new Date(price.updatedAt * 1000).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">Price unavailable right now.</p>
              )}
              {!nativeHasPrice && <p className="mt-3 text-xs text-muted">This is a test network, so its coins have no dollar value; the price applies on mainnet.</p>}
            </Card>
          </div>

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-brand" aria-hidden /> Recent activity</span>}
              description="Wallet addresses only. Group names and member details never go on-chain."
            />
            {stats.recent.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ul className="-my-2 divide-y divide-line text-sm">
                {stats.recent.map((a) => (
                  <ActivityRow key={`${a.tx}-${a.index}`} a={a} tok={tok} name={a.who ? names[a.who.toLowerCase()] : null} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-brand" aria-hidden /> Contracts</span>}
              description={`${chain.name} · chain id ${chain.id}`}
            />
            <ul className="-my-2 divide-y divide-line text-sm">
              {[
                { name: "AjoPassbook", note: "co-signed receipts", address: addresses.passbook },
                { name: "AjoCircle", note: "savings circles", address: addresses.circle },
                { name: "AjoForwarder", note: "gas-free actions (ERC-2771)", address: addresses.forwarder },
                ...(addresses.stablecoin ? [{ name: token?.symbol ?? "Stablecoin", note: "circle currency", address: addresses.stablecoin }] : []),
              ].map((c) => {
                const href = explorerAddress(c.address);
                return (
                  <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <span className="font-medium">{c.name}</span> <span className="text-muted">· {c.note}</span>
                    </span>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline">
                        {shortAddr(c.address)} <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted">{c.address}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {updated && <p className="text-center text-xs text-muted">Updated {updated.toLocaleTimeString("en-NG")} · refreshes every 30 seconds</p>}
        </>
      )}
    </div>
  );
}

const DOT: Record<Activity["kind"], string> = {
  group: "bg-brand",
  join: "bg-brand",
  receipt: "bg-ok",
  payout: "bg-ok",
  circle: "bg-stamp",
  circleJoin: "bg-stamp",
  contribution: "bg-stamp",
  settled: "bg-ok",
  held: "bg-muted",
  prepaid: "bg-muted",
  miss: "bg-bad",
};

function ActivityRow({ a, tok, name }: { a: Activity; tok: (v: bigint) => string; name?: string | null }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <span className="flex min-w-0 gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.kind]}`} aria-hidden />
        <span className="min-w-0">
          <span className="block text-pretty">
            {a.text}
            {a.amount && <span className="font-medium tabular-nums"> · {a.amount.unit === "ngn" ? naira(a.amount.value) : tok(a.amount.value)}</span>}
          </span>
          <span className="block text-xs text-muted">
            {a.who && (name ? <span className="font-medium text-brand">{name}</span> : <span className="font-mono">{shortAddr(a.who)}</span>)}
            {a.time && ` · ${new Date(a.time * 1000).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`}
          </span>
        </span>
      </span>
      <TxLink hash={a.tx} explorer={explorerTx(a.tx)} />
    </li>
  );
}
