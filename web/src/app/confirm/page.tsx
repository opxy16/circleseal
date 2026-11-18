"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { Receipt } from "@/components/seal";
import { Button, LoadingCard, Notice, PageHeader, TxLink } from "@/components/ui";
import { primaryLink } from "@/components/styles";
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
    <div className="flex flex-col gap-6">
      <Receipt
        play={Boolean(done)}
        title={isContribution ? "CONTRIBUTION RECEIPT" : "PAYOUT RECEIPT"}
        number={`Group #${p.r.groupId}`}
        amount={naira(base.amount)}
        subtitle={p.name}
        lines={[
          { label: isContribution ? "For period" : "Cycle", value: isContribution ? contribution.period : payout.cycle },
          { label: isContribution ? "Paid to collector" : "Paid to you", value: when },
        ]}
        memberSigned={Boolean(done || recorded)}
        memberLabel="You"
        sealed={Boolean(done || recorded)}
        footer={done || recorded ? <span>Recorded on QIE · can&apos;t be changed or deleted</span> : undefined}
      />

      {done ? (
        <>
          <Notice tone="ok">
            Confirmed. This receipt is now signed by both of you and recorded on QIE. It can&apos;t be changed.
            <br />
            <TxLink hash={done.hash} explorer={done.explorer} />
          </Notice>
          <Link href="/me" className={primaryLink}>
            See my passbook
          </Link>
        </>
      ) : !forMe ? (
        <Notice tone="bad">This receipt is for a different member&apos;s wallet. Only that member can confirm it.</Notice>
      ) : recorded ? (
        <Notice tone="ok">This receipt is already confirmed and recorded.</Notice>
      ) : (
        <>
          <p className="text-pretty text-sm text-muted">
            Only confirm if this is correct: you {isContribution ? "paid" : "received"} exactly {naira(base.amount)}.
          </p>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button onClick={confirm} loading={busy} disabled={recorded === null} size="lg">
            {busy ? "Recording on QIE…" : "Yes, this is correct: confirm"}
          </Button>
        </>
      )}
    </div>
  );
}
