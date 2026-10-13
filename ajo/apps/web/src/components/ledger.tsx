"use client";

import { Check, Clock3, Minus, ShieldHalf, X } from "lucide-react";
import type { Address } from "viem";
import { Avatar } from "./avatar";
import { shortAddr } from "@/lib/format";
import { cn } from "@/lib/cn";

const CELL = [
  { label: "not paid yet", icon: Minus, cls: "text-ink-soft/50" },
  { label: "paid on time", icon: Check, cls: "bg-leaf-tint text-leaf" },
  { label: "paid late", icon: Clock3, cls: "bg-marigold-tint text-marigold-deep" },
  { label: "missed, covered by deposit", icon: ShieldHalf, cls: "bg-marigold-tint text-marigold-deep" },
  { label: "missed", icon: X, cls: "bg-coral-tint text-coral" },
] as const;

/**
 * The organizer's notebook, on-chain. Rows are people, columns are cycles.
 * Every cell has an icon and an accessible name, so state never relies on colour alone.
 */
export function Ledger({
  members,
  order,
  matrix,
  scores,
  settled,
  active,
  me,
}: {
  members: Address[];
  order: Address[];
  matrix: number[][];
  scores: number[];
  settled: number;
  active: boolean;
  me?: Address;
}) {
  const cycles = matrix[0]?.length ?? 0;
  if (!cycles) return null;
  return (
    <div className="overflow-x-auto rounded-card border-2 border-ink/90 bg-surface" tabIndex={0} role="region" aria-label="Payment ledger. Scroll sideways on small screens.">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">Who paid in each cycle, and who receives the pot.</caption>
        <thead>
          <tr className="border-b-2 border-ink/90">
            <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left font-semibold">
              Member
            </th>
            {Array.from({ length: cycles }, (_, c) => {
              const now = active && c === settled;
              return (
                <th key={c} scope="col" className={cn("px-2 py-2 text-center font-semibold", now && "bg-marigold-tint")}>
                  <span className="block tnum">Cycle {c + 1}</span>
                  <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-ink-soft">
                    gets pot <Avatar seed={order[c] ?? ""} size={20} className="border" />
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => {
            const mine = me && m.toLowerCase() === me.toLowerCase();
            return (
              <tr key={m} className="border-b border-line last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">
                  <span className="flex items-center gap-2.5">
                    <Avatar seed={m} size={32} />
                    <span>
                      <span className="block tnum">
                        {shortAddr(m)}
                        {mine && <span className="ml-1.5 rounded-chip bg-cobalt-tint px-1.5 py-0.5 text-xs font-semibold text-cobalt-press">You</span>}
                      </span>
                      <span className="block text-xs text-ink-soft tnum">Score {scores[i] ?? 0}</span>
                    </span>
                  </span>
                </th>
                {matrix[i].map((st, c) => {
                  const cell = CELL[st] ?? CELL[0];
                  const Icon = cell.icon;
                  const future = c > settled || (c === settled && !active);
                  const receives = order[c]?.toLowerCase() === m.toLowerCase();
                  return (
                    <td key={c} className={cn("px-2 py-2 text-center", active && c === settled && "bg-marigold-tint/60")}>
                      <span
                        role="img"
                        aria-label={`${shortAddr(m)}, cycle ${c + 1}: ${future && st === 0 ? "upcoming" : cell.label}${receives ? ", receives the pot" : ""}`}
                        title={`${future && st === 0 ? "upcoming" : cell.label}${receives ? " · receives the pot" : ""}`}
                        className={cn("relative inline-grid h-9 w-9 place-items-center rounded-full", cell.cls, receives && "ring-[3px] ring-ink ring-offset-2 ring-offset-surface")}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerLegend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
      {CELL.slice(1).map((c) => {
        const Icon = c.icon;
        return (
          <li key={c.label} className="flex items-center gap-1.5">
            <span className={cn("grid h-6 w-6 place-items-center rounded-full", c.cls)}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden />
            </span>
            {c.label}
          </li>
        );
      })}
      <li className="flex items-center gap-1.5">
        <span className="block h-6 w-6 shrink-0 rounded-full ring-[3px] ring-ink ring-offset-2 ring-offset-surface" aria-hidden />
        receives the pot
      </li>
    </ul>
  );
}
