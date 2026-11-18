import type { CSSProperties } from "react";

/** Initials avatar with a stable hue picked from the wallet address (readable in light and dark). */
const HUES = [152, 170, 200, 32, 260, 340, 12, 90];

export function Avatar({ seed, name, size = 36 }: { seed: string; name: string; size?: number }) {
  const hue = HUES[parseInt(seed.slice(-2), 16) % HUES.length];
  const initials =
    name
      .replace(/^0x/i, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      aria-hidden
      className="avatar grid shrink-0 place-items-center rounded-full text-xs font-bold"
      style={{ width: size, height: size, "--h": hue } as CSSProperties}
    >
      {initials}
    </span>
  );
}
