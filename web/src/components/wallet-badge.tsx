"use client";

import { Lock, Wallet } from "lucide-react";
import { useQieNames } from "@/lib/qieid";
import { useWallet } from "./wallet";

export function WalletBadge() {
  const { account, lock } = useWallet();
  const names = useQieNames(account ? [account.address] : []);
  if (!account) return null;
  const qie = names[account.address.toLowerCase()];
  return (
    <button
      type="button"
      onClick={lock}
      title="Lock wallet"
      className="group inline-flex min-h-9 items-center gap-2 rounded-md border border-ink/15 bg-surface px-2.5 text-xs shadow-card transition-colors hover:border-ink/40"
    >
      <Wallet className="h-3.5 w-3.5 text-brand" aria-hidden />
      {qie ? (
        <span className="font-semibold">{qie}</span>
      ) : (
        <span className="font-mono">
          {account.address.slice(0, 6)}…{account.address.slice(-4)}
        </span>
      )}
      <Lock className="h-3.5 w-3.5 text-muted group-hover:text-ink" aria-hidden />
      <span className="sr-only">Lock wallet</span>
    </button>
  );
}
