import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Coins,
  EyeOff,
  Fingerprint,
  Fuel,
  HandCoins,
  LineChart,
  Link2,
  MessageCircle,
  NotebookPen,
  PenLine,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { AnimatedList, Aurora, BorderBeam, GradientText, Marquee, PhoneFrame, Reveal } from "@/components/fx";
import { LiveStrip } from "@/components/live-strip";
import { isDeployed } from "@/lib/config";

export default function Home() {
  return (
    <div className="-mt-8 flex flex-col gap-24 sm:gap-32">
      <Hero />
      <TrustMarquee />
      <Reveal>
        <LiveStrip />
      </Reveal>
      <BeforeAfter />
      <Bento />
      <HowItWorks />
      <BuiltOnQie />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative pb-6 pt-14 sm:pt-20">
      <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2">
        <Aurora />
        <div className="dot-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" aria-hidden />
      </div>
      <div className="relative grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col items-start gap-7">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted shadow-card">
              <Sparkles className="h-3.5 w-3.5 text-stamp" aria-hidden />
              Built on QIE · QIE ID · QIE Oracle · QIEDEX
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Your ajo, <GradientText>verifiable.</GradientText>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="max-w-xl text-pretty text-lg text-muted sm:text-xl">
              Keep saving the way you already do. Every contribution becomes a receipt signed by you <em>and</em> your
              collector, recorded on QIE so nobody can fake it, change it or deny it.
            </p>
          </Reveal>
          {!isDeployed && (
            <p className="rounded-lg border border-stamp-soft bg-stamp-soft px-3 py-2 text-sm">
              Contracts aren&apos;t deployed on this network yet. Run the deploy script, then reload.
            </p>
          )}
          <Reveal delay={240} className="w-full sm:w-auto">
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href="/collector"
                className="shimmer inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 font-medium text-brand-ink shadow-lift transition-transform hover:-translate-y-0.5 hover:bg-brand-strong"
              >
                Start a group <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/me"
                className="glass inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-6 font-medium shadow-card transition-transform hover:-translate-y-0.5"
              >
                Open my passbook
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand" aria-hidden /> No app to install</li>
              <li className="flex items-center gap-2"><Coins className="h-4 w-4 text-brand" aria-hidden /> No crypto, no fees</li>
              <li className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-brand" aria-hidden /> No names on-chain</li>
            </ul>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <HeroPhone />
        </Reveal>
      </div>
    </section>
  );
}

const FEED = [
  { who: "Tolu", what: "confirmed ₦2,000 · day 14", icon: BadgeCheck, tone: "text-ok" },
  { who: "Hostel B Thrift", what: "new member joined from WhatsApp", icon: Link2, tone: "text-brand" },
  { who: "Ada", what: "received payout ₦60,000", icon: HandCoins, tone: "text-stamp" },
  { who: "Circle #4", what: "round 3 settled · 40 QUSDC paid out", icon: RefreshCcw, tone: "text-brand" },
  { who: "Chidi", what: "missed round covered from his own bond", icon: ShieldCheck, tone: "text-bad" },
  { who: "Ngozi", what: "shared her savings proof with a lender", icon: QrCode, tone: "text-stamp" },
];

