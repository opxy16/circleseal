"use client";

import { ArrowDownUp, Fuel, Gift, Wallet } from "lucide-react";
import type { PrivateKeyAccount } from "viem/accounts";
import { qiedexAvailable, quoteQusdcToQie, swapQusdcForQie, type DexQuote } from "@/lib/qiedex";
import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther, parseUnits, type Address } from "viem";
import { Button, Card, CopyButton, Notice } from "./ui";
import { balances, faucetAvailable, fmt, requestTestFunds, tokenInfo, type TokenInfo } from "@/lib/circle";
import { addresses, chain } from "@/lib/config";
import { usd, useQiePrice } from "@/lib/price";

/** The wallet's stablecoin and fee balances, with a test-funds button on test networks. */
export function Funds({ address, account, refreshKey = 0 }: { address: Address; account?: PrivateKeyAccount; refreshKey?: number }) {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [bal, setBal] = useState<{ gas: bigint; stable: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const price = useQiePrice();

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
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-dashed border-brand/50 text-brand">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-wide font-bold tracking-tight">Circle wallet</p>
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
          {bal && usd(bal.gas, price) && <p className="text-xs text-muted">{usd(bal.gas, price)} (QIE oracle)</p>}
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
      {!faucetAvailable && bal && bal.stable === 0n && (
        <Notice tone="stamp">Send {token?.symbol ?? "QUSDC"} to this wallet&apos;s address to take part. You can then swap a little of it for fee money here.</Notice>
      )}
      {qiedexAvailable && bal && account && bal.stable >= parseUnits("1", 6) && bal.gas < parseEther("0.05") && (
        <FeeTopUp account={account} gas={bal.gas} onDone={load} />
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </Card>
  );
}

/** Mainnet: get fee money by swapping 1 QUSDC for QIE on QIEDEX (with a one-off starter if the wallet has none). */
function FeeTopUp({ account, gas, onDone }: { account: PrivateKeyAccount; gas: bigint; onDone: () => Promise<void> }) {
  const [quote, setQuote] = useState<DexQuote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const needsStarter = gas < parseEther("0.002");

  useEffect(() => {
    quoteQusdcToQie(1).then(setQuote).catch((e) => setError(e instanceof Error ? e.message : "No quote."));
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-stamp p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ArrowDownUp className="h-4 w-4 text-stamp" aria-hidden /> Fee money from QIEDEX
      </p>
      <p className="text-sm text-muted">
        Swap 1 QUSDC for {quote ? `about ${Number(quote.amountOutDecimal).toLocaleString("en-US", { maximumFractionDigits: 2 })} QIE` : "QIE"} on
        QIEDEX, QIE&apos;s own exchange. That covers thousands of circle payments.
      </p>
      {needsStarter ? (
        <Button variant="outline" loading={busy === "starter"} onClick={() => run("starter", () => requestTestFunds(account.address))}>
          {busy !== "starter" && <Gift className="h-4 w-4" aria-hidden />} Get starter fee money first
        </Button>
      ) : (
        <Button
          variant="outline"
          loading={busy === "swap"}
          disabled={!quote}
          onClick={() =>
            run("swap", async () => {
              const fresh = await quoteQusdcToQie(1);
              const r = await swapQusdcForQie(account, fresh);
              setDone(r.hash);
            })
          }
        >
          {busy !== "swap" && <ArrowDownUp className="h-4 w-4" aria-hidden />} Swap 1 QUSDC for QIE
        </Button>
      )}
      {quote && quote.priceImpactPct > 3 && <Notice tone="stamp">Price impact is {quote.priceImpactPct.toFixed(1)}% right now.</Notice>}
      {done && <Notice tone="ok">Swapped on QIEDEX. Your fee balance is topped up.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
