import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: v("paper"),
        surface: v("surface"),
        ink: v("ink"),
        "ink-soft": v("ink-soft"),
        line: v("line"),
        cobalt: { DEFAULT: v("cobalt"), press: v("cobalt-press"), tint: v("cobalt-tint") },
        marigold: { DEFAULT: v("marigold"), tint: v("marigold-tint"), deep: v("marigold-deep") },
        leaf: { DEFAULT: v("leaf"), tint: v("leaf-tint") },
        coral: { DEFAULT: v("coral"), tint: v("coral-tint") },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["clamp(2.75rem, 7.2vw, 5.75rem)", { lineHeight: "0.95", letterSpacing: "-0.035em", fontWeight: "800" }],
        h2: ["clamp(1.75rem, 3.6vw, 2.75rem)", { lineHeight: "1.05", letterSpacing: "-0.025em", fontWeight: "700" }],
      },
      borderRadius: { panel: "24px", card: "16px", field: "12px", chip: "8px" },
      transitionTimingFunction: { out: "cubic-bezier(0.22, 1, 0.36, 1)" },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
} satisfies Config;
