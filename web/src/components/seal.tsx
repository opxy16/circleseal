"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

/*
 * CircleSeal's signature visuals: a guilloché rosette (the fine engraved pattern on banknotes and
 * certificates), the seal stamp built from it, hand-drawn signatures and the perforated receipt.
 * All pure SVG + CSS. Motion lives in globals.css and switches off under prefers-reduced-motion.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Points of one guilloché wave: a circle of radius r whose edge ripples `k` times. */
function wave(cxy: number, r: number, amp: number, k: number, phase: number, steps = 360) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.sin(k * t + phase);
    const x = cxy + rr * Math.cos(t);
    const y = cxy + rr * Math.sin(t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + "Z";
}

const ROSETTE_CACHE = new Map<string, string[]>();
function rosette(size: number, rings: number, lines: number, k: number, steps = 120) {
  const key = `${size}-${rings}-${lines}-${k}-${steps}`;
  const hit = ROSETTE_CACHE.get(key);
  if (hit) return hit;
  const c = size / 2;
  const out: string[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const r = c * (0.5 + ring * (0.4 / Math.max(1, rings)));
    const amp = c * 0.085;
    // Offsets span a full wave, so the lines braid into the engraved band you see on banknotes.
    for (let l = 0; l < lines; l++) out.push(wave(c, r, amp, k + ring * 2, (l / lines) * Math.PI * 2, steps));
  }
  ROSETTE_CACHE.set(key, out);
  return out;
}

/**
 * Decorative guilloché rosette. Inherits colour from `currentColor`. Drawn after mount as a single path,
 * so the server HTML stays small.
 */
export function Guilloche({ size = 200, rings = 2, lines = 12, k = 12, className = "", strokeWidth = 0.5, turn = false }: { size?: number; rings?: number; lines?: number; k?: number; className?: string; strokeWidth?: number; turn?: boolean }) {
  const [d, setD] = useState<string | null>(null);
  useEffect(() => setD(rosette(size, rings, lines, k, 220).join("")), [size, rings, lines, k]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cx(className, turn && "rosette-turn")} aria-hidden fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      {d && <path d={d} />}
    </svg>
  );
}

/** The CircleSeal mark: two overlapping rings inside a guilloché seal. */
export function SealMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" className="fill-brand" />
      <g fill="none" stroke="currentColor" className="text-brand-ink" strokeWidth="0.45" opacity="0.55">
        {rosette(40, 1, 6, 10).map((d, i) => (
          <path key={i} d={d} transform="translate(20 20) scale(1.02) translate(-20 -20)" />
        ))}
      </g>
      <circle cx="20" cy="20" r="11.2" className="fill-brand" />
      <g fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-ink">
        <circle cx="16.8" cy="20" r="5.6" opacity="0.6" />
        <circle cx="23.2" cy="20" r="5.6" />
      </g>
    </svg>
  );
}

/**
 * A rubber-stamp seal: ring text around a guilloché core. `play` runs the stamp-down animation once
 * (re-run by changing `playKey`). Without `play` it simply sits on the page, already stamped.
 */
