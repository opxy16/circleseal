import type { Config } from "tailwindcss";

/** A token that also supports Tailwind opacity modifiers (e.g. `border-ink/15`) via color-mix. */
const v = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        brand: { DEFAULT: v("brand"), strong: v("brand-strong"), ink: v("brand-ink"), soft: v("brand-soft") },
        stamp: { DEFAULT: v("stamp"), soft: v("stamp-soft") },
        ok: v("ok"),
        bad: { DEFAULT: v("bad"), soft: v("bad-soft") },
      },
      boxShadow: { card: "var(--shadow)", lift: "var(--shadow-lg)" },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
