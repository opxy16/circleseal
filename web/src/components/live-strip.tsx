"use client";

import { useEffect, useState } from "react";
import { NumberTicker } from "./fx";
import { chain, isDeployed } from "@/lib/config";
import { loadStats, type Stats } from "@/lib/stats";

/** Real, live counters read from CircleSeal's contracts (no made-up numbers). */
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
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-xs text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        Live from CircleSeal&apos;s contracts on {chain.name}
      </div>
      <div className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
        {items.map((it) => (
          <div key={it.label} className="px-5 py-5">
            <p className="text-xs text-muted">{it.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {s ? (
                <NumberTicker
                  value={it.value}
                  format={(n) => (it.money ? "₦" : "") + Math.round(n).toLocaleString("en-NG") + (it.suffix ?? "")}
                />
              ) : (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-surface-2" />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
