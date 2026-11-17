"use client";

import { Fuel, Gift, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { Button, Card, CopyButton, Notice } from "./ui";
import { balances, faucetAvailable, fmt, requestTestFunds, tokenInfo, type TokenInfo } from "@/lib/circle";
import { addresses, chain } from "@/lib/config";

/** The wallet's stablecoin and fee balances, with a test-funds button on test networks. */
export function Funds({ address, refreshKey = 0 }: { address: Address; refreshKey?: number }) {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [bal, setBal] = useState<{ gas: bigint; stable: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!addresses.stablecoin) return;
    try {
      const t = await tokenInfo(addresses.stablecoin);
      setToken(t);
      setBal(await balances(address, t.address));
    } catch {
      setError("Couldn't read your balances.");
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!addresses.stablecoin) return <Notice tone="stamp">Circle mode isn&apos;t set up on this network yet.</Notice>;

  const low = bal !== null && (bal.gas === 0n || bal.stable === 0n);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Circle wallet</p>
            <p className="truncate font-mono text-xs text-muted" title={address}>
              {address.slice(0, 10)}…{address.slice(-8)}
            </p>
          </div>
        </div>
        <CopyButton text={address} label="Copy" size="sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-xs text-muted">Savings balance</p>
          <p className="mt-0.5 break-words text-base font-semibold tabular-nums sm:text-lg">{bal && token ? fmt(bal.stable, token) : "…"}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Fuel className="h-3 w-3" aria-hidden /> Network fees
          </p>
          <p className="mt-0.5 break-words text-base font-semibold tabular-nums sm:text-lg">
            {bal ? `${Number(formatEther(bal.gas)).toLocaleString("en-NG", { maximumFractionDigits: 4 })} ${chain.nativeCurrency.symbol}` : "…"}
          </p>
        </div>
      </div>
      {low && faucetAvailable && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-stamp p-3">
          <p className="text-sm">
            <span className="font-medium">Test network.</span> Get free test {token?.symbol ?? "stablecoin"} and fee money to try a circle.
          </p>
          <Button
            variant="outline"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await requestTestFunds(address);
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't get test funds.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {!busy && <Gift className="h-4 w-4" aria-hidden />}
            {busy ? "Sending test funds…" : "Get test funds"}
          </Button>
        </div>
      )}
      {low && !faucetAvailable && (
        <Notice tone="stamp">
          Send {token?.symbol ?? "QUSDC"} and a little {chain.nativeCurrency.symbol} (for network fees) to this wallet&apos;s address to take part.
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
  );
}
