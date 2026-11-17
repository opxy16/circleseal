"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keccak256, toBytes, toHex, type Address, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { ArrowLeft, Link2, ReceiptText, RefreshCw, Send, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, Field, LoadingCard, Notice, Segmented, Stat, WhatsAppButton } from "@/components/ui";
import { WalletGate } from "@/components/wallet";
import { contributionTypes, inviteTypes, passbookDomain, payoutTypes, type Contribution, type Payout } from "@/lib/eip712";
import { appUrl, encodePayload, whatsappShare } from "@/lib/links";
import { groupName, memberLabel, naira, periodLabel, saveMemberLabel, shortAddr, toKobo } from "@/lib/local";
import { membersOf, readGroup, readMember, type GroupView, type MemberView } from "@/lib/reads";

export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = useMemo(() => {
    try {
      return BigInt(params.groupId);
    } catch {
      return null;
    }
  }, [params.groupId]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/collector" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All groups
      </Link>
      {groupId === null ? (
        <Notice tone="bad">That group link isn&apos;t valid.</Notice>
      ) : (
        <WalletGate>{(account) => <Group account={account} groupId={groupId} />}</WalletGate>
      )}
    </div>
  );
}

type Share = { title: string; url: string; message: string };

function Group({ account, groupId }: { account: PrivateKeyAccount; groupId: bigint }) {
  const [group, setGroup] = useState<GroupView | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const name = groupName(groupId) ?? `Group #${groupId}`;

  const load = useCallback(async () => {
    try {
      const g = await readGroup(groupId);
      setGroup(g);
      const addrs = await membersOf(groupId);
      setMembers((await Promise.all(addrs.map((a) => readMember(groupId, a)))).filter((m) => m.status === 2));
    } catch {
      setError("Couldn't load this group. It may not exist on this network.");
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!group) return <LoadingCard label="Loading group…" />;
  if (group.collector.toLowerCase() !== account.address.toLowerCase()) {
    return <Notice tone="bad">Only this group&apos;s collector can manage it. Members can see their records under “I&apos;m a member”.</Notice>;
  }

  const label = (m: MemberView) => memberLabel(groupId, m.memberCode) ?? shortAddr(m.address);
  const totalSaved = members.reduce((s, m) => s + m.totalContributed, 0n);

  return (
    <>
      <Card className="p-0">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-stamp">Collector view</p>
            <h1 className="mt-1 text-balance break-words text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted">
              {naira(group.contributionAmount)} {periodLabel(group.periodSeconds)} · group #{String(groupId)}
            </p>
          </div>
          {group.closed ? <Badge>Closed</Badge> : <Badge tone="brand">Active</Badge>}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
          <div className="p-4"><Stat label="Members" value={members.length} /></div>
          <div className="p-4"><Stat label="Receipts" value={members.reduce((s, m) => s + m.contributions, 0)} /></div>
          <div className="p-4"><Stat label="Recorded" value={naira(totalSaved)} /></div>
        </div>
      </Card>

      {share && (
        <Card className="flex flex-col gap-4 border-brand">
          <CardHeader
            eyebrow="Ready to send"
            title={share.title}
            description="Send it on WhatsApp or copy it. The link carries your signature, so nobody can tamper with it."
          />
          <p className="break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-muted">{share.url}</p>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton href={whatsappShare(`${share.message}\n${share.url}`)} label="Send on WhatsApp" />
            <CopyButton text={share.url} />
            <Button variant="ghost" onClick={() => setShare(null)}>
              Done
            </Button>
          </div>
        </Card>
      )}

      <Members members={members} label={label} group={group} />
      <InviteForm account={account} group={group} groupName={name} onShare={setShare} />
      {members.length > 0 && (
        <ReceiptForm account={account} group={group} groupName={name} members={members} label={label} onShare={setShare} />
      )}
      <Button variant="outline" onClick={load} className="self-start">
        <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
      </Button>
    </>
  );
}

function Members({ members, label, group }: { members: MemberView[]; label: (m: MemberView) => string; group: GroupView }) {
  return (
    <Card>
      <CardHeader title="Members" description={members.length ? `${members.length} active` : undefined} />
      {members.length === 0 ? (
        <EmptyState icon={<UserPlus className="h-5 w-5" aria-hidden />} title="No members yet">
          Create an invite link below and send it on WhatsApp.
        </EmptyState>
      ) : (
        <ul className="-my-2 divide-y divide-line">
          {members.map((m) => (
            <li key={m.address} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar seed={m.address} name={label(m)} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{label(m)}</p>
                  <p className="font-mono text-xs text-muted">{shortAddr(m.address)}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">{naira(m.totalContributed)}</p>
                <p className="text-xs text-muted">
                  {m.contributions} paid · last {group.periodSeconds === 86_400 ? "day" : "period"} {m.lastPeriod || "–"}
                  {m.payouts > 0 ? ` · ${m.payouts} payout${m.payouts > 1 ? "s" : ""}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function InviteForm({ account, group, groupName, onShare }: { account: PrivateKeyAccount; group: GroupView; groupName: string; onShare: (s: Share) => void }) {
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = who.trim();
    if (!label) return setError("Write who this invite is for (only you see this).");
    setBusy(true);
    setError(null);
    try {
      const memberCode = keccak256(toBytes(`${label}:${toHex(crypto.getRandomValues(new Uint8Array(16)))}`));
      const invite = { groupId: group.id, memberCode, expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400) };
      const sig = await account.signTypedData({ domain: passbookDomain(), types: inviteTypes, primaryType: "Invite", message: invite });
      saveMemberLabel(group.id, memberCode, label);
      const url = appUrl(`/join?d=${encodePayload({ ...invite, sig, name: groupName })}`);
      onShare({
        title: `Invite link for ${label}`,
        url,
        message: `Join our ajo "${groupName}" on AjoProof. Every payment you make gets a receipt we both sign. Tap to join (works once, expires in 7 days):`,
      });
      setWho("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-brand" aria-hidden /> Invite a member</span>}
        description="Each link works once and expires in 7 days."
      />
      <form className="flex flex-col gap-4" onSubmit={create}>
        <Field id="invite-label" label="Who is it for?" placeholder="e.g. Ada (shop 12)" value={who} onChange={(e) => setWho(e.target.value)} hint="A note for you only. It stays on this phone and never goes on-chain." />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" loading={busy}>
          {busy ? "Signing…" : "Create invite link"}
        </Button>
      </form>
    </Card>
  );
}

function ReceiptForm({
  account,
  group,
  groupName,
  members,
  label,
  onShare,
}: {
  account: PrivateKeyAccount;
  group: GroupView;
  groupName: string;
  members: MemberView[];
  label: (m: MemberView) => string;
  onShare: (s: Share) => void;
}) {
  const [kind, setKind] = useState<"contribution" | "payout">("contribution");
  const [memberAddr, setMemberAddr] = useState<Address>(members[0].address);
  const member = members.find((m) => m.address === memberAddr) ?? members[0];
  const [amount, setAmount] = useState(String(Number(group.contributionAmount) / 100));
  const [period, setPeriod] = useState(String(member.lastPeriod + 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriod(String(kind === "contribution" ? member.lastPeriod + 1 : member.payouts + 1));
    setAmount(
      String(kind === "contribution" ? Number(group.contributionAmount) / 100 : (Number(group.contributionAmount) * members.length) / 100),
    );
  }, [kind, member.lastPeriod, member.payouts, group.contributionAmount, members.length]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(Number(amount) > 0)) return setError("Enter the amount.");
    if (!(Number(period) >= 1)) return setError(kind === "contribution" ? "Enter which day/period this is for." : "Enter which cycle this is.");
    setBusy(true);
    setError(null);
    try {
      const ref = toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex;
      const paidAt = BigInt(Math.floor(Date.now() / 1000));
      const domain = passbookDomain();
      let payload: Record<string, unknown>;
      if (kind === "contribution") {
        const r: Contribution = { groupId: group.id, member: member.address, amount: toKobo(amount), period: Number(period), ref, paidAt };
        const cs = await account.signTypedData({ domain, types: contributionTypes, primaryType: "Contribution", message: r });
        payload = { t: "c", r, cs, name: groupName };
      } else {
        const r: Payout = { groupId: group.id, member: member.address, amount: toKobo(amount), cycle: Number(period), ref, paidAt };
        const cs = await account.signTypedData({ domain, types: payoutTypes, primaryType: "Payout", message: r });
        payload = { t: "p", r, cs, name: groupName };
      }
      const url = appUrl(`/confirm?d=${encodePayload(payload)}`);
      onShare({
        title: `Confirm link for ${label(member)}`,
        url,
        message:
          kind === "contribution"
            ? `I've recorded your ${naira(toKobo(amount))} ajo payment (${groupName}). Tap to confirm so we both have the receipt:`
            : `I've paid you ${naira(toKobo(amount))} from "${groupName}". Tap to confirm you received it:`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign the receipt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-brand" aria-hidden /> Record a payment</span>}
        description="You sign first. The receipt is recorded when the member confirms."
      />
      <form className="flex flex-col gap-4" onSubmit={create}>
        <Segmented
          label="What happened"
          options={[
            { label: "Member paid me", value: "contribution" as const },
            { label: "I paid a member", value: "payout" as const },
          ]}
          value={kind}
          onChange={setKind}
        />
        <label htmlFor="receipt-member" className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Member</span>
          <select
            id="receipt-member"
            className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base shadow-card focus:border-brand"
            value={memberAddr}
            onChange={(e) => setMemberAddr(e.target.value as Address)}
          >
            {members.map((m) => (
              <option key={m.address} value={m.address}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <Field id="receipt-amount" label="Amount" prefix="₦" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field
          id="receipt-period"
          label={kind === "contribution" ? (group.periodSeconds === 86_400 ? "For day number" : "For period number") : "Cycle number"}
          inputMode="numeric"
          value={period}
          onChange={(e) => setPeriod(e.target.value.replace(/\D/g, ""))}
        />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" loading={busy}>
          {!busy && <Send className="h-4 w-4" aria-hidden />}
          {busy ? "Signing…" : "Sign and get confirm link"}
        </Button>
        <p className="text-xs text-muted">
          Nothing is recorded until the member confirms. Their confirmation plus your signature makes the receipt.
        </p>
      </form>
    </Card>
  );
}
