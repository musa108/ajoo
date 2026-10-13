"use client";

import { useEffect, useState } from "react";
import { fillFor, initials } from "./avatar";

export type SeatStatus = "paid" | "late" | "covered" | "missed" | "pending" | "empty";
export type Seat = { key: string; seed: string; status: SeatStatus; you?: boolean; label: string; text?: string };

const STATUS_TEXT: Record<SeatStatus, string> = {
  paid: "paid on time",
  late: "paid late",
  covered: "missed, covered by deposit",
  missed: "missed",
  pending: "has not paid yet",
  empty: "empty seat",
};

const C = 220;
const R = 150;

function pos(i: number, n: number, r = R) {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function Badge({ status, x, y }: { status: SeatStatus; x: number; y: number }) {
  if (status === "pending" || status === "empty") return null;
  const fill = status === "paid" ? "#0B7A4D" : status === "late" ? "#7A4E00" : status === "covered" ? "#7A4E00" : "#C7301F";
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="12" fill={fill} stroke="#fff" strokeWidth="3" />
      {(status === "paid" || status === "late") && <path d="M-5 0.5 L-1.5 4 L5 -3.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
      {status === "covered" && <path d="M0 -6 A6 6 0 0 1 0 6 Z" fill="#fff" />}
      {status === "missed" && <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />}
    </g>
  );
}

/**
 * The pot and the people around it. `recipient` is the seat index receiving the pot this round.
 * With `autoplay` the pot moves to the next seat every few seconds (landing page only, and never when the
 * visitor prefers reduced motion).
 */
export function Ring({
  seats,
  recipient,
  pot,
  autoplay = false,
  onRecipient,
  className,
}: {
  seats: Seat[];
  recipient: number;
  pot: string;
  autoplay?: boolean;
  onRecipient?: (i: number) => void;
  className?: string;
}) {
  const n = seats.length;
  const [active, setActive] = useState(recipient);

  useEffect(() => setActive(recipient), [recipient]);

  useEffect(() => {
    if (!autoplay || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), 3200);
    return () => clearInterval(t);
  }, [autoplay, n]);

  useEffect(() => {
    onRecipient?.(active);
  }, [active, onRecipient]);

  const seatR = Math.min(38, ((Math.PI * R) / Math.max(n, 3)) * 0.8);
  const target = pos(active, n, R - seatR - 6);
  const coinT = { x: target.x - C, y: target.y - C };

  return (
    <svg viewBox="0 0 440 440" role="img" aria-label={`A circle of ${n} people. The pot of ${pot} goes to seat ${active + 1} this round.`} className={className}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#101437" strokeOpacity="0.9" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      {/* link from the pot to whoever receives it */}
      <line x1={C} y1={C} x2={pos(active, n, R - seatR).x} y2={pos(active, n, R - seatR).y} stroke="#101437" strokeWidth="3" strokeLinecap="round" style={{ transition: "all 700ms var(--ease-out)" }} />
      <circle cx={C} cy={C} r="68" fill="#FFC933" stroke="#101437" strokeWidth="3" />
      <text x={C} y={C - 2} textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="34" fill="#101437" style={{ fontVariantNumeric: "tabular-nums" }}>
        {pot}
      </text>
      <text x={C} y={C + 24} textAnchor="middle" fontFamily="var(--font-body)" fontWeight="600" fontSize="15" fill="#101437">
        the pot
      </text>

      {seats.map((s, i) => {
        const p = pos(i, n);
        const isRecipient = i === active;
        return (
          <g key={s.key}>
            <title>{`${s.label}${s.you ? " (you)" : ""}: ${isRecipient ? "receives the pot, " : ""}${STATUS_TEXT[s.status]}`}</title>
            <circle
              cx={p.x}
              cy={p.y}
              r={seatR}
              fill={s.status === "empty" ? "#FFFFFF" : isRecipient ? "#FFC933" : fillFor(s.seed)}
              stroke="#101437"
              strokeWidth={isRecipient ? 4 : 2.5}
              strokeDasharray={s.status === "empty" ? "5 5" : undefined}
              style={{ transition: "fill 400ms var(--ease-out), stroke-width 400ms var(--ease-out)" }}
            />
            {s.status !== "empty" && (
              <text x={p.x} y={p.y + seatR * 0.14} textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize={Math.max(14, seatR * 0.5)} fill="#101437" style={{ fontVariantNumeric: "tabular-nums" }}>
                {s.text ?? initials(s.seed)}
              </text>
            )}
            <Badge status={s.status} x={p.x + seatR * 0.72} y={p.y + seatR * 0.72} />
            {s.you && <circle cx={p.x} cy={p.y} r={seatR + 7} fill="none" stroke="#2540E8" strokeWidth="3" />}
          </g>
        );
      })}

      {/* the coin that travels from the pot to the recipient */}
      <g style={{ transform: `translate(${coinT.x}px, ${coinT.y}px)`, transition: "transform 800ms var(--ease-out)" }}>
        <circle cx={C} cy={C} r="15" fill="#FFFFFF" stroke="#101437" strokeWidth="3" />
        <text x={C} y={C + 5.5} textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="16" fill="#101437">
          $
        </text>
      </g>
    </svg>
  );
}
