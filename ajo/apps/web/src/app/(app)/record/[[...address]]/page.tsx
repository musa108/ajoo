"use client";

import { use } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { useMyCircles, useStats } from "@/lib/hooks";
import { addresses } from "@/lib/config";
import { periodLabel, shortAddr, usd } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { StateChip } from "@/components/state-chip";
import { Skeleton, EmptyState } from "@/components/small";
import { WalletButton } from "@/components/wallet";
import { button } from "@/components/ui/button";
import { useMounted } from "@/lib/use-mounted";

const RULES = [
  ["Pay on time", "+10", "+15 for circles of $10 or more, +20 for $100 or more"],
  ["Pay inside the grace period", "-5", "Counts as paid, with a small penalty"],
  ["Miss, covered by your deposit", "-60", "The circle stays whole, your deposit shrinks"],
  ["Miss with no deposit left", "-200", "You lose your own turn in that circle"],
  ["Finish a circle with no misses", "+50", "Paid out once, when the circle ends"],
  ["Repay a loan", "+25", "Whole loan repaid, fee included"],
  ["Default on a loan", "-300", "Written off after the grace period"],
] as const;

function Meter({ score, threshold }: { score: number; threshold: number }) {
  return (
    <div>
      <div className="relative h-5 rounded-full border-2 border-ink/90 bg-surface" role="meter" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={score} aria-label="Reputation score out of 1000">
        <div className="h-full rounded-full bg-marigold" style={{ width: `${Math.max(2, score / 10)}%`, transition: "width 600ms var(--ease-out)" }} />
        <div className="absolute -top-1 bottom-[-4px] w-[3px] bg-ink" style={{ left: `${threshold / 10}%` }} aria-hidden />
      </div>
      <div className="relative mt-2 h-10 text-sm text-ink-soft tnum">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2 text-center" style={{ left: `${threshold / 10}%` }}>
          {threshold}
          <br />
          loans unlock
        </span>
        <span className="absolute right-0">1000</span>
      </div>
    </div>
  );
}

export default function RecordPage({ params }: { params: Promise<{ address?: string[] }> }) {
  const { address: seg } = use(params);
  const { address: me } = useAccount();
  const mounted = useMounted();
  const given = seg?.[0];
  const target = (given && isAddress(given) ? given : me) as Address | undefined;
  const mineView = !given || (me && given.toLowerCase() === me.toLowerCase());
  const stats = useStats(target);
  const circles = useMyCircles(target);

  if (given && !isAddress(given)) {
    return <p className="rounded-card border-2 border-coral/50 bg-coral-tint p-5 font-semibold">That is not a wallet address.</p>;
  }
  if (!mounted) return <Skeleton className="h-72" />;
  if (!target) {
    return (
      <EmptyState title="Connect to see your record" body="Your reputation lives on-chain and belongs to your wallet. Connect to see it." action={<WalletButton />} />
    );
  }

  const st = stats.data;
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar seed={target} size={48} />
        <div>
          <h1 className="text-h2">{mineView ? "My record" : "Record"}</h1>
          <p className="tnum text-sm text-ink-soft break-all">{target}</p>
        </div>
      </div>

      {stats.isLoading || !st ? (
        <Skeleton className="h-64" />
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-labelledby="score-h">
          <div className="rounded-panel border-2 border-ink/90 bg-marigold-tint p-6 sm:p-8">
            <h2 id="score-h" className="text-lg font-semibold">
              Reputation score
            </h2>
            <p className="mt-1 font-display text-[6.5rem] font-extrabold leading-none tracking-tight tnum" style={{ fontStretch: "86%" }}>
              {st.score}
            </p>
            <p className="mt-1 text-ink-soft">out of 1000</p>
            <div className="mt-6">
              <Meter score={st.score} threshold={400} />
            </div>
            <p className="mt-2 text-[0.9375rem]">
              {st.score >= 400 ? (
                <>
                  You are above the loan threshold.{" "}
                  <Link href="/credit" className="font-semibold text-cobalt-press underline underline-offset-4">
                    See what you can borrow
                  </Link>
                  .
                </>
              ) : (
                <>Finish circles on time to reach {400}. At {400} small loans unlock; the higher your score, the larger the limit.</>
              )}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-card border-2 border-ink/90 bg-ink/90">
            {[
              ["Paid on time", st.onTime],
              ["Paid late", st.late],
              ["Missed, covered", st.defaultsCovered],
              ["Missed, not covered", st.defaultsUncovered],
              ["Circles finished", st.circlesCompleted],
              ["Total paid in", usd(st.totalContributed)],
              ["Loans repaid", st.creditRepaid],
              ["Loans defaulted", st.creditDefaulted],
            ].map(([k, v]) => (
              <div key={String(k)} className="bg-surface px-4 py-3.5">
                <dt className="text-sm text-ink-soft">{k}</dt>
                <dd className="mt-0.5 font-display text-2xl font-bold tnum">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="circles-h">
        <h2 id="circles-h" className="mb-3 text-h2">
          Circles
        </h2>
        {circles.isLoading ? (
          <Skeleton className="h-24" />
        ) : !circles.data?.length ? (
          <EmptyState
            title="No circles yet"
            body={mineView ? "Join a circle or start one. Your first on-time payment starts your record." : "This wallet has not joined a circle."}
            action={
              mineView && (
                <Link href="/circles" className={button({ variant: "primary" })}>
                  Browse circles
                </Link>
              )
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {circles.data.map((c) => (
              <li key={c.address}>
                <Link href={`/circles/${c.address}`} className="flex items-center justify-between gap-3 rounded-card border-2 border-ink/90 bg-surface px-4 py-3.5 transition-colors hover:bg-marigold-tint">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block text-sm text-ink-soft tnum">
                      {usd(c.contribution)} every {periodLabel(c.period)}
                    </span>
                  </span>
                  <StateChip state={c.state} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rules-h">
        <h2 id="rules-h" className="mb-1 text-h2">
          How the score works
        </h2>
        <p className="mb-4 max-w-2xl text-ink-soft">The rules are constants in the registry contract. Nobody can edit a score, and it cannot be transferred or sold.</p>
        <div className="overflow-x-auto rounded-card border-2 border-ink/90 bg-surface" tabIndex={0} role="region" aria-label="Score rules. Scroll sideways on small screens.">
          <table className="w-full min-w-[32rem] text-left text-[0.9375rem]">
            <thead>
              <tr className="border-b-2 border-ink/90">
                <th className="px-4 py-2.5 font-semibold">What happens</th>
                <th className="px-4 py-2.5 text-right font-semibold">Points</th>
                <th className="px-4 py-2.5 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map(([a, p, d]) => (
                <tr key={a} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{a}</td>
                  <td className={`px-4 py-2.5 text-right font-display text-lg font-bold tnum ${p.startsWith("+") ? "text-leaf" : "text-coral"}`}>{p}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Known limit: a person can create several wallets and build score in friendly circles. Scores weigh bigger circles more, but identity checks are the real fix and are not built yet.
          {addresses.registry && <> Registry: <span className="tnum">{shortAddr(addresses.registry)}</span>.</>}
        </p>
      </section>
    </div>
  );
}
