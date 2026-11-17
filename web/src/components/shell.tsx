"use client";

import { BookOpen, ClipboardList, Home, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletBadge } from "./wallet-badge";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/me", label: "Passbook", icon: BookOpen },
  { href: "/circles", label: "Circles", icon: RefreshCcw },
  { href: "/collector", label: "Collect", icon: ClipboardList },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="CircleSeal home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <circle cx="13" cy="16" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-brand-ink" opacity="0.55" />
        <circle cx="19" cy="16" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-brand-ink" />
        <path d="m16.2 16.2 1.9 1.9 3.6-3.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-ink" />
      </svg>
      <span className="text-[17px]">CircleSeal</span>
    </Link>
  );
}

export function Header({ network }: { network: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg print:hidden">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {[...NAV.slice(1), { href: "/stats", label: "Stats" }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(path, n.href) ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${isActive(path, n.href) ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
            {network}
          </span>
          <WalletBadge />
        </div>
      </div>
    </header>
  );
}

/** Phone bottom tab bar (hidden on desktop, where the header nav shows). */
export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-medium text-brand" : "text-muted"}`}
              >
                <Icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer({ network }: { network: string }) {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Logo />
          <p className="text-xs">Co-signed savings receipts and code-enforced savings circles on QIE.</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Link href="/stats" className="text-brand hover:underline">
            Live on-chain stats
          </Link>
          <span>Network: {network}</span>
          <span>No naira held</span>
          <span>No personal data on-chain</span>
        </div>
      </div>
    </footer>
  );
}
