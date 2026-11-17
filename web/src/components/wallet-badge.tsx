"use client";

import { Lock, Wallet } from "lucide-react";
import { useWallet } from "./wallet";

export function WalletBadge() {
  const { account, lock } = useWallet();
  if (!account) return null;
  return (
    <button
      type="button"
      onClick={lock}
      title="Lock wallet"
      className="group inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs shadow-card transition-colors hover:bg-surface-2"
    >
      <Wallet className="h-3.5 w-3.5 text-brand" aria-hidden />
      <span className="font-mono">
        {account.address.slice(0, 6)}…{account.address.slice(-4)}
      </span>
      <Lock className="h-3.5 w-3.5 text-muted group-hover:text-ink" aria-hidden />
      <span className="sr-only">Lock wallet</span>
    </button>
  );
}
