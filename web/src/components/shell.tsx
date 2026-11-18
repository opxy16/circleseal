"use client";

import { BookOpen, ClipboardList, Home, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SealMark } from "./seal";
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
    <Link href="/" className="group flex items-center gap-2.5" aria-label="CircleSeal home">
      <SealMark className="h-9 w-9 transition-transform duration-500 group-hover:rotate-[24deg]" />
      <span className="font-display text-[17px] tracking-tight">CircleSeal</span>
    </Link>
  );
}

export function Header({ network }: { network: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-bg/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {[...NAV.slice(1), { href: "/stats", label: "Live stats" }].map((n) => {
              const active = isActive(path, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[3px] after:rounded-full after:transition-transform after:duration-300 ${
                    active ? "text-ink after:scale-x-100 after:bg-stamp" : "text-muted after:scale-x-0 after:bg-ink/30 hover:text-ink hover:after:scale-x-100"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-md border border-ink/15 px-2.5 py-1 text-xs font-medium text-muted sm:inline-flex">
            <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-ok text-ok" aria-hidden />
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] transition-colors ${active ? "font-bold text-ink" : "font-medium text-muted"}`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-300 ${active ? "bg-brand-soft text-brand" : ""}`}
                >
                  <Icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
                </span>
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
    <footer className="border-t-[3px] border-double border-ink/20 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-[1fr_auto] sm:items-end sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm text-pretty">Co-signed savings receipts and savings circles enforced by code, on the QIE blockchain.</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <li>
            <Link href="/stats" className="font-semibold text-brand underline-offset-4 hover:underline">
              Live on-chain stats
            </Link>
          </li>
          <li>Network: {network}</li>
          <li>Never holds your cash</li>
          <li>No personal data on-chain</li>
        </ul>
      </div>
    </footer>
  );
}
