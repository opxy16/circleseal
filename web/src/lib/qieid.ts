"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";

/**
 * Client side of QIE ID: looks up .qie names for wallet addresses (batched, cached for the visit)
 * so screens can show "tolu.qie" instead of "0x9BCE…9be5".
 */
const known = new Map<string, string | null>();
const inflight = new Map<string, Promise<void>>();

async function fetchNames(addresses: string[]): Promise<void> {
  const missing = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => !known.has(a) && !inflight.has(a));
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const p = (async () => {
      try {
        const res = await fetch(`/api/qie-id?addresses=${batch.join(",")}`);
        if (!res.ok) return;
        const { names } = (await res.json()) as { names: Record<string, string | null> };
        for (const a of batch) known.set(a, names[a] ?? null);
      } catch {
        /* names are a nicety; addresses still show */
      } finally {
        batch.forEach((a) => inflight.delete(a));
      }
    })();
    batch.forEach((a) => inflight.set(a, p));
  }
  await Promise.all(addresses.map((a) => inflight.get(a.toLowerCase())).filter(Boolean));
}

/** Map of lower-cased address -> .qie name (or null) for the given addresses. */
export function useQieNames(addresses: (Address | string | undefined | null)[]): Record<string, string | null> {
  const list = addresses.filter((a): a is string => !!a);
  const key = [...new Set(list.map((a) => a.toLowerCase()))].sort().join(",");
  const [names, setNames] = useState<Record<string, string | null>>(() => snapshot(list));

  useEffect(() => {
    if (!key) return;
    const addrs = key.split(",");
    let alive = true;
    setNames(snapshot(addrs));
    fetchNames(addrs).then(() => alive && setNames(snapshot(addrs)));
    return () => {
      alive = false;
    };
  }, [key]);

  return names;
}

function snapshot(addresses: string[]): Record<string, string | null> {
  return Object.fromEntries(addresses.map((a) => [a.toLowerCase(), known.get(a.toLowerCase()) ?? null]));
}

/** Resolve a .qie name to an address through the app's API (null if it doesn't resolve). */
export async function resolveQieName(name: string): Promise<Address | null> {
  try {
    const res = await fetch(`/api/qie-id?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { address: Address | null }).address;
  } catch {
    return null;
  }
}

export const isQieName = (s: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)*\.qie$/i.test(s.trim());
