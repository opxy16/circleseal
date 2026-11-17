import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Coins,
  EyeOff,
  Fingerprint,
  HandCoins,
  Landmark,
  Link2,
  MessageCircle,
  PenLine,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { chain, isDeployed } from "@/lib/config";

export default function Home() {
  return (
    <div className="-mt-8 flex flex-col gap-20 sm:gap-24">
      <Hero />
      <Principles />
      <Modes />
      <HowItWorks />
      <Faq />
      <Cta />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pb-4 pt-12 sm:pt-16">
      <div className="hero-glow pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2" aria-hidden />
      <div className="grid-texture pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2" aria-hidden />
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
            Live on {chain.name}
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Your ajo, <span className="text-brand">verifiable.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted">
            Keep saving the way you already do. Every contribution becomes a receipt signed by both you and your
            collector, recorded on the blockchain so nobody can change it, deny it or run off with the story.
          </p>
          {!isDeployed && (
            <p className="rounded-lg border border-stamp-soft bg-stamp-soft px-3 py-2 text-sm">
              Contracts aren&apos;t deployed on this network yet. Run the deploy script, then reload.
            </p>
          )}
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/collector" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-medium text-brand-ink shadow-card transition-colors hover:bg-brand-strong">
              Start a group <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/me" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 font-medium shadow-card transition-colors hover:bg-surface-2">
              Open my passbook
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" aria-hidden /> No app to install</li>
            <li className="flex items-center gap-2"><Coins className="h-4 w-4 text-brand" aria-hidden /> No crypto needed</li>
            <li className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-brand" aria-hidden /> No names on-chain</li>
          </ul>
          <Link href="/stats" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            See live on-chain activity <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ReceiptPreview />
      </div>
    </section>
  );
}

/** Illustration of a co-signed receipt, as a member sees it. */
function ReceiptPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="absolute -inset-4 rotate-2 rounded-3xl border border-line bg-surface-2" />
      <div className="relative rounded-2xl border border-line bg-surface p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted">Contribution receipt</p>
            <p className="mt-0.5 font-semibold">Hostel B Daily Thrift</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            <BadgeCheck className="h-3.5 w-3.5" /> Recorded
          </span>
        </div>
        <div className="my-6 border-y border-dashed border-line py-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted">Amount paid</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">₦2,000</p>
          <p className="mt-1 text-sm text-muted">Day 14 · 17 Nov 2026</p>
        </div>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted"><PenLine className="h-4 w-4" /> Collector signed</span>
            <BadgeCheck className="h-4 w-4 text-ok" />
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted"><PenLine className="h-4 w-4" /> Member signed</span>
            <BadgeCheck className="h-4 w-4 text-ok" />
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted"><Link2 className="h-4 w-4" /> On-chain proof</span>
            <span className="font-mono text-xs text-brand">0x5e1d…af25</span>
          </li>
        </ul>
        <div className="absolute -right-3 -top-3 rotate-12 rounded-md border-2 border-stamp px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-stamp">
          Co-signed
        </div>
      </div>
    </div>
  );
}

function Principles() {
  const items = [
    { icon: ShieldCheck, title: "Two signatures, one truth", body: "A payment only counts when both the collector and the member sign the same receipt." },
    { icon: Landmark, title: "Never holds your naira", body: "Cash and transfers stay between you and your collector. AjoProof only records them." },
    { icon: Fingerprint, title: "Private by design", body: "Group names are stored as a fingerprint and members as codes. No names or phone numbers go on-chain." },
    { icon: MessageCircle, title: "Works over WhatsApp", body: "Invites and receipts are links. Tap, confirm with your PIN, done. Network fees are paid for you." },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted">{body}</p>
        </div>
      ))}
    </section>
  );
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-pretty text-muted">{body}</p>}
    </div>
  );
}