/** Illustration of the app on a phone, with a live-looking activity feed. */
function HeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-label="Illustration of the AjoProof app">
      <PhoneFrame className="float-slow">
        <div className="flex h-full flex-col gap-3 px-4 pb-4 pt-12">
          <div className="relative overflow-hidden rounded-2xl bg-brand p-4 text-brand-ink">
            <p className="text-[11px] opacity-80">Total saved</p>
            <p className="text-3xl font-semibold tracking-tight">₦48,000</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <div><p className="opacity-70">Receipts</p><p className="font-semibold">24</p></div>
              <div><p className="opacity-70">On time</p><p className="font-semibold">100%</p></div>
              <div><p className="opacity-70">Groups</p><p className="font-semibold">2</p></div>
            </div>
            <svg viewBox="0 0 200 200" className="absolute -right-8 -top-8 h-28 w-28 opacity-20" aria-hidden>
              <circle cx="80" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="14" />
              <circle cx="120" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="14" />
            </svg>
          </div>
          <p className="px-1 text-[11px] font-medium text-muted">Live activity</p>
          <AnimatedList
            items={FEED.map((f) => (
              <div key={f.who + f.what} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5 shadow-card">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2">
                  <f.icon className={`h-4 w-4 ${f.tone}`} aria-hidden />
                </span>
                <span className="min-w-0 text-[11px] leading-tight">
                  <span className="block font-semibold">{f.who}</span>
                  <span className="block truncate text-muted">{f.what}</span>
                </span>
              </div>
            ))}
          />
        </div>
      </PhoneFrame>

      {/* Floating co-signed receipt */}
      <div className="glass absolute -left-6 bottom-16 hidden w-56 rounded-2xl border border-line p-4 shadow-lift sm:block">
        <BorderBeam duration={5} />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted">Receipt</p>
          <span className="rotate-6 rounded border-2 border-stamp px-1 text-[9px] font-bold uppercase tracking-widest text-stamp">Co-signed</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">₦2,000</p>
        <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted">
          <span className="flex items-center justify-between"><span className="flex items-center gap-1"><PenLine className="h-3 w-3" /> Collector</span><CheckCircle2 className="h-3.5 w-3.5 text-ok" /></span>
          <span className="flex items-center justify-between"><span className="flex items-center gap-1"><PenLine className="h-3 w-3" /> Member</span><CheckCircle2 className="h-3.5 w-3.5 text-ok" /></span>
        </div>
      </div>

      {/* Floating .qie badge */}
      <div className="glass absolute -right-4 top-24 hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-medium shadow-lift sm:flex">
        <Wallet className="h-3.5 w-3.5 text-brand" aria-hidden /> tolu.qie
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ marquee */

