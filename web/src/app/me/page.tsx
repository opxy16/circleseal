"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PrivateKeyAccount } from "viem/accounts";
import { BookOpen, FileCheck2 } from "lucide-react";
import { Card, CopyButton, EmptyState, LoadingCard, Notice, PageHeader, WhatsAppButton } from "@/components/ui";
import { BorderBeam, NumberTicker } from "@/components/fx";
import { appUrl, whatsappShare } from "@/lib/links";
import { WalletGate } from "@/components/wallet";
import { currentPeriod, groupName, naira, periodLabel, periodUnit } from "@/lib/local";
import { groupsJoinedBy, readGroup, readMember, thriftRecord, type GroupView, type MemberView } from "@/lib/reads";

export default function MePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Passbook mode · Member" title="My passbook" description="Every payment you made and every payout you got, signed by you and your collector." />
      <WalletGate purpose="Unlock to see your passbook.">{(account) => <Passbook account={account} />}</WalletGate>
    </div>
  );
}

type Row = { group: GroupView; me: MemberView };

function Passbook({ account }: { account: PrivateKeyAccount }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof thriftRecord>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ids = await groupsJoinedBy(account.address);
        const r = await Promise.all(ids.map(async (id) => ({ group: await readGroup(id), me: await readMember(id, account.address) })));
        setRows(r);
        setRecord(await thriftRecord(account.address));
      } catch {
        setError("Couldn't reach the network. Check your connection and reload.");
      }
    })();
  }, [account.address]);

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!rows || !record) return <LoadingCard label="Reading your records from QIE…" />;

  const totalPaid = rows.reduce((s, r) => s + r.me.totalContributed, 0n);
  const totalReceived = rows.reduce((s, r) => s + r.me.totalReceived, 0n);

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-brand p-6 text-brand-ink shadow-lift">
        <BorderBeam duration={7} />
        <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 opacity-15" aria-hidden>
          <circle cx="80" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="14" />
          <circle cx="120" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="14" />
        </svg>
        <p className="text-sm opacity-80">Total saved</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
          <NumberTicker value={Number(totalPaid) / 100} format={(n) => naira(Math.round(n) * 100)} />
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
          <div><p className="opacity-75">Received</p><p className="mt-0.5 font-semibold tabular-nums">{naira(totalReceived)}</p></div>
          <div><p className="opacity-75">Receipts</p><p className="mt-0.5 font-semibold tabular-nums">{record.contributions}</p></div>
          <div><p className="opacity-75">Groups</p><p className="mt-0.5 font-semibold tabular-nums">{record.groupsJoined}</p></div>
        </div>
        {record.firstActivityAt > 0n && (
          <p className="mt-5 border-t pt-4 text-xs opacity-80" style={{ borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }}>
            Saving since {new Date(Number(record.firstActivityAt) * 1000).toLocaleDateString("en-NG", { dateStyle: "medium" })}. Every number
            here is read directly from the QIE blockchain.
          </p>
        )}
      </section>

      {record.contributions > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-stamp-soft text-stamp">
              <FileCheck2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold tracking-tight">Share your savings proof</h2>
              <p className="mt-1 text-sm text-muted">
                A page you can show a lender, cooperative or landlord: how long you&apos;ve saved, how consistently, and how much,
                checked live on the blockchain. It shows no names or phone numbers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/proof/${account.address}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink shadow-card hover:bg-brand-strong"
            >
              Open my proof page
            </Link>
            <WhatsAppButton
              href={whatsappShare(`My savings record on CircleSeal, verified on the QIE blockchain:
${appUrl(`/proof/${account.address}`)}`)}
              label="Share"
            />
            <CopyButton text={appUrl(`/proof/${account.address}`)} />
          </div>
        </Card>
      )}

      <h2 className="-mb-3 text-sm font-semibold text-muted">Your groups</h2>

      {rows.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" aria-hidden />} title="No groups yet">
          Ask your collector for an invite link. Once you join, your receipts show up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ group, me }) => (
            <li key={String(group.id)}>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{groupName(group.id) ?? `Group #${group.id}`}</p>
                    <p className="text-sm text-muted">
                      {naira(group.contributionAmount)} {periodLabel(group.periodSeconds)}
                      {me.status === 3 ? " · you left" : group.closed ? " · closed" : ""}
                    </p>
                    <p className="text-xs">
                      {me.status === 2 && !group.closed && (() => {
                        const now = currentPeriod(group.createdAt, group.periodSeconds);
                        const unit = periodUnit(group.periodSeconds);
                        const due = now - me.lastPeriod;
                        return due <= 0 ? (
                          <span className="text-ok">Up to date</span>
                        ) : (
                          <span className="text-stamp">
                            Next due: {unit} {me.lastPeriod + 1}
                            {due > 1 ? ` (${due} ${unit}s to catch up)` : ""}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium tabular-nums">{naira(me.totalContributed)}</p>
                    <p className="text-xs text-muted">
                      {me.contributions} payment{me.contributions === 1 ? "" : "s"}
                      {me.payouts ? ` · ${me.payouts} payout` : ""}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        Collecting for a group yourself? <Link href="/collector" className="text-brand underline">Go to your collector view</Link>.
      </p>
    </>
  );
}
