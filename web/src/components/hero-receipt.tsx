"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Guilloche, Receipt } from "./seal";

/** The landing page's one big motion moment: a receipt gets co-signed and sealed. */
export function HeroReceipt() {
  const [run, setRun] = useState(0);
  const ref = useRef<HTMLElement>(null);
  // On phones the receipt starts below the fold: replay the sequence when it first scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let first = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (first) {
          first = false;
          if (e.isIntersecting) return io.disconnect();
          return;
        }
        if (e.isIntersecting) {
          setRun((r) => r + 1);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <figure ref={ref} className="relative mx-auto w-full max-w-[400px] lg:mr-0">
      <Guilloche size={420} rings={3} lines={9} k={14} className="pointer-events-none absolute -left-24 -top-20 -z-10 h-[520px] w-[520px] text-brand opacity-25" turn />
      {/* An older receipt underneath, already sealed: this is a book of them. */}
      <div aria-hidden className="absolute inset-x-6 -top-4 bottom-8 -rotate-[4deg] rounded-sm bg-surface-2 shadow-card ring-1 ring-ink/10" />
      <Receipt
        playKey={run}
        play
        title="CONTRIBUTION RECEIPT"
        number="No. 0142"
        amount="₦2,000"
        subtitle="Market Traders Daily Savings"
        lines={[
          { label: "For day", value: "14" },
          { label: "Paid", value: "18 Nov, 08:12" },
          { label: "Member", value: "tolu.qie" },
        ]}
        memberSigned
        memberLabel="Member (tolu.qie)"
        sealed
        footer={<span>Recorded on QIE · can&apos;t be changed or deleted</span>}
      />
      <figcaption className="mt-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span>Both people sign. Then it&apos;s sealed for good.</span>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 font-semibold text-ink hover:bg-surface-2"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
        </button>
      </figcaption>
    </figure>
  );
}
