"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PrivateKeyAccount } from "viem/accounts";
import { createWallet, forgetWallet, isValidPin, storedWalletAddress, unlockWallet } from "@/lib/wallet";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button, Card, Field, LoadingCard, Notice } from "./ui";

type WalletState = {
  ready: boolean;
  hasWallet: boolean;
  account: PrivateKeyAccount | null;
  create: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  reset: () => void;
};

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [account, setAccount] = useState<PrivateKeyAccount | null>(null);

  useEffect(() => {
    setHasWallet(Boolean(storedWalletAddress()));
    setReady(true);
  }, []);

  const create = useCallback(async (pin: string) => {
    setAccount(await createWallet(pin));
    setHasWallet(true);
  }, []);
  const unlock = useCallback(async (pin: string) => setAccount(await unlockWallet(pin)), []);
  const lock = useCallback(() => setAccount(null), []);
  const reset = useCallback(() => {
    forgetWallet();
    setAccount(null);
    setHasWallet(false);
  }, []);

  return <Ctx.Provider value={{ ready, hasWallet, account, create, unlock, lock, reset }}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside WalletProvider");
  return v;
}

/** Renders children only once the in-app wallet is created and unlocked. */
export function WalletGate({ children, purpose }: { children: (account: PrivateKeyAccount) => ReactNode; purpose?: string }) {
  const { ready, hasWallet, account, create, unlock, reset } = useWallet();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return <LoadingCard label="Loading…" />;
  if (account) return <>{children(account)}</>;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!hasWallet) {
    return (
      <Card className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-brand/50 text-brand">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
          <h2 className="font-wide text-lg font-bold tracking-tight">Set up your CircleSeal wallet</h2>
          <p className="mt-1 text-sm text-muted">
            {purpose ?? "It takes a few seconds."} It lives in this browser, so there&apos;s no app to install.
          </p>
          </div>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidPin(pin)) return setError("Choose a 6-digit PIN.");
            if (pin !== pin2) return setError("The two PINs don't match.");
            run(() => create(pin));
          }}
        >
          <Field id="pin" label="Choose a 6-digit PIN" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <Field id="pin2" label="Enter it again" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
          <Notice tone="stamp">
            Your wallet lives only on this phone, locked with your PIN. If you clear this browser&apos;s data, the wallet
            is gone, so keep using the same phone and browser.
          </Notice>
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" loading={busy} size="lg">
            {busy ? "Creating…" : "Create my wallet"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-brand/50 text-brand">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-wide text-lg font-bold tracking-tight">Unlock your wallet</h2>
          <p className="mt-1 text-sm text-muted">{purpose ?? "Enter your 6-digit PIN to continue."}</p>
        </div>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => unlock(pin));
        }}
      >
        <Field id="unlock-pin" label="PIN" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" size="lg" loading={busy} disabled={pin.length !== 6}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            // Two-step reset to avoid accidents: the box below must be ticked first.
            const sure = (document.getElementById("reset-confirm") as HTMLInputElement | null)?.checked;
            if (!sure) return setError("Tick the box below first if you really want to remove this wallet.");
            reset();
          }}
        >
          Forgot PIN? Remove this wallet
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input id="reset-confirm" type="checkbox" /> I understand removing it loses this wallet&apos;s history on this
          device
        </label>
      </form>
    </Card>
  );
}
