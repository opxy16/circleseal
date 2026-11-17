"use client";

import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Info, Loader2, Stamp } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

/* AjoProof UI kit, in the style of shadcn/ui (MIT): small, composable, token-driven. */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "shimmer bg-brand text-brand-ink shadow-card hover:-translate-y-px hover:bg-brand-strong hover:shadow-lift",
    secondary: "bg-surface-2 text-ink hover:bg-line",
    outline: "border border-line bg-surface text-ink shadow-card hover:bg-surface-2",
    ghost: "text-brand hover:bg-brand-soft",
    destructive: "border border-line bg-surface text-bad hover:bg-bad-soft",
  };
  const sizes = { sm: "min-h-9 px-3 text-sm", md: "min-h-11 px-4 text-sm", lg: "min-h-12 px-5 text-base" };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-[spin_0.8s_linear_infinite]" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-line bg-surface p-5 shadow-card transition-shadow duration-300 hover:shadow-lift", className)}>{children}</section>;
}

export function CardHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stamp">{eyebrow}</p>}
        <h2 className="text-base font-semibold leading-tight tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, action }: { title: ReactNode; description?: ReactNode; eyebrow?: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div aria-hidden className="hero-glow pointer-events-none absolute -inset-x-16 -top-16 bottom-0 -z-10 opacity-80 print:hidden" />
      <div className="reveal reveal-in min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-pretty text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  id,
  prefix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string; prefix?: ReactNode }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="flex min-h-11 items-center rounded-lg border border-line bg-surface shadow-card transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
        {prefix && <span className="pl-3 text-muted">{prefix}</span>}
        <input
          id={id}
          className="h-full min-h-11 w-full min-w-0 rounded-lg bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          {...props}
        />
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "ok" | "bad" | "stamp"; children: ReactNode; title?: ReactNode }) {
  const styles = {
    info: { box: "border-line bg-surface-2", icon: <Info className="h-4 w-4 text-muted" aria-hidden /> },
    ok: { box: "border-brand-soft bg-brand-soft", icon: <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden /> },
    bad: { box: "border-bad-soft bg-bad-soft", icon: <AlertTriangle className="h-4 w-4 text-bad" aria-hidden /> },
    stamp: { box: "border-stamp-soft bg-stamp-soft", icon: <Stamp className="h-4 w-4 text-stamp" aria-hidden /> },
  }[tone];
  return (
    <div role={tone === "bad" ? "alert" : undefined} className={cx("flex gap-3 rounded-lg border px-3.5 py-3 text-sm text-ink", styles.box)}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-medium">{title}</p>}
        <div className="text-pretty">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="truncate text-xl font-semibold tabular-nums tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "brand" | "stamp" | "bad"; children: ReactNode; className?: string }) {
  const styles = {
    neutral: "border-line bg-surface-2 text-muted",
    brand: "border-brand-soft bg-brand-soft text-brand",
    stamp: "border-stamp-soft bg-stamp-soft text-stamp",
    bad: "border-bad-soft bg-bad-soft text-bad",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", styles, className)}>{children}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function LoadingCard({ label = "Reading from QIE…" }: { label?: string }) {
  return (
    <Card className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </Card>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5 text-sm">
      <legend className="mb-1.5 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-9 flex-1 rounded-md px-3 text-sm transition-colors",
              value === o.value ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TxLink({ hash, explorer }: { hash: string; explorer: string | null }) {
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return explorer ? (
    <a className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline" href={explorer} target="_blank" rel="noreferrer">
      {short}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  ) : (
    <span className="font-mono text-xs text-muted">{short}</span>
  );
}

export function CopyButton({ text, label = "Copy link", size = "md" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
          setTimeout(() => setState("idle"), 2000);
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "copied" ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </Button>
  );
}

export function WhatsAppButton({ href, label = "Share on WhatsApp" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1f9d55] px-4 text-sm font-medium text-white shadow-card transition-colors hover:bg-[#1a8a4a]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
      </svg>
      {label}
    </a>
  );
}
