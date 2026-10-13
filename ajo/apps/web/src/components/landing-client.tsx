"use client";

import { useState } from "react";
import { Ring, type Seat } from "./ring";
import { Ledger, LedgerLegend } from "./ledger";

const NAMES = ["Ada", "Tunde", "Ngozi", "Musa", "Bisi"];
const SEATS: Seat[] = NAMES.map((n) => ({ key: n, seed: n, status: "paid", label: n }));

/** The hero: a live circle. The pot passes to the next person every few seconds (static for reduced motion). */
export function HeroRing() {
  const [i, setI] = useState(0);
  return (
    <div className="rounded-panel border-2 border-ink bg-surface p-5 shadow-[8px_8px_0_0_#101437] sm:p-7">
      <Ring seats={SEATS} recipient={0} pot="$25" autoplay onRecipient={setI} className="mx-auto w-full max-w-[25rem]" />
      <div className="mt-3 text-center" aria-live="off">
        <p className="font-display text-2xl font-bold tracking-tight">
          {NAMES[i]} takes home <span className="tnum">$25</span>
        </p>
        <p className="mt-0.5 text-[0.9375rem] text-ink-soft">5 people · $5 each · every week</p>
      </div>
    </div>
  );
}

const A = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
] as const;

/** An illustrative circle, three cycles in. Not live data. */
export function SampleLedger() {
  return (
    <div>
      <Ledger
        members={[...A]}
        order={[...A]}
        scores={[130, 90, 80, 20, 110]}
        settled={2}
        active
        matrix={[
          [1, 1, 1, 0, 0],
          [1, 1, 1, 0, 0],
          [1, 1, 0, 0, 0],
          [1, 3, 0, 0, 0],
          [1, 1, 2, 0, 0],
        ]}
      />
      <LedgerLegend />
      <p className="mt-3 text-sm text-ink-soft">An example circle, three cycles in. The fourth member missed cycle 2 and their deposit covered it.</p>
    </div>
  );
}
