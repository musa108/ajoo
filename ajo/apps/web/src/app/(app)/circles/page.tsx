"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useCircleList, type CircleSummary } from "@/lib/hooks";
import { StateChip } from "@/components/state-chip";
import { Button, button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/small";
import { periodLabel, usd } from "@/lib/format";
import { cn } from "@/lib/cn";

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "open", label: "Open to join", test: (c: CircleSummary) => c.state === 0 },
  { key: "active", label: "In progress", test: (c: CircleSummary) => c.state === 1 },
  { key: "done", label: "Finished", test: (c: CircleSummary) => c.state === 2 },
] as const;

function CircleCard({ c }: { c: CircleSummary }) {
  const pot = c.contribution * BigInt(c.maxMembers);
  const open = c.state === 0;
  return (
    <Link
      href={`/circles/${c.address}`}
      className="group flex h-full flex-col justify-between rounded-card border-2 border-ink/90 bg-surface p-5 transition-[background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-marigold-tint"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words font-display text-xl font-bold leading-tight tracking-tight">{c.name}</h2>
          <StateChip state={c.state} className="shrink-0" />
        </div>
        <p className="mt-2 text-[0.9375rem] text-ink-soft">
          <span className="tnum font-semibold text-ink">{usd(c.contribution)}</span> every {periodLabel(c.period)} from {c.maxMembers} people
        </p>
      </div>
      <div className="mt-5">
        <div className="flex items-end justify-between text-sm">
          <span className="text-ink-soft">
            {open ? (
              <>
                <span className="tnum font-semibold text-ink">{c.memberCount}</span> of {c.maxMembers} joined
              </>
            ) : c.state === 1 ? (
              <>
                Cycle <span className="tnum font-semibold text-ink">{Math.min(c.settledCycles + 1, c.maxMembers)}</span> of {c.maxMembers}
              </>
            ) : (
              "Everyone has had a turn"
            )}
          </span>
          <span className="tnum text-lg font-bold">{usd(pot)} pot</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-cobalt-tint" role="progressbar" aria-valuemin={0} aria-valuemax={c.maxMembers} aria-valuenow={open ? c.memberCount : c.settledCycles} aria-label={open ? "Seats filled" : "Cycles settled"}>
          <div className="h-full rounded-full bg-cobalt" style={{ width: `${((open ? c.memberCount : c.settledCycles) / c.maxMembers) * 100}%` }} />
        </div>
      </div>
    </Link>
  );
}

export default function CirclesPage() {
  const q = useCircleList();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const list = useMemo(() => (q.data ?? []).filter(FILTERS.find((f) => f.key === filter)!.test), [q.data, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2">Circles</h1>
          <p className="mt-2 max-w-xl text-ink-soft">Join a circle that is filling up, or watch one that is already running. Every payment is on-chain and visible to its members.</p>
        </div>
        <Link href="/circles/new" className={button({ variant: "primary", size: "lg" })}>
          <Plus className="h-5 w-5" aria-hidden />
          Start a circle
        </Link>
      </div>

      <div role="group" aria-label="Filter circles" className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "min-h-11 rounded-full border-2 px-4 text-[0.9375rem] font-semibold transition-colors duration-150",
              filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink/60",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {q.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        )}
        {q.isError && (
          <div role="alert" className="rounded-card border-2 border-coral/50 bg-coral-tint p-5">
            <p className="font-semibold">Could not load circles.</p>
            <p className="mt-1 text-[0.9375rem]">Check that your wallet network and the app's RPC are reachable, then try again.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => q.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {q.data && list.length === 0 && (
          <EmptyState
            title={q.data.length === 0 ? "No circles yet" : "Nothing here"}
            body={q.data.length === 0 ? "Start the first one. Pick the amount, the people, and how often you pay." : "No circles match this filter. Try another one, or start your own."}
            action={
              <Link href="/circles/new" className={button({ variant: "primary" })}>
                Start a circle
              </Link>
            }
          />
        )}
        {list.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <li key={c.address}>
                <CircleCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
