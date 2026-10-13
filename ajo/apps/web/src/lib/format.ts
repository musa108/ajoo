import { formatUnits, type Address } from "viem";
import { TOKEN_DECIMALS } from "./config";

export function usd(amount: bigint | number | undefined, opts: { cents?: boolean } = {}): string {
  if (amount === undefined) return "$0";
  const n = Number(formatUnits(BigInt(amount), TOKEN_DECIMALS));
  const hasCents = Math.abs(n - Math.round(n)) > 1e-9;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents || hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export const shortAddr = (a: Address | string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function periodLabel(sec: number): string {
  if (sec === 86_400) return "day";
  if (sec === 7 * 86_400) return "week";
  if (sec === 14 * 86_400) return "two weeks";
  if (sec === 30 * 86_400) return "month";
  if (sec % 3600 === 0) return `${sec / 3600} hours`;
  if (sec % 60 === 0) return `${sec / 60} minutes`;
  return `${sec} seconds`;
}

export function duration(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Plain-language summary of a circle's terms, used on the create form and the circle page. */
export function termsSentence(p: { members: number; contribution: bigint; periodSec: number; depositMultiple: number }): string {
  const pot = p.contribution * BigInt(p.members);
  const every = periodLabel(p.periodSec);
  const dep = p.depositMultiple
    ? ` Each person locks a ${usd(p.contribution * BigInt(p.depositMultiple))} deposit, returned when the circle ends.`
    : " There is no deposit, so a missed payment is not covered.";
  return `${p.members} people put in ${usd(p.contribution)} every ${every}. Someone takes home ${usd(pot)} each time.${dep}`;
}
