import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Logo } from "@/components/logo";
import { HeroRing, SampleLedger } from "@/components/landing-client";
import { button } from "@/components/ui/button";
import { REPO_URL, DEMO_VIDEO_URL, HACKATHON } from "@/lib/config";

const STEPS = [
  { t: "Gather", d: "Pick the amount, the people, and how often. Everyone locks a small deposit when they join, and gets it back at the end." },
  { t: "Pay each cycle", d: "Pay your share before the deadline. The contract holds it. Nobody, including the organizer, can touch it." },
  { t: "Take your turn", d: "When everyone has paid, the pot goes to that cycle's person. If someone misses, their deposit covers it and the pot stays whole." },
];

const SCORE = [
  ["Pay on time", "+10"],
  ["Pay late, inside the grace period", "-5"],
  ["Miss, covered by your deposit", "-60"],
  ["Finish a circle with no misses", "+50"],
  ["Repay a loan", "+25"],
] as const;

export default function Landing() {
  return (
    <>
      <a href="#how" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:font-semibold focus:text-white">
        Skip to how it works
      </a>

      {/* ------------------------------------------------------------ hero */}
      <div className="bg-marigold pt-[env(safe-area-inset-top)]">
        <header className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav aria-label="Page" className="hidden items-center gap-1 md:flex">
            {[
              ["How it works", "#how"],
              ["Your record", "#record"],
              ["Safety", "#safety"],
            ].map(([l, h]) => (
              <a key={h} href={h} className="inline-flex min-h-11 items-center rounded-full px-4 font-semibold hover:bg-marigold-tint">
                {l}
              </a>
            ))}
          </nav>
          <Link href="/circles" className={button({ variant: "outline" })}>
            Open the app
          </Link>
        </header>
      </div>

      <main>
      <section className="border-b-2 border-ink bg-marigold" aria-label="Introduction">
        <div className="mx-auto grid max-w-page items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-14">
          <div>
            <h1 className="text-hero text-balance">Save together. Get paid in turn.</h1>
            <p className="mt-6 max-w-xl text-xl leading-snug text-ink/85 text-pretty">
              Ajo is the savings circle you already know, with the pot held by a contract instead of a person. Everyone pays in each round, one person takes it all, and every on-time payment builds a record that follows you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/circles/new" className={button({ variant: "primary", size: "lg" })}>
                Start a circle
              </Link>
              <Link href="/circles" className={button({ variant: "outline", size: "lg" })}>
                See live circles
              </Link>
            </div>
            <p className="mt-5 text-[0.9375rem] text-ink/80">Built for {HACKATHON}, onchain finance track. Runs on test dollars while in demo.</p>
          </div>
          <HeroRing />
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section id="how" className="mx-auto max-w-page px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="how-h">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <h2 id="how-h" className="text-h2 text-balance">
              The organizer's notebook, kept on-chain
            </h2>
            <p className="mt-4 text-ink-soft text-pretty">
              Every circle has a notebook where someone ticks who paid and whose turn it is. That person holds the money, and everyone trusts them. Ajo keeps the same notebook in a contract that everyone can read and nobody can edit.
            </p>
            <ol className="mt-8 space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-marigold font-display text-lg font-extrabold tnum" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <h3>{s.t}</h3>
                    <p className="mt-1 text-ink-soft text-pretty">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0 self-center">
            <SampleLedger />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ record */}
      <section id="record" className="border-y-2 border-ink bg-cobalt-tint" aria-labelledby="record-h">
        <div className="mx-auto grid max-w-page gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <h2 id="record-h" className="text-h2 text-balance">
              A record that belongs to you
            </h2>
            <p className="mt-4 max-w-lg text-ink-soft text-pretty">
              Paying on time in a circle earns points. The score lives on-chain, tied to your wallet. It cannot be edited, bought, or sold, and you take it to every circle you join. Past 400, you can borrow small amounts against it.
            </p>
            <Link href="/credit" className={`${button({ variant: "primary" })} mt-7`}>
              See how credit works
            </Link>
          </div>
          <div className="self-center overflow-hidden rounded-card border-2 border-ink bg-surface">
            <table className="w-full text-left text-[0.9375rem]">
              <caption className="sr-only">Points for each action</caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    What you do
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCORE.map(([a, p]) => (
                  <tr key={a} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-3">{a}</td>
                    <td className={`px-4 py-3 text-right font-display text-xl font-bold tnum ${p.startsWith("+") ? "text-leaf" : "text-coral"}`}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ safety */}
      <section id="safety" className="mx-auto max-w-page px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="safety-h">
        <h2 id="safety-h" className="text-h2 max-w-2xl text-balance">
          What the contract does, and what it cannot
        </h2>
        <p className="mt-4 max-w-2xl text-ink-soft">We would rather you know the limits before you join.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-panel border-2 border-ink bg-leaf-tint p-6 sm:p-8">
            <h3 className="text-2xl">It guarantees</h3>
            <ul className="mt-4 space-y-3">
              {[
                "The pot is held by the contract, not by a person who can run off with it.",
                "The terms are fixed when the circle is created. Nobody can change them later.",
                "The pot is paid out by code the moment a cycle settles.",
                "The organizer cannot touch member funds, only cancel a circle that has not started.",
                "Reputation scores can only change by the published rules.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-leaf" strokeWidth={3} aria-hidden />
                  <span className="text-pretty">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-panel border-2 border-ink bg-coral-tint p-6 sm:p-8">
            <h3 className="text-2xl">It cannot</h3>
            <ul className="mt-4 space-y-3">
              {[
                "Fully stop someone who has been paid early from walking away. Deposits cover part of it, and putting trusted people first lowers the risk.",
                "Prove that one person is not several wallets. Score farming is possible until identity checks exist.",
                "Move naira. There is no bank on-ramp yet, and this demo uses test dollars.",
                "Promise safe code. The contracts are tested but not audited. Ajo is a prototype, not a regulated financial service.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Minus className="mt-1 h-5 w-5 shrink-0 text-coral" strokeWidth={3} aria-hidden />
                  <span className="text-pretty">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ closing */}
      <section className="border-t-2 border-ink bg-marigold-tint" aria-labelledby="cta-h">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-6 px-4 py-16 sm:px-6">
          <h2 id="cta-h" className="text-h2 max-w-xl text-balance">
            Start the circle your group has been talking about
          </h2>
          <Link href="/circles/new" className={button({ variant: "primary", size: "lg" })}>
            Start a circle
          </Link>
        </div>
      </section>

      </main>

      <footer className="border-t-2 border-ink bg-surface">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-8 text-[0.9375rem] sm:px-6">
          <Logo />
          <ul className="flex flex-wrap gap-x-5 gap-y-1 font-semibold">
            <li>
              <Link href="/circles" className="inline-flex min-h-11 items-center hover:underline">
                Circles
              </Link>
            </li>
            <li>
              <Link href="/credit" className="inline-flex min-h-11 items-center hover:underline">
                Credit
              </Link>
            </li>
            {REPO_URL && (
              <li>
                <a href={REPO_URL} className="inline-flex min-h-11 items-center hover:underline" rel="noreferrer">
                  Source code
                </a>
              </li>
            )}
            {DEMO_VIDEO_URL && (
              <li>
                <a href={DEMO_VIDEO_URL} className="inline-flex min-h-11 items-center hover:underline" rel="noreferrer">
                  Demo video
                </a>
              </li>
            )}
          </ul>
          <p className="w-full text-ink-soft">Built for {HACKATHON}. A prototype on test dollars. Not audited, not a regulated financial service.</p>
        </div>
      </footer>
    </>
  );
}
