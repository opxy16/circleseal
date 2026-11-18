"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { keccak256, toBytes, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { BadgeCheck, Coins, HandCoins, ShieldCheck, Users } from "lucide-react";
import { Seal } from "@/components/seal";
import { Badge, Button, Card, LoadingCard, Notice, PageHeader, TxLink } from "@/components/ui";
import { primaryLink } from "@/components/styles";
import { WalletGate } from "@/components/wallet";
import { AjoPassbookAbi } from "@/lib/abi/AjoPassbook";
import { gasless, type RelayResult } from "@/lib/actions";
import { publicClient } from "@/lib/chain";
import { addresses } from "@/lib/config";
import { decodePayload } from "@/lib/links";
import { naira, periodLabel, saveGroupName } from "@/lib/local";
import { readGroup, readMember, type GroupView } from "@/lib/reads";

type InvitePayload = { groupId: string; memberCode: Hex; expiresAt: string; sig: Hex; name: string };

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <Join />
    </Suspense>
  );
}

function Join() {
  const params = useSearchParams();
  const payload = decodePayload<InvitePayload>(params.get("d") ?? "");
  if (!payload?.groupId || !payload.sig) {
    return <Notice tone="bad">This invite link is broken. Ask your collector to send it again.</Notice>;
  }
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <PageHeader eyebrow="Invitation" title="You're invited to save with proof" description="Your collector wants every payment you make to come with a receipt you both sign." />
      <WalletGate purpose="Joining takes one tap after this. Your wallet signs your receipts.">
        {(account) => <JoinCard account={account} invite={payload} />}
      </WalletGate>
    </div>
  );
}

function JoinCard({ account, invite }: { account: PrivateKeyAccount; invite: InvitePayload }) {
  const groupId = BigInt(invite.groupId);
  const [group, setGroup] = useState<GroupView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nameVerified, setNameVerified] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RelayResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const g = await readGroup(groupId);
        setGroup(g);
        setNameVerified(keccak256(toBytes(invite.name)) === g.metaHash);
        if (g.closed) setProblem("This group is closed.");
        else if (BigInt(invite.expiresAt) < BigInt(Math.floor(Date.now() / 1000))) setProblem("This invite has expired. Ask your collector for a new link.");
        else {
          const used = await publicClient.readContract({
            address: addresses.passbook,
            abi: AjoPassbookAbi,
            functionName: "inviteUsed",
            args: [groupId, invite.memberCode],
          });
          if (used) setProblem("This invite link was already used. Ask your collector for a new one.");
        }
        const me = await readMember(groupId, account.address);
        setAlreadyIn(me.status === 2);
      } catch {
        setProblem("Couldn't find this group. Check you opened the right link.");
      }
    })();
  }, [groupId, invite.expiresAt, invite.memberCode, invite.name, account.address]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await gasless(account, "joinWithInvite", [
        { groupId, memberCode: invite.memberCode, expiresAt: BigInt(invite.expiresAt) },
        invite.sig,
      ]);
      saveGroupName(groupId, invite.name);
      setDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join.");
    } finally {
      setBusy(false);
    }
  };

  if (!group && !problem) return <LoadingCard label="Checking the invite…" />;

  return (
    <Card className="relative flex flex-col gap-5 overflow-hidden">
      {done && <Seal className="absolute -right-4 -top-4" size={110} play center="JOINED" text="MEMBER · RECORDED ON QIE · " />}
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-dashed border-brand/50 text-brand">
          <Users className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-stamp">Savings group</p>
          <h2 className="font-display truncate text-2xl">{invite.name}</h2>
          {group && (
            <p className="text-sm text-muted">
              {naira(group.contributionAmount)} {periodLabel(group.periodSeconds)}
            </p>
          )}
        </div>
        {group && nameVerified && !done && (
          <Badge tone="brand">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
          </Badge>
        )}
      </div>
      <div>
        {group && !nameVerified && (
          <Notice tone="bad">This name doesn&apos;t match the group on-chain. Check with your collector before joining.</Notice>
        )}
      </div>

      {done ? (
        <>
          <Notice tone="ok">
            You&apos;re in. From now on, each payment you make can get a receipt you both sign.
            <br />
            Recorded on QIE: <TxLink hash={done.hash} explorer={done.explorer} />
          </Notice>
          <Link href="/me" className={primaryLink}>
            See my passbook
          </Link>
        </>
      ) : alreadyIn ? (
        <Notice tone="ok">You&apos;re already a member of this group.</Notice>
      ) : problem ? (
        <Notice tone="bad">{problem}</Notice>
      ) : (
        <>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex gap-3"><HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> Keep paying your collector the usual way, in cash or by transfer.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> Confirm each payment with one tap. Nobody can fake or delete it.</li>
            <li className="flex gap-3"><Coins className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> It&apos;s free: CircleSeal pays the network fee.</li>
          </ul>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button onClick={join} loading={busy} size="lg">
            {busy ? "Joining on QIE…" : "Join this group"}
          </Button>
        </>
      )}
    </Card>
  );
}
