import { ArrowRight, Check, EyeOff, Fingerprint, MessageCircle, QrCode, Smartphone, Wallet, X } from "lucide-react";
import Link from "next/link";
import { Marquee } from "@/components/fx";
import { HeroReceipt } from "@/components/hero-receipt";
import { LiveStrip } from "@/components/live-strip";
import { Guilloche, Seal, Signature } from "@/components/seal";
import { outlineLink, primaryLink } from "@/components/styles";
import { isDeployed } from "@/lib/config";

export default function Home() {
  return (
    <div className="-mt-8 flex flex-col gap-24 sm:gap-32">
      <Hero />
      <Names />
      <LiveStrip />
      <NotebookVsPassbook />
      <TwoModes />
      <HowItWorks />
      <AlsoIncluded />
      <BuiltOnQie />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative grid items-center gap-14 pt-12 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
      <div className="flex flex-col items-start gap-7">
        <p className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-surface px-2.5 py-1 text-sm font-medium text-muted">
          <span className="h-2 w-2 rotate-45 bg-stamp" aria-hidden />
          For every ajo, susu, tontine, chama and tanda
        </p>
        <h1 className="font-display text-balance text-[2.9rem] leading-[0.95] sm:text-7xl lg:text-[5.4rem]">
          Your savings circle, sealed on-chain.
        </h1>
        <p className="max-w-[54ch] text-pretty text-lg leading-relaxed text-muted">
          Keep saving the way your group already does. Each payment becomes a receipt signed by you <em>and</em> your
          collector, then sealed on the QIE blockchain, so nobody can fake it, change it or deny it.
        </p>
        {!isDeployed && (
          <p className="rounded-xl border border-stamp/30 bg-stamp-soft px-4 py-3 text-sm">
            CircleSeal&apos;s contracts are being deployed to QIE right now. Check back shortly to try it live.
          </p>
        )}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/collector" className={`${primaryLink} px-6`}>
            Start a group <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/me" className={`${outlineLink} px-6`}>
            Open my passbook
          </Link>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" aria-hidden /> No app to install</li>
          <li className="flex items-center gap-2"><Wallet className="h-4 w-4 text-brand" aria-hidden /> No crypto, no fees</li>
          <li className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-brand" aria-hidden /> No names on-chain</li>
        </ul>
      </div>
      <HeroReceipt />
    </section>
  );
}

/* ------------------------------------------------------------------ names band */

const NAMES = [
  ["Ajo", "Nigeria"],
  ["Susu", "Ghana"],
  ["Tontine", "Cameroon"],
  ["Chama", "Kenya"],
  ["Tanda", "Mexico"],
  ["Stokvel", "South Africa"],
  ["Arisan", "Indonesia"],
  ["Paluwagan", "Philippines"],
  ["Hui", "China"],
  ["Kye", "Korea"],
  ["Committee", "Pakistan"],
  ["Sol", "Haiti"],
  ["Partner", "Jamaica"],
];

