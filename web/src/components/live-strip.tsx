"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NumberTicker } from "./fx";
import { chain, isDeployed } from "@/lib/config";
import { loadStats, type Stats } from "@/lib/stats";

/** Real, live counters read from CircleSeal's contracts (no made-up numbers), laid out like a passbook ledger line. */
export function LiveStrip() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    if (!isDeployed) return;
    loadStats().then(setS).catch(() => setS(null));
  }, []);

  const items = [
    { label: "Receipts co-signed", value: s?.passbook.receipts ?? 0 },
    { label: "Savings recorded", value: Number(s?.passbook.recorded ?? 0n) / 100, money: true },
    { label: "Wallets", value: s?.wallets ?? 0 },
    { label: "Fees paid for members", value: s?.sponsored.transactions ?? 0, suffix: " txs" },
  ];

  return (
    <section aria-labelledby="ledger-title" className="overflow-hidden rounded-2xl border border-ink/15 bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-double border-ink/20 px-5 py-3">
        <h2 id="ledger-title" className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="live-dot relative h-2 w-2 rounded-full bg-ok text-ok" aria-hidden />
          The ledger, live from {chain.name}
        </h2>
        <Link href="/stats" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
          See every transaction
        </Link>
      </div>
      <dl className="ruled grid grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.label} className={`flex flex-col-reverse gap-1 px-5 py-5 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""} border-ink/10`}>
            <dt className="text-xs font-medium text-muted">{it.label}</dt>
            <dd className="font-display text-2xl tabular-nums sm:text-[2rem]">
              {s ? (
                <NumberTicker value={it.value} format={(n) => (it.money ? "₦" : "") + Math.round(n).toLocaleString("en-US") + (it.suffix ?? "")} />
              ) : isDeployed ? (
                <span className="inline-block h-8 w-20 animate-pulse rounded bg-surface-2" aria-label="Loading" />
              ) : (
                <span className="text-muted">0</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
