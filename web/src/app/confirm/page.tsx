"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { BadgeCheck, PenLine } from "lucide-react";
import { Button, Card, LoadingCard, Notice, PageHeader, TxLink } from "@/components/ui";
import { WalletGate } from "@/components/wallet";
import { AjoPassbookAbi } from "@/lib/abi/AjoPassbook";
import { relayContribution, relayPayout, type RelayResult } from "@/lib/actions";
import { publicClient } from "@/lib/chain";
import { addresses } from "@/lib/config";
import { contributionTypes, passbookDomain, payoutTypes, type Contribution, type Payout } from "@/lib/eip712";
import { decodePayload } from "@/lib/links";
import { naira, saveGroupName } from "@/lib/local";

type Raw = { groupId: string; member: Address; amount: string; period?: number; cycle?: number; ref: Hex; paidAt: string };
type ConfirmPayload = { t: "c" | "p"; r: Raw; cs: Hex; name: string };

export default function ConfirmPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const params = useSearchParams();
  const payload = decodePayload<ConfirmPayload>(params.get("d") ?? "");
  if (!payload?.r || !payload.cs || (payload.t !== "c" && payload.t !== "p")) {
    return <Notice tone="bad">This confirm link is broken. Ask your collector to send it again.</Notice>;
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <PageHeader
        eyebrow="Receipt"
        title={`Confirm ${payload.t === "c" ? "your payment" : "your payout"}`}
        description="Check the details. Once you confirm, the receipt is signed by both of you and can never be changed."
      />
      <WalletGate purpose="Unlock to confirm this receipt.">{(account) => <ConfirmCard account={account} p={payload} />}</WalletGate>
    </div>
  );
}

function ConfirmCard({ account, p }: { account: PrivateKeyAccount; p: ConfirmPayload }) {
  const isContribution = p.t === "c";
  const base = { groupId: BigInt(p.r.groupId), member: p.r.member, amount: BigInt(p.r.amount), ref: p.r.ref, paidAt: BigInt(p.r.paidAt) };
  const contribution: Contribution = { ...base, period: Number(p.r.period) };
  const payout: Payout = { ...base, cycle: Number(p.r.cycle) };

  const [recorded, setRecorded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RelayResult | null>(null);
  const forMe = p.r.member.toLowerCase() === account.address.toLowerCase();

  useEffect(() => {
    (async () => {
      try {
        const digest = isContribution
          ? await publicClient.readContract({ address: addresses.passbook, abi: AjoPassbookAbi, functionName: "contributionDigest", args: [contribution] })
          : await publicClient.readContract({ address: addresses.passbook, abi: AjoPassbookAbi, functionName: "payoutDigest", args: [payout] });
        setRecorded(
          await publicClient.readContract({ address: addresses.passbook, abi: AjoPassbookAbi, functionName: "isRecorded", args: [digest] }),
        );
      } catch {
        setRecorded(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const domain = passbookDomain();
      const result = isContribution
        ? await relayContribution(
            contribution,
            p.cs,
            await account.signTypedData({ domain, types: contributionTypes, primaryType: "Contribution", message: contribution }),
          )
        : await relayPayout(payout, p.cs, await account.signTypedData({ domain, types: payoutTypes, primaryType: "Payout", message: payout }));
      saveGroupName(base.groupId, p.name);
      setDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the receipt.");
    } finally {
      setBusy(false);
    }
  };

  const when = new Date(Number(base.paidAt) * 1000).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card className="flex flex-col gap-5">
      <div className="relative rounded-xl border border-line bg-surface-2 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted">{isContribution ? "Contribution receipt" : "Payout receipt"}</p>
          {(done || recorded) && (
            <span className="rotate-6 rounded border-2 border-stamp px-1.5 text-[10px] font-bold uppercase tracking-widest text-stamp">Co-signed</span>
          )}
        </div>
        <div className="my-4 border-y border-dashed border-line py-5 text-center">
          <p className="text-4xl font-semibold tabular-nums tracking-tight">{naira(base.amount)}</p>
          <p className="mt-1 text-sm text-muted">{p.name}</p>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">{isContribution ? "For period" : "Cycle"}</dt>
          <dd className="text-right font-medium">{isContribution ? contribution.period : payout.cycle}</dd>
          <dt className="text-muted">{isContribution ? "Paid to collector" : "Paid to you"}</dt>
          <dd className="text-right font-medium">{when}</dd>
          <dt className="flex items-center gap-1.5 text-muted"><PenLine className="h-3.5 w-3.5" aria-hidden /> Collector</dt>
          <dd className="flex justify-end"><BadgeCheck className="h-4 w-4 text-ok" aria-label="signed" /></dd>
          <dt className="flex items-center gap-1.5 text-muted"><PenLine className="h-3.5 w-3.5" aria-hidden /> You</dt>
          <dd className="text-right">{done || recorded ? <BadgeCheck className="ml-auto h-4 w-4 text-ok" aria-label="signed" /> : <span className="text-muted">waiting</span>}</dd>
        </dl>
      </div>

      {done ? (
        <>
          <Notice tone="ok">
            Confirmed. This receipt is now signed by both of you and recorded on QIE. It can&apos;t be changed.
            <br />
            <TxLink hash={done.hash} explorer={done.explorer} />
          </Notice>
          <Link href="/me" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-medium text-brand-ink shadow-card hover:bg-brand-strong">
            See my passbook
          </Link>
        </>
      ) : !forMe ? (
        <Notice tone="bad">This receipt is for a different member&apos;s wallet. Only that member can confirm it.</Notice>
      ) : recorded ? (
        <Notice tone="ok">This receipt is already confirmed and recorded.</Notice>
      ) : (
        <>
          <p className="text-sm text-muted">
            Only confirm if this is correct: you {isContribution ? "paid" : "received"} exactly {naira(base.amount)}.
          </p>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button onClick={confirm} loading={busy} disabled={recorded === null} size="lg">
            {busy ? "Recording on QIE…" : "Yes, this is correct: confirm"}
          </Button>
        </>
      )}
    </Card>
  );
}