function TrustMarquee() {
  const chips = [
    "Two signatures on every receipt",
    "Never holds your naira",
    "Gas-free for members",
    "Works over WhatsApp",
    "No names on-chain",
    "Payout holdback: no walk-aways",
    "Savings proof for lenders",
    "Open-source contracts",
    "QIE ID names",
    "Priced by the QIE Oracle",
  ];
  return (
    <section aria-label="Highlights" className="-my-10">
      <Marquee>
        {chips.map((c) => (
          <span key={c} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-sm text-muted shadow-card">
            <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden /> {c}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ------------------------------------------------------------------ before / after */

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-pretty text-lg text-muted">{body}</p>}
    </Reveal>
  );
}

function BeforeAfter() {
  const before = [
    "\"I paid.\" \"You didn't.\" One word against another",
    "A notebook only the collector can see",
    "Collector disappears, savings history goes with them",
    "Early recipient stops paying, everyone after loses",
    "Years of saving, nothing a lender will accept",
  ];
  const after = [
    "Every payment co-signed by both sides",
    "A public record anyone can check, with no names on it",
    "Your passbook lives on QIE, not in anyone's bag",
    "Payout holdback prepays early recipients' rounds",
    "A savings proof page you can share in one tap",
  ];
  return (
    <section>
      <SectionTitle eyebrow="Why it matters" title={<>Ajo runs on trust. <GradientText>Now it runs on proof.</GradientText></>} />
      <div className="grid gap-5 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-3xl border border-line bg-surface p-7 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-bad-soft text-bad"><NotebookPen className="h-5 w-5" aria-hidden /></span>
              <h3 className="text-lg font-semibold">The notebook ajo</h3>
            </div>
            <ul className="flex flex-col gap-3.5">
              {before.map((b) => (
                <li key={b} className="flex gap-3 text-sm text-muted"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden /> {b}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-lift">
            <BorderBeam duration={8} />
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-brand-ink"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
              <h3 className="text-lg font-semibold">With AjoProof</h3>
            </div>
            <ul className="flex flex-col gap-3.5">
              {after.map((a) => (
                <li key={a} className="flex gap-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /> {a}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ bento */

function Tile({ className = "", children, delay = 0 }: { className?: string; children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} className={className}>
      <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
        {children}
      </div>
    </Reveal>
  );
}

function TileHead({ icon: Icon, title, body, tone = "brand" }: { icon: typeof BookOpen; title: string; body: string; tone?: "brand" | "stamp" }) {
  return (
    <>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone === "brand" ? "bg-brand-soft text-brand" : "bg-stamp-soft text-stamp"}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </>
  );
}

function Bento() {
  return (
    <section>
      <SectionTitle
        eyebrow="Two ways to save"
        title={<>Keep your ajo. <GradientText>Add proof.</GradientText></>}
        body="Start with receipts for the group you already have, or run a dollar circle where the rules are enforced by code."
      />
      <div className="grid auto-rows-[minmax(220px,auto)] gap-5 md:grid-cols-3">
        <Tile className="md:col-span-2">
          <TileHead icon={BookOpen} title="Passbook mode: two signatures, one truth" body="Cash and transfer ajo with co-signed receipts. The collector records it, the member confirms it, and QIE keeps it forever." />
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {["Collector signs", "Member confirms", "Recorded on QIE"].map((s, i) => (
              <span key={s} className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-ink">{i + 1}</span>
                  {s}
                </span>
                {i < 2 && <ArrowRight className="h-4 w-4 text-muted" aria-hidden />}
              </span>
            ))}
          </div>
        </Tile>
        <Tile delay={80}>
          <TileHead icon={Fuel} title="Gas-free for members" body="No crypto to buy, ever. AjoProof's relayer pays every passbook fee." />
          <p className="mt-5 text-4xl font-semibold tracking-tight text-brand">₦0</p>
          <p className="text-xs text-muted">what members pay in network fees</p>
        </Tile>
        <Tile delay={40}>
          <TileHead icon={RefreshCcw} tone="stamp" title="Circle mode, enforced by code" body="Stablecoin rotation with bonds. Anyone can settle a round, so nobody can stall it." />
          <div className="mt-5 flex -space-x-2">
            {["A", "T", "C", "N", "K"].map((l, i) => (
              <span key={l} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-surface text-xs font-semibold ${i === 1 ? "bg-stamp text-white" : "bg-surface-2"}`}>{l}</span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Round 2 of 5 · pot goes to T</p>
        </Tile>
        <Tile delay={120} className="md:col-span-2">
          <TileHead icon={ShieldCheck} tone="stamp" title="Payout holdback: nobody walks away with the pot" body="When someone gets paid early, part of the pot prepays their remaining rounds. Skip anyway, and it comes out of their own money, never yours." />
          <div className="mt-6 grid grid-cols-4 gap-2 text-center text-[11px]">
            {[
              { r: "Round 1", t: "Ada gets 20 now, 20 held", c: "bg-stamp-soft" },
              { r: "Round 2", t: "Prepaid from holdback", c: "bg-brand-soft" },
              { r: "Round 3", t: "Prepaid from holdback", c: "bg-brand-soft" },
              { r: "Round 4", t: "Ada pays, or her bond does", c: "bg-surface-2" },
            ].map((x) => (
              <div key={x.r} className={`rounded-xl p-3 ${x.c}`}>
                <p className="font-semibold">{x.r}</p>
                <p className="mt-1 text-muted">{x.t}</p>
              </div>
            ))}
          </div>
        </Tile>
        <Tile delay={60}>
          <TileHead icon={QrCode} title="Savings proof for lenders" body="Share how long, how consistently and how much you've saved, checked live on-chain, as a link, QR code or PDF." />
        </Tile>
        <Tile delay={100}>
          <TileHead icon={Fingerprint} title="Private by design" body="Group names are stored as fingerprints, members as codes. No names or phone numbers, ever." />
        </Tile>
        <Tile delay={140}>
          <TileHead icon={MessageCircle} title="Lives on WhatsApp" body="Invites and receipts are links. Tap, enter your PIN, done. No app store, no sign-up form." />
        </Tile>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps = [
    { icon: Link2, title: "Invite", body: "The collector sends a one-time invite link on WhatsApp. Members tap it, set a PIN, and they're in." },
    { icon: HandCoins, title: "Pay and record", body: "Pay the way you always do. The collector records it and sends a confirm link." },
    { icon: BadgeCheck, title: "Confirm", body: "Tap Confirm. The receipt, signed by both of you, is on QIE for good." },
  ];
  return (
    <section>
      <SectionTitle eyebrow="How it works" title="Three taps. Zero crypto." />
      <div className="relative grid gap-5 md:grid-cols-3">
        <div aria-hidden className="absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-transparent via-brand to-transparent md:block" />
        {steps.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 120}>
            <div className="relative flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-7 text-center shadow-card">
              <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand text-brand-ink shadow-lift">
                <Icon className="h-6 w-6" aria-hidden />
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-stamp text-[11px] font-bold text-white">{i + 1}</span>
              </span>
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ built on QIE */

function BuiltOnQie() {
  const items = [
    { icon: ShieldCheck, name: "QIE blockchain", body: "Fast, cheap finality, so AjoProof can pay every member's fees." },
    { icon: Wallet, name: "QIE ID", body: "Members show up as tolu.qie, and proof links work by name." },
    { icon: LineChart, name: "QIE Oracle", body: "Live QIE/USDT price turns fees and balances into dollars." },
    { icon: RefreshCcw, name: "QIEDEX", body: "Swap QUSDC for QIE in-app so circle wallets pay their own fees." },
  ];
  return (
    <section className="relative">
      <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-surface-2" aria-hidden />
      <div className="relative py-16">
        <SectionTitle eyebrow="Built on QIE" title={<>Native to the <GradientText>QIE ecosystem</GradientText></>} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, name, body }, i) => (
            <Reveal key={name} delay={i * 80}>
              <div className="h-full rounded-3xl border border-line bg-surface p-6 shadow-card">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <h3 className="mt-4 font-semibold">{name}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

function Faq() {
  const items = [
    { q: "Do members need crypto or a crypto app?", a: "No. A wallet is created in the browser, locked with a 6-digit PIN, and AjoProof pays the network fees for passbook actions." },
    { q: "Does AjoProof hold our money?", a: "Not in passbook mode: your naira never touches AjoProof. In circle mode, the stablecoin pot is held by the open-source circle contract, never by us, and only its fixed rules can move it." },
    { q: "What exactly goes on the blockchain?", a: "Amounts, dates, an opaque member code and both signatures. Group names are stored only as a fingerprint, and no names or phone numbers are ever published." },
    { q: "Can a collector fake or edit a receipt?", a: "No. A receipt needs the member's signature too, each payment reference can be used once, and recorded receipts can't be changed or deleted." },
    { q: "What stops someone taking the circle pot and leaving?", a: "The payout holdback. When you're paid early, part of the pot prepays your remaining rounds; anything you still skip comes out of your own bond." },
  ];
  return (
    <section className="mx-auto w-full max-w-3xl">
      <SectionTitle eyebrow="Questions" title="Good to know" />
      <Reveal>
        <div className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-card">
          {items.map(({ q, a }) => (
            <details key={q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-lg leading-none text-muted transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ final CTA */

function FinalCta() {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center text-brand-ink shadow-lift sm:px-12">
        <BorderBeam duration={7} />
        <div className="dot-pattern absolute inset-0 opacity-20" aria-hidden />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">No more &ldquo;I paid&rdquo;, &ldquo;you didn&apos;t&rdquo;.</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg opacity-90">Set up your group in a minute and send the first invite link today.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/collector" className="shimmer inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface px-6 font-medium text-ink shadow-lift transition-transform hover:-translate-y-0.5">
              Start a group <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/circles" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-6 font-medium transition-colors hover:bg-white/10">
              Try a savings circle
            </Link>
            <Link href="/stats" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 font-medium underline-offset-4 hover:underline">
              See live stats
            </Link>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
