"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { chain } from "./config";

export type QiePrice = { price: number; updatedAt: number; stale: boolean; feed: string };

let memo: Promise<QiePrice | null> | null = null;

/** QIE/USDT from QIE's on-chain oracle (via /api/qie-price), fetched once per visit. */
export function useQiePrice(): QiePrice | null {
  const [p, setP] = useState<QiePrice | null>(null);
  useEffect(() => {
    memo ??= fetch("/api/qie-price")
      .then((r) => (r.ok ? (r.json() as Promise<QiePrice>) : null))
      .catch(() => null)
      .then((v) => {
        if (!v) memo = null; // don't remember a failure: try again next time
        return v;
      });
    memo.then(setP);
  }, []);
  return p;
}

/** True only where the native coin is real QIE with a market price (mainnet). */
export const nativeHasPrice = chain.id === 1990;

/** "≈ $0.02" for an amount of the native coin, or null when no real price applies. */
export function usd(wei: bigint, price: QiePrice | null): string | null {
  if (!price || !nativeHasPrice) return null;
  const v = Number(formatEther(wei)) * price.price;
  return `≈ $${v < 0.01 && v > 0 ? v.toFixed(4) : v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