export function Seal({
  text = "CO-SIGNED · RECORDED ON QIE · ",
  center = "SEALED",
  size = 112,
  angle = -12,
  play = false,
  delay = 0,
  className = "",
  tone = "stamp",
}: {
  text?: string;
  center?: ReactNode;
  size?: number;
  angle?: number;
  play?: boolean;
  delay?: number;
  className?: string;
  tone?: "stamp" | "brand";
}) {
  const id = useId().replace(/:/g, "");
  return (
    <span
      className={cx("pointer-events-none inline-block", play && "stamp-play", className)}
      style={{ "--stamp-angle": `${angle}deg`, "--stamp-delay": `${delay}s` } as CSSProperties}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" width={size} height={size} className={cx("stamp-mark block", tone === "stamp" ? "text-stamp" : "text-brand")}>
        <defs>
          <path id={`ring-${id}`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
          {/* Uneven ink, like a real rubber stamp. */}
          <filter id={`ink-${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.2" result="mask" />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#ink-${id})`} fill="none" stroke="currentColor">
          <circle cx="60" cy="60" r="56" strokeWidth="3.5" />
          <circle cx="60" cy="60" r="35" strokeWidth="1.6" />
          <g strokeWidth="0.5" opacity="0.8">
            {rosette(120, 1, 6, 14).map((d, i) => (
              <path key={i} d={d} transform="translate(60 60) scale(0.62) translate(-60 -60)" />
            ))}
          </g>
          <text fill="currentColor" stroke="none" fontSize="10.2" fontWeight="700" letterSpacing="1.6" style={{ fontVariationSettings: '"wdth" 112' }}>
            <textPath href={`#ring-${id}`} startOffset="0" textLength={272} lengthAdjust="spacingAndGlyphs">
              {text}
            </textPath>
          </text>
          <text x="60" y="64" textAnchor="middle" fill="currentColor" stroke="none" fontSize="12" fontWeight="800" letterSpacing="1" style={{ fontVariationSettings: '"wdth" 125' }}>
            {center}
          </text>
        </g>
      </svg>
    </span>
  );
}

/* Hand-drawn signature strokes (normalised to a 120 x 36 box). Picked by a seed so each signer looks different. */
const SIGS = [
  "M4 26c6-14 10-20 13-19s-3 18-1 19 9-15 12-15-2 12 1 13 6-8 9-8 1 7 4 7 8-10 12-10-1 9 3 9 10-6 16-6 14 3 24 1 18-4 18-4",
  "M6 22c3-8 8-15 12-15 5 0-8 20-3 20s10-13 13-13-1 10 2 10 5-6 8-6 0 6 3 6 6-11 9-11-2 13 2 13 9-9 14-9 7 4 14 3 20-5 28-7",
  "M3 20c8-2 14-12 18-12s-7 16-2 16 8-10 11-10 0 8 3 8 4-5 7-5-1 5 2 5 9-14 12-14-4 16 0 16 11-4 17-6 22-2 30-4",
];

/** A signature line that writes itself when `play` is set. */
export function Signature({ seed = 0, play = false, delay = 0, className = "" }: { seed?: number; play?: boolean; delay?: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 36" className={cx("h-9 w-32 max-w-full", play && "sig-play", className)} aria-hidden style={{ "--sig-delay": `${delay}s` } as CSSProperties}>
      <path d={SIGS[seed % SIGS.length]} pathLength={1} className="sig-draw" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type ReceiptLine = { label: ReactNode; value: ReactNode };

/**
 * A perforated paper receipt. Two signature rows (collector, member) and an optional seal.
 * `play` runs the full co-sign sequence: collector signs, member signs, the seal comes down,
 * and the "recorded" line prints.
 */
export function Receipt({
  title,
  number,
  amount,
  subtitle,
  lines = [],
  collectorSigned = true,
  memberSigned,
  memberLabel = "Member",
  sealed,
  play = false,
  playKey = 0,
  footer,
  className = "",
}: {
  title: ReactNode;
  number?: ReactNode;
  amount: ReactNode;
  subtitle?: ReactNode;
  lines?: ReceiptLine[];
  collectorSigned?: boolean;
  memberSigned: boolean;
  memberLabel?: ReactNode;
  sealed: boolean;
  play?: boolean;
  playKey?: number;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <div className="paper-shadow">
      <div
        key={playKey}
        className={cx("perforated relative bg-surface px-5 pb-6 pt-7 text-ink sm:px-6", play && "sig-play stamp-play")}
        style={{ "--stamp-delay": `${sealed ? 2.15 : 0}s` } as CSSProperties}
      >
        <div className="stamp-thud">
          <div className="flex flex-col gap-0.5 pr-16 font-mono text-[11px] text-muted">
            <span>{title}</span>
            {number && <span className="tabular-nums">{number}</span>}
          </div>
          <div className="mt-4 text-center">
            <p className="font-display text-[2.6rem] leading-none tabular-nums sm:text-5xl">{amount}</p>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="tear my-5" />
          {lines.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
              {lines.map((l, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted">{l.label}</dt>
                  <dd className="text-right tabular-nums">{l.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4">
            <SignRow label="Collector" signed={collectorSigned} seed={0} delay={0.3} />
            <SignRow label={memberLabel} signed={memberSigned} seed={1} delay={1.25} />
          </div>
          {footer && <div className={cx("mt-5 font-mono text-[11px] text-muted", play && "print-in")}>{footer}</div>}
        </div>
      </div>
      </div>
      {/* Outside the perforation mask so the stamp can hang over the paper's edge. */}
      {sealed && <Seal key={playKey} className="absolute -right-3 -top-10 sm:-right-9" size={108} play={play} delay={2.15} />}
    </div>
  );
}

function SignRow({ label, signed, seed, delay }: { label: ReactNode; signed: boolean; seed: number; delay: number }) {
  return (
    <div className="min-w-0" style={{ "--sig-delay": `${delay + 0.75}s` } as CSSProperties}>
      <div className="relative h-9 border-b border-ink/40">
        {signed ? (
          <Signature seed={seed} delay={delay} className="absolute bottom-0 left-0 text-[color:var(--ink)]" />
        ) : (
          <span className="absolute bottom-1.5 left-0 text-xs text-muted">Waiting to sign</span>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        {signed && (
          <span className="sig-check grid h-4 w-4 place-items-center rounded-full bg-ok text-white">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </span>
        )}
        {label}
        <span className="sr-only">{signed ? " signed" : " not signed yet"}</span>
      </p>
    </div>
  );
}
