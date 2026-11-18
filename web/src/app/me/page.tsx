"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PrivateKeyAccount } from "viem/accounts";
import { BookOpen, FileCheck2 } from "lucide-react";
import { Card, CopyButton, EmptyState, LoadingCard, Notice, PageHeader, WhatsAppButton } from "@/components/ui";
import { primaryLink } from "@/components/styles";
import { NumberTicker } from "@/components/fx";
import { Guilloche, SealMark } from "@/components/seal";
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
      {/* Passbook cover */}
      <section aria-label="Savings summary" className="relative overflow-hidden rounded-2xl bg-brand text-brand-ink shadow-lift">
        <Guilloche size={360} rings={3} lines={9} k={13} className="pointer-events-none absolute -right-28 -top-28 h-[22rem] w-[22rem] opacity-25" turn />
        <div aria-hidden className="absolute inset-y-0 left-0 w-3 bg-black/15" />
        <div className="relative p-6 pl-8 sm:p-8 sm:pl-10">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-sm tracking-[0.08em] opacity-90">Savings passbook</p>
            <SealMark className="h-8 w-8 opacity-90" />
          </div>
          <p className="mt-8 text-sm opacity-90">Total saved</p>
          <p className="font-display mt-1 text-5xl tabular-nums sm:text-6xl">
            <NumberTicker value={Number(totalPaid) / 100} format={(n) => naira(Math.round(n) * 100)} />
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t pt-5 text-sm" style={{ borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }}>
            <div><dt className="opacity-90">Received</dt><dd className="mt-0.5 font-bold tabular-nums">{naira(totalReceived)}</dd></div>
            <div><dt className="opacity-90">Receipts</dt><dd className="mt-0.5 font-bold tabular-nums">{record.contributions}</dd></div>
            <div><dt className="opacity-90">Groups</dt><dd className="mt-0.5 font-bold tabular-nums">{record.groupsJoined}</dd></div>
          </dl>
          {record.firstActivityAt > 0n && (
            <p className="mt-5 text-xs opacity-85">
              Saving since {new Date(Number(record.firstActivityAt) * 1000).toLocaleDateString("en-NG", { dateStyle: "medium" })}. Every
              number here is read directly from the QIE blockchain.
            </p>
          )}
        </div>
      </section>

      {record.contributions > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-stamp/50 text-stamp">
              <FileCheck2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-wide text-lg font-bold tracking-tight">Share your savings proof</h2>
              <p className="mt-1 text-sm text-muted">
                A page you can show a lender, cooperative or landlord: how long you&apos;ve saved, how consistently, and how much,
                checked live on the blockchain. It shows no names or phone numbers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/proof/${account.address}`}
              className={`${primaryLink} min-h-11 px-4 text-sm`}
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

      <h2 className="-mb-2 font-wide text-lg font-bold">Your groups</h2>

      {rows.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-5 w-5" aria-hidden />} title="No groups yet">
          Ask your collector for an invite link. Once you join, your receipts show up here.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {rows.map(({ group, me }) => (
            <li key={String(group.id)} className="border-b border-line px-5 py-4 last:border-b-0 sm:px-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{groupName(group.id) ?? `Group #${group.id}`}</p>
                    <p className="text-sm text-muted">
                      {naira(group.contributionAmount)} {periodLabel(group.periodSeconds)}
                      {me.status === 3 ? " · you left" : group.closed ? " · closed" : ""}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold">
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
                    <p className="font-wide font-bold tabular-nums">{naira(me.totalContributed)}</p>
                    <p className="text-xs text-muted">
                      {me.contributions} payment{me.contributions === 1 ? "" : "s"}
                      {me.payouts ? ` · ${me.payouts} payout` : ""}
                    </p>
                  </div>
                </div>
              </div>
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
