import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

const FILLS = ["#FFC933", "#DFE4FF", "#DDF5E9", "#FFE3DF", "#E6D9FF", "#D3F1FF"];

export function fillFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FILLS[h % FILLS.length];
}

/** Two hex characters from an address stand in for a name (a name's first letters are used when one is given); the colour comes from the same seed. */
export function initials(seed: string): string {
  if (seed.startsWith("0x")) return seed.slice(-2).toUpperCase();
  return seed.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

export function Avatar({ seed, className, size = 36 }: { seed: string; className?: string; size?: number }) {
  const style: CSSProperties = { background: fillFor(seed), width: size, height: size, fontSize: size * 0.36 };
  return (
    <span
      aria-hidden
      style={style}
      className={cn("inline-grid shrink-0 place-items-center rounded-full border-2 border-ink/80 font-display font-bold tnum text-ink", className)}
    >
      {initials(seed)}
    </span>
  );
}