function Modes() {
  return (
    <section>
      <SectionTitle eyebrow="Two ways to save" title="Keep your ajo. Add proof." body="Start with receipts for the group you already have, or run a circle where the rules are enforced by code." />
      <div className="grid gap-4 lg:grid-cols-2">
        <ModeCard
          icon={BookOpen}
          badge="Passbook mode"
          title="Co-signed receipts for cash and transfer ajo"
          points={[
            "Collector creates a group and shares invite links",
            "Each payment becomes a receipt both sides sign",
            "Members build a savings record they can show a lender",
            "Members need no crypto, and fees are paid for them",
          ]}
          href="/collector"
          cta="Start a group"
        />
        <ModeCard
          icon={RefreshCcw}
          badge="Circle mode"
          title="A rotating savings circle in a dollar stablecoin"
          points={[
            "Everyone posts a bond, and the pot rotates each round",
            "Nobody can take the pot and walk away: their remaining rounds are prepaid from it",
            "Anyone can settle a round when it ends, and nobody can block it",
            "Skipped payments come from the skipper's own bond, and honest members end even",
          ]}
          href="/circles"
          cta="Start a circle"
          accent
        />
      </div>
    </section>
  );
}

function ModeCard({
  icon: Icon,
  badge,
  title,
  points,
  href,
  cta,
  accent,
}: {
  icon: typeof BookOpen;
  badge: string;
  title: string;
  points: string[];
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent ? "bg-stamp-soft text-stamp" : "bg-brand-soft text-brand"}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-sm font-medium text-muted">{badge}</span>
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <ul className="flex flex-col gap-3 text-sm">
        {points.map((p) => (
          <li key={p} className="flex gap-3">
            <BadgeCheck className={`mt-0.5 h-4 w-4 shrink-0 ${accent ? "text-stamp" : "text-brand"}`} aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Link2, title: "Invite", body: "The collector sends each member a one-time invite link on WhatsApp. Members tap it, set a PIN, and they're in." },
    { icon: HandCoins, title: "Pay and record", body: "Pay the way you always do. The collector records it and sends you a confirm link." },
    { icon: BadgeCheck, title: "Confirm", body: "You check the amount and tap Confirm. The receipt, signed by both of you, goes on-chain for good." },
  ];
  return (
    <section>
      <SectionTitle eyebrow="How it works" title="Three taps, no crypto" />
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-brand-ink">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-mono text-sm text-muted">0{i + 1}</span>
            </div>
            <h3 className="font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Faq() {
  const items = [
    { q: "Do members need crypto or a crypto app?", a: "No. A wallet is created inside the browser, locked with a 6-digit PIN, and AjoProof pays the network fees for passbook actions." },
    { q: "Does AjoProof hold our money?", a: "Not in passbook mode: your naira never touches AjoProof. In circle mode, the stablecoin pot is held by the open-source circle contract, never by us, and only its fixed rules can move it." },
    { q: "What exactly goes on the blockchain?", a: "Amounts, dates, an opaque member code and both signatures. Group names are stored only as a fingerprint, and no names or phone numbers are ever published." },
    { q: "Can a collector fake or edit a receipt?", a: "No. A receipt needs the member's signature too, each payment reference can be used once, and recorded receipts can't be changed or deleted." },
    { q: "What if I lose my phone?", a: "Your wallet lives on your phone. Your receipts stay on-chain, and your collector can invite your new wallet to keep going." },
  ];
  return (
    <section className="mx-auto w-full max-w-3xl">
      <SectionTitle eyebrow="Questions" title="Good to know" />
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
        {items.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {q}
              <span className="text-xl leading-none text-muted transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand px-6 py-12 text-center text-brand-ink sm:px-12">
      <h2 className="mx-auto max-w-xl text-balance text-3xl font-semibold tracking-tight">No more &ldquo;I paid&rdquo;, &ldquo;you didn&apos;t&rdquo;.</h2>
      <p className="mx-auto mt-3 max-w-lg opacity-90">Set up your group in a minute and send the first invite link today.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/collector" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-surface px-5 font-medium text-ink shadow-card">
          Start a group <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/circles" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-brand-ink px-5 font-medium">
          Try a savings circle
        </Link>
      </div>
    </section>
  );
}
