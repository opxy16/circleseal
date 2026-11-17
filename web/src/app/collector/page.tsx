"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { keccak256, toBytes, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { ChevronRight, ClipboardList, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, LoadingCard, Notice, PageHeader, Segmented } from "@/components/ui";
import { WalletGate } from "@/components/wallet";
import { gasless } from "@/lib/actions";
import { groupIdFromTx, groupsCollectedBy, readGroup, type GroupView } from "@/lib/reads";
import { groupName, naira, periodLabel, saveGroupName, toKobo } from "@/lib/local";

const NGN = "0x4e474e" as Hex; // "NGN" as bytes3
const PERIODS = [
  { label: "Daily", seconds: 86_400 },
  { label: "Weekly", seconds: 604_800 },
  { label: "Monthly", seconds: 2_592_000 },
];

export default function CollectorPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="Passbook mode · Collector"
        title="Your ajo groups"
        description="Create a group, invite members with a link, and turn every payment into a receipt you both sign."
      />
      <WalletGate purpose="Your wallet signs your groups' receipts.">{(account) => <Collector account={account} />}</WalletGate>
    </div>
  );
}

function Collector({ account }: { account: PrivateKeyAccount }) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("2000");
  const [period, setPeriod] = useState(86_400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ids = await groupsCollectedBy(account.address);
      setGroups(await Promise.all(ids.map(readGroup)));
    } catch {
      setLoadError("Couldn't reach the network. Check your connection and reload.");
    }
  }, [account.address]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) return setError("Give the group a name (at least 3 characters).");
    if (!(Number(amount) > 0)) return setError("Enter how much each member pays.");
    setBusy(true);
    setError(null);
    try {
      const { hash } = await gasless(account, "createGroup", [keccak256(toBytes(trimmed)), NGN, toKobo(amount), period]);
      const id = await groupIdFromTx(hash);
      if (id === null) throw new Error("Group was created but its number couldn't be read. Reload the page.");
      saveGroupName(id, trimmed);
      router.push(`/collector/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the group.");
      setBusy(false);
    }
  };

  return (
    <>
      <section className="flex flex-col gap-3">
        {loadError && <Notice tone="bad">{loadError}</Notice>}
        {groups === null && !loadError && <LoadingCard label="Loading your groups…" />}
        {groups && groups.length === 0 && (
          <EmptyState icon={<Users className="h-5 w-5" aria-hidden />} title="No groups yet">
            Create your first group below. It takes under a minute, and you pay no network fees.
          </EmptyState>
        )}
        {groups && groups.length > 0 && (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={String(g.id)}>
                <Link href={`/collector/${g.id}`} className="group block">
                  <Card className="flex items-center gap-4 transition-colors group-hover:border-brand">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <ClipboardList className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{groupName(g.id) ?? `Group #${g.id}`}</p>
                      <p className="text-sm text-muted">
                        {naira(g.contributionAmount)} {periodLabel(g.periodSeconds)}
                      </p>
                    </div>
                    {g.closed ? <Badge>Closed</Badge> : <Badge tone="brand">Active</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader title="Create a group" description="Members join with an invite link. No app, no crypto, no fees for them." />
        <form className="flex flex-col gap-4" onSubmit={create}>
          <Field id="group-name" label="Group name" placeholder="e.g. Yaba Market Daily Ajo" value={name} onChange={(e) => setName(e.target.value)} hint="Only a fingerprint (hash) of the name goes on-chain." />
          <Field id="group-amount" label="Each contribution" prefix="₦" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Segmented label="How often" options={PERIODS.map((p) => ({ label: p.label, value: p.seconds }))} value={period} onChange={setPeriod} />
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" size="lg" loading={busy}>
            {busy ? "Creating on QIE…" : "Create group"}
          </Button>
        </form>
      </Card>
    </>
  );
}