function Names() {
  return (
    <section aria-labelledby="names-title" className="-my-8 flex flex-col gap-5">
      <h2 id="names-title" className="max-w-[46ch] text-pretty text-sm text-muted">
        One habit, many names. Hundreds of millions of people save together this way. CircleSeal works for all of them.
      </h2>
      <div className="relative left-1/2 w-screen -translate-x-1/2 border-y border-ink/15 bg-surface/70 py-5">
        <Marquee>
          {NAMES.map(([name, place], i) => (
            <span key={name} className="flex items-baseline gap-2.5 pr-6">
              <span className={`font-display text-4xl sm:text-5xl ${i % 2 ? "text-outline" : ""}`}>{name}</span>
              <span className="text-xs font-medium text-muted">{place}</span>
              <span className="ml-4 h-2 w-2 rotate-45 self-center bg-stamp" aria-hidden />
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ notebook vs passbook */

function SectionTitle({ id, title, body }: { id: string; title: React.ReactNode; body?: React.ReactNode }) {
  return (
    <div className="mb-10 max-w-3xl">
      <h2 id={id} className="font-display text-balance text-[2rem] leading-[1.02] sm:text-5xl">
        {title}
      </h2>
      {body && <p className="mt-4 max-w-[60ch] text-pretty text-lg leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

function NotebookVsPassbook() {
  const rows = [
    ["“I paid.” “You didn’t.” One word against another", "Every payment signed by both sides"],
    ["A notebook only the collector can see", "A public record anyone can check, with no names on it"],
    ["Collector disappears, and your history goes too", "Your passbook lives on QIE, not in anyone’s bag"],
    ["Early recipient stops paying, everyone after loses", "Payout holdback prepays early recipients’ rounds"],
    ["Years of saving, nothing a lender will accept", "A savings proof page you can share in one tap"],
  ];
  return (
    <section aria-labelledby="why-title">
      <SectionTitle id="why-title" title="Savings groups run on trust. Now they can run on proof." />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative rounded-2xl border border-ink/10 bg-surface-2/60 p-6 sm:p-8">
          <h3 className="font-wide text-lg font-bold">The notebook</h3>
          <p className="text-sm text-muted">How most groups keep records today</p>
          <ul className="ruled mt-6 flex flex-col">
            {rows.map(([before]) => (
              <li key={before} className="flex min-h-10 items-center gap-3 text-[15px] text-muted">
                <X className="h-4 w-4 shrink-0 text-bad" aria-hidden />
                <span className="line-through decoration-bad/50 decoration-[1.5px]">{before}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-ink/15 bg-surface p-6 shadow-lift sm:p-8">
          <Seal className="absolute -right-6 -top-6 opacity-90" size={120} angle={14} center="PROOF" />
          <h3 className="font-wide text-lg font-bold">The CircleSeal passbook</h3>
          <p className="text-sm text-muted">Same group, same habits, now with receipts</p>
          <ul className="ruled mt-6 flex flex-col">
            {rows.map(([, after]) => (
              <li key={after} className="flex min-h-10 items-center gap-3 text-[15px]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {after}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ two modes */

function TwoModes() {
  return (
    <section aria-labelledby="modes-title">
      <SectionTitle
        id="modes-title"
        title="Two ways to save."
        body="Add receipts to the group you already run, or start a dollar savings circle where the rules are enforced by code."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Passbook mode */}
        <article className="flex flex-col rounded-2xl border border-ink/15 bg-surface p-6 shadow-card sm:p-8">
          <p className="text-sm font-semibold text-brand">Passbook mode</p>
          <h3 className="mt-1 font-wide text-2xl font-bold leading-tight">Two signatures, one truth.</h3>
          <p className="mt-2 max-w-[52ch] text-pretty text-muted">
            For cash and bank-transfer groups. The collector records a payment, the member confirms it, and QIE keeps it
            forever. Members never pay a network fee.
          </p>
          <ol className="mt-8 grid gap-3 sm:grid-cols-3 lg:my-auto lg:py-6">
            {[
              { who: "Collector", what: "records and signs", seed: 0 },
              { who: "Member", what: "taps Confirm", seed: 1 },
            ].map((s) => (
              <li key={s.who} className="rounded-xl border border-ink/10 bg-bg/60 p-4">
                <Signature seed={s.seed} className="h-7 w-24 text-ink" />
                <p className="mt-2 border-t border-ink/30 pt-2 text-sm font-semibold">{s.who}</p>
                <p className="text-xs text-muted">{s.what}</p>
              </li>
            ))}
            <li className="relative grid place-items-center rounded-xl border border-dashed border-stamp/50 bg-stamp-soft/50 p-4">
              <Seal size={76} angle={-8} center="QIE" />
              <p className="mt-1 text-xs font-semibold text-stamp">Sealed on-chain</p>
            </li>
          </ol>
          <div className="mt-8 flex items-end justify-between gap-4 border-t border-ink/10 pt-6 lg:mt-auto">
            <div>
              <p className="font-display text-5xl text-brand">₦0</p>
              <p className="text-sm text-muted">what members pay in network fees</p>
            </div>
            <Link href="/collector" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 hover:underline">
              Start a group <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </article>

        {/* Circle mode: an inverted, ink-coloured panel */}
        <article className="relative flex flex-col overflow-hidden rounded-2xl bg-ink p-6 text-bg shadow-lift sm:p-8">
          <Guilloche size={300} rings={2} lines={9} k={10} className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 text-bg opacity-15" />
          <p className="text-sm font-semibold text-stamp-soft">Circle mode</p>
          <h3 className="mt-1 font-wide text-2xl font-bold leading-tight">A rotation nobody can run off with.</h3>
          <p className="mt-2 max-w-[52ch] text-pretty opacity-80">
            Everyone posts a bond and pays each round in a dollar stablecoin. The pot goes to a different member each time.
            Anyone can settle a round, so nobody can stall it.
          </p>
          <div className="relative mt-6 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
            <RotationRing />
            <div>
              <p className="text-sm font-semibold">The payout holdback</p>
              <p className="mt-1 text-sm opacity-80">
                Paid early? Part of your pot prepays your remaining rounds. Skip anyway, and it comes out of your own bond,
                never the group&apos;s money.
              </p>
            </div>
          </div>
          <ol className="relative mt-6 grid grid-cols-4 gap-1.5 text-center text-[11px] leading-snug">
            {[
              { r: "Round 1", t: "Ada gets 20, 20 held back", c: "bg-stamp text-surface" },
              { r: "Round 2", t: "Prepaid from holdback", c: "bg-bg/15" },
              { r: "Round 3", t: "Prepaid from holdback", c: "bg-bg/15" },
              { r: "Round 4", t: "Ada pays, or her bond does", c: "border border-bg/30" },
            ].map((x) => (
              <li key={x.r} className={`rounded-lg p-2.5 ${x.c}`}>
                <p className="font-bold">{x.r}</p>
                <p className="mt-0.5 opacity-85">{x.t}</p>
              </li>
            ))}
          </ol>
          <Link href="/circles" className="relative mt-6 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-bg underline-offset-4 hover:underline">
            Try a savings circle <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </article>
      </div>
    </section>
  );
}

/** Five members around a ring; the pot (the stamp-coloured dot) is with member two this round. */
function RotationRing() {
  const members = ["A", "T", "C", "N", "K"];
  return (
    <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44" role="img" aria-label="Five members in a circle. This round, the pot goes to the second member.">
      <circle cx="90" cy="90" r="62" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 5" />
      <path d="M90 28 A62 62 0 0 1 149 71" fill="none" stroke="var(--stamp)" strokeWidth="3" strokeLinecap="round" />
      {members.map((m, i) => {
        const a = (i / members.length) * Math.PI * 2 - Math.PI / 2;
        const x = 90 + 62 * Math.cos(a);
        const y = 90 + 62 * Math.sin(a);
        const now = i === 1;
        return (
          <g key={m}>
            <circle cx={x} cy={y} r={now ? 17 : 14} fill={now ? "var(--stamp)" : "var(--ink)"} stroke="currentColor" strokeOpacity={now ? 0 : 0.5} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">
              {m}
            </text>
          </g>
        );
      })}
      <text x="90" y="86" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">Round 2 of 5</text>
      <text x="90" y="102" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">Pot to T</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps = [
    { title: "Invite", body: "The collector sends a one-time invite link on WhatsApp. Members tap it, choose a PIN, and they're in." },
    { title: "Pay and record", body: "Members pay the way they always do. The collector records the payment and sends a confirm link." },
    { title: "Confirm", body: "The member taps Confirm. The receipt, signed by both of them, is sealed on QIE for good." },
  ];
  return (
    <section aria-labelledby="how-title">
      <SectionTitle id="how-title" title="Three taps. No crypto." />
      <ol className="grid gap-px overflow-hidden rounded-2xl border border-ink/15 bg-ink/15 md:grid-cols-3">
        {steps.map(({ title, body }, i) => (
          <li key={title} className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
            <span className="font-display text-6xl leading-none text-stamp" aria-hidden>
              {i + 1}
            </span>
            <h3 className="font-wide text-xl font-bold">{title}</h3>
            <p className="text-pretty text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ also included */

function AlsoIncluded() {
  const items = [
    { icon: QrCode, title: "Savings proof for lenders", body: "Share how long, how steadily and how much you've saved, checked live on-chain, as a link, QR code or PDF." },
    { icon: Fingerprint, title: "Private by design", body: "Group names are stored as fingerprints and members as codes. No names or phone numbers, ever." },
    { icon: MessageCircle, title: "Lives on WhatsApp", body: "Invites, receipts and payment reminders are links. Tap, enter your PIN, done." },
  ];
  return (
    <section aria-label="Also included" className="grid gap-10 border-y-[3px] border-double border-ink/20 py-12 md:grid-cols-3">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-4">
          <Icon className="mt-1 h-6 w-6 shrink-0 text-stamp" aria-hidden />
          <div>
            <h3 className="font-wide font-bold">{title}</h3>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ built on QIE */

function BuiltOnQie() {
  const items = [
    { name: "QIE blockchain", body: "Fast, low-cost finality, so CircleSeal can pay every member's fees." },
    { name: "QIE ID", body: "Members show up as names like tolu.qie, and proof links work by name." },
    { name: "QIE Oracle", body: "The live QIE/USDT price turns fees and balances into dollars." },
    { name: "QIEDEX", body: "Swap the circle stablecoin for QIE in the app, so circle wallets can pay their own fees." },
  ];
  return (
    <section aria-labelledby="qie-title">
      <SectionTitle id="qie-title" title="Built on QIE, end to end." />
      <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ name, body }) => (
          <div key={name} className="border-t-2 border-ink pt-4">
            <dt className="font-wide font-bold">{name}</dt>
            <dd className="mt-1.5 text-pretty text-sm leading-relaxed text-muted">{body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

function Faq() {
  const items = [
    { q: "Do members need crypto or a crypto app?", a: "No. A wallet is created in the browser and locked with a 6-digit PIN, and CircleSeal pays the network fees for passbook actions." },
    { q: "Does CircleSeal hold our money?", a: "Not in passbook mode: your cash never touches CircleSeal. In circle mode, the stablecoin pot is held by the open-source circle contract, never by us, and only its fixed rules can move it." },
    { q: "What exactly goes on the blockchain?", a: "Amounts, dates, an anonymous member code and both signatures. Group names are stored only as a fingerprint, and no names or phone numbers are ever published." },
    { q: "Can a collector fake or edit a receipt?", a: "No. A receipt needs the member's signature too, each payment reference can be used once, and recorded receipts can't be changed or deleted." },
    { q: "What stops someone taking the circle pot and leaving?", a: "The payout holdback. When you're paid early, part of the pot prepays your remaining rounds; anything you still skip comes out of your own bond." },
  ];
  return (
    <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <h2 id="faq-title" className="font-display text-[2rem] leading-[1.02] sm:text-5xl">
        Good to know.
      </h2>
      <div className="border-t-2 border-ink">
        {items.map(({ q, a }) => (
          <details key={q} className="group border-b border-ink/15">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/20 text-lg leading-none transition-transform duration-300 group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="max-w-[62ch] pb-5 text-pretty leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ final CTA */

function FinalCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand px-6 py-14 text-brand-ink sm:px-12 sm:py-16">
      <Guilloche size={400} rings={3} lines={9} k={12} className="pointer-events-none absolute -right-24 -top-24 h-[30rem] w-[30rem] opacity-25" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-display max-w-[16ch] text-balance text-4xl leading-[1] sm:text-6xl">No more &ldquo;I paid&rdquo;, &ldquo;you didn&apos;t&rdquo;.</h2>
          <p className="mt-4 max-w-[46ch] text-lg opacity-90">Set up your group in a minute and send the first invite link today.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/collector"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-bg px-6 font-semibold text-ink transition-transform hover:-translate-y-px active:translate-y-px"
            >
              Start a group <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/stats" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-brand-ink/40 px-6 font-semibold transition-colors hover:bg-black/10">
              See live stats
            </Link>
          </div>
        </div>
        <div className="hidden rounded-full bg-bg p-2 md:block">
          <Seal size={180} angle={-10} center="SEALED" />
        </div>
      </div>
    </section>
  );
}
