"use client";

/**
 * Motion and visual effects, written for CircleSeal in the spirit of open-source libraries like
 * Magic UI (MIT): border beam, number ticker, marquee, scroll reveal, animated list, phone frame.
 * Pure CSS + React, no animation dependency, and everything respects prefers-reduced-motion.
 */
import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    // Safety net: never leave content hidden (slow devices, odd browsers, screenshots).
    const fallback = setTimeout(() => setShown(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={cx("reveal", shown && "reveal-in", className)}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Counts up to `value` once visible. `format` turns the running number into text. */
export function NumberTicker({ value, format = (n) => Math.round(n).toLocaleString("en-NG"), duration = 1200 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    let raf = 0;
    let done: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      // Land on the exact value even if the browser throttles animation frames (background tabs).
      done = setTimeout(() => setN(value), duration + 300);
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setN(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(n)}
    </span>
  );
}

/** A soft beam of light that travels around the border of its parent (parent must be `relative`). */
export function BorderBeam({ className = "", duration = 6 }: { className?: string; duration?: number }) {
  return <span aria-hidden className={cx("border-beam", className)} style={{ "--beam-duration": `${duration}s` } as CSSProperties} />;
}

/** Infinite horizontal scroll of items. */
export function Marquee({ children, reverse = false, className = "" }: { children: ReactNode; reverse?: boolean; className?: string }) {
  const items = Children.toArray(children);
  return (
    <div className={cx("marquee group flex overflow-hidden", className)}>
      {[0, 1].map((k) => (
        <div key={k} aria-hidden={k === 1} className={cx("marquee-track flex shrink-0 items-center gap-4 pr-4", reverse && "marquee-reverse")}>
          {items}
        </div>
      ))}
    </div>
  );
}

/** Cycles through items, sliding each new one in at the top (like live notifications). */
export function AnimatedList({ items, interval = 2200, visible = 4 }: { items: ReactNode[]; interval?: number; visible?: number }) {
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(items.length);
      return;
    }
    const t = setInterval(() => setCount((c) => c + 1), interval);
    return () => clearInterval(t);
  }, [items.length, interval]);
  const shown = Array.from({ length: Math.min(count, visible) }, (_, i) => {
    const idx = (count - 1 - i) % items.length;
    return { key: count - i, node: items[idx] };
  });
  return (
    <ul className="flex flex-col gap-2.5">
      {shown.map(({ key, node }, i) => (
        <li key={key} className={cx(i === 0 && "list-enter")} style={{ opacity: 1 - i * 0.18 }}>
          {node}
        </li>
      ))}
    </ul>
  );
}

/** A phone frame for showing app screens on the landing page. */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative mx-auto w-[290px] rounded-[2.6rem] border border-line bg-ink p-2.5 shadow-lift", className)}>
      <div className="relative h-[560px] overflow-hidden rounded-[2.1rem] bg-bg">
        <div aria-hidden className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
        {children}
      </div>
    </div>
  );
}

/** Animated, blurred colour blobs for hero backgrounds. */
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="aurora-blob aurora-a" />
      <div className="aurora-blob aurora-b" />
      <div className="aurora-blob aurora-c" />
    </div>
  );
}

/** Text with a moving brand gradient. */
export function GradientText({ children }: { children: ReactNode }) {
  return <span className="gradient-text">{children}</span>;
}
