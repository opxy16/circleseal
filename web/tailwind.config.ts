import type { Config } from "tailwindcss";

export default {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: { DEFAULT: "var(--brand)", strong: "var(--brand-strong)", ink: "var(--brand-ink)", soft: "var(--brand-soft)" },
        stamp: { DEFAULT: "var(--stamp)", soft: "var(--stamp-soft)" },
        ok: "var(--ok)",
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)" },
      },
      boxShadow: { card: "var(--shadow)", lift: "var(--shadow-lg)" },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
