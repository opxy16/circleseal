"use client";

import { BadgeCheck, BookOpen, CalendarDays, ExternalLink, Printer, RefreshCcw, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { Badge, Button, Card, CardHeader, CopyButton, LoadingCard, Notice, Stat } from "@/components/ui";
import { fmt, tokenInfo, type TokenInfo } from "@/lib/circle";
import { addresses, chain, explorerAddress } from "@/lib/config";
import { appUrl } from "@/lib/links";
import { groupName, naira, periodLabel, shortAddr } from "@/lib/local";
import { loadProof, savingFor, type Proof } from "@/lib/proof";

const date = (unix: number) => (unix ? new Date(unix * 1000).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "–");

export default function ProofPage() {
  const params = useParams<{ address: string }>();
  const raw = params.address ?? "";
  if (!isAddress(raw)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Notice tone="bad">This savings proof link isn&apos;t valid. Ask the member to share it again.</Notice>
      </div>
    );
  }
  return <ProofView address={getAddress(raw)} />;
}

function ProofView({ address }: { address: Address }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const url = appUrl(`/proof/${address}`);

  useEffect(() => {
    (async () => {
      try {
        const [p, t] = await Promise.all([loadProof(address), addresses.stablecoin ? tokenInfo(addresses.stablecoin) : Promise.resolve(null)]);
        setProof(p);
        setToken(t);
        setCheckedAt(new Date());
      } catch {
        setError("Couldn't read this record from the blockchain right now. Try again in a moment.");
      }
    })();
  }, [address]);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  if (error) return <div className="mx-auto max-w-2xl"><Notice tone="bad">{error}</Notice></div>;
  if (!proof) return <div className="mx-auto max-w-2xl"><LoadingCard label="Reading this savings record from QIE…" /></div>;

  const { record, totals, groups, circles } = proof;
  const first = Number(record.firstActivityAt);
  const last = Number(record.lastActivityAt);
  const duration = savingFor(first, last);
  const consistency = totals.periodsSpanned ? Math.round((totals.periodsPaid / totals.periodsSpanned) * 100) : null;
  const empty = record.contributions === 0 && record.groupsJoined === 0 && circles.length === 0;
  const explorer = explorerAddress(address);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 print:max-w-none print:gap-4">
      {/* Certificate header */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8 print:shadow-none">
        <div className="hero-glow pointer-events-none absolute inset-0 print:hidden" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">AjoProof savings record</p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight">
              {empty || !duration ? "No savings recorded yet" : `Saving for ${duration}`}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Wallet <span className="font-mono">{shortAddr(address)}</span>
              {first > 0 && ` · since ${date(first)}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="brand">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Read live from {chain.name}
              </Badge>
              {totals.payments > 0 && (
                <Badge tone="stamp">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Every receipt co-signed
                </Badge>
              )}
            </div>
          </div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code linking to this savings record" width={120} height={120} className="h-[120px] w-[120px] shrink-0 rounded-lg border border-line bg-white p-1" />
          )}
        </div>

        {!empty && (
          <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6 sm:grid-cols-4">
            <Stat label="Total saved" value={naira(totals.saved)} />
            <Stat label="Payments made" value={totals.payments} />
            <Stat label="Payouts received" value={naira(totals.received)} sub={`${record.payouts} payout${record.payouts === 1 ? "" : "s"}`} />
            <Stat label="Consistency" value={consistency === null ? "–" : `${consistency}%`} sub={totals.periodsSpanned ? `${totals.periodsPaid} of ${totals.periodsSpanned} periods paid` : undefined} />
          </div>
        )}
      </section>

      {empty && (
        <Notice>This wallet hasn&apos;t recorded any AjoProof savings on {chain.name} yet.</Notice>
      )}

      {/* Groups */}
      {groups.length > 0 && (
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-brand" aria-hidden /> Ajo groups</span>}
            description="Each payment below was confirmed by both this member and their collector."
          />
          <ul className="-my-2 divide-y divide-line">
            {groups.map((g) => (
              <li key={String(g.group.id)} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {groupName(g.group.id) ?? `Group #${g.group.id}`}{" "}
                    {g.me.status === 3 ? <Badge>Left</Badge> : g.group.closed ? <Badge>Closed</Badge> : <Badge tone="brand">Active</Badge>}
                  </p>
                  <p className="text-muted">
                    {naira(g.group.contributionAmount)} {periodLabel(g.group.periodSeconds)}
                    {g.span > 0 &&
                      ` · paid ${g.periodsPaid} of ${g.span} period${g.span === 1 ? "" : "s"} (${g.firstPeriod === g.lastPeriod ? `period ${g.firstPeriod}` : `periods ${g.firstPeriod}–${g.lastPeriod}`})`}
                  </p>
                  {g.lastPaidAt > 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <CalendarDays className="h-3 w-3" aria-hidden /> {date(g.firstPaidAt)} to {date(g.lastPaidAt)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{naira(g.me.totalContributed)}</p>
                  {g.me.payouts > 0 && <p className="text-xs text-muted">received {naira(g.me.totalReceived)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Circles */}
      {circles.length > 0 && (
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-stamp" aria-hidden /> Savings circles</span>}
            description="Rotating savings enforced by the circle contract: missed rounds are recorded automatically."
          />
          <ul className="-my-2 divide-y divide-line">
            {circles.map(({ circle, me }) => (
              <li key={String(circle.id)} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    Circle #{String(circle.id)} <Badge tone={circle.status === "Completed" ? "brand" : "neutral"}>{circle.status}</Badge>
                  </p>
                  <p className="text-muted">
                    {token ? fmt(circle.contributionAmount, token) : "…"} per round · {circle.memberCount} members ·{" "}
                    {me.missed === 0 ? "no missed rounds" : `${me.missed} missed round${me.missed === 1 ? "" : "s"}`}
                  </p>
                </div>
                {me.received > 0n && token && <p className="font-semibold tabular-nums">received {fmt(me.received, token)}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* How to verify */}
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" aria-hidden /> How to check this record</span>}
        />
        <ul className="flex flex-col gap-3 text-sm">
          <li>
            Every figure on this page was read directly from the AjoProof contract on {chain.name}
            {checkedAt && ` at ${checkedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`}. AjoProof can&apos;t
            edit it, and neither can the member.
          </li>
          <li>A payment only counts when both the member and the collector signed the same receipt, so nobody can add payments on their own.</li>
          <li>
            Check it yourself on the public explorer:{" "}
            {explorer ? (
              <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-brand hover:underline">
                {shortAddr(address)} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : (
              <span className="font-mono">{address}</span>
            )}{" "}
            · contract <span className="font-mono">{shortAddr(addresses.passbook)}</span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          This is a record of savings activity, not a credit score or a guarantee. Names and phone numbers are never published, so
          confirm you&apos;re speaking with the wallet&apos;s owner.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 print:hidden">
        <CopyButton text={url} label="Copy link" />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print or save as PDF
        </Button>
      </div>
    </div>
  );
}
