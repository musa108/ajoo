/**
 * Pure decision logic for the keeper. No network, no clock: everything is passed in so it can be unit tested.
 * The contracts enforce every rule on-chain; the keeper only decides *when* to nudge them.
 */

export const STATE = { Open: 0, Active: 1, Completed: 2, Cancelled: 3 } as const;
export const STATUS_NONE = 0;

export interface MemberSnap {
  address: `0x${string}`;
  /** CycleStatus of this member for the cycle currently being collected (0 = not paid yet) */
  status: number;
}

export interface CircleSnap {
  address: `0x${string}`;
  name: string;
  state: number;
  canSettle: boolean;
  joinDeadline: number;
  memberCount: number;
  settledCycles: number;
  currentCycleStart: number;
  period: number;
  grace: number;
  members: MemberSnap[];
}

export type Action =
  | { kind: "settle"; circle: `0x${string}`; name: string; cycle: number }
  | { kind: "cancel"; circle: `0x${string}`; name: string }
  | { kind: "remind"; circle: `0x${string}`; name: string; cycle: number; member: `0x${string}`; late: boolean; deadline: number };

export function planCircle(s: CircleSnap, now: number, remindBeforeSec: number): Action[] {
  const out: Action[] = [];

  // A circle that never filled can be cancelled by anyone once the join deadline passes, which unlocks refunds.
  if (s.state === STATE.Open && s.memberCount > 0 && now > s.joinDeadline) {
    out.push({ kind: "cancel", circle: s.address, name: s.name });
    return out;
  }

  if (s.state !== STATE.Active) return out;

  if (s.canSettle) {
    out.push({ kind: "settle", circle: s.address, name: s.name, cycle: s.settledCycles });
    return out;
  }

  const end = s.currentCycleStart + s.period;
  const inWindow = now >= end - remindBeforeSec && now <= end + s.grace && now >= s.currentCycleStart;
  if (inWindow) {
    const late = now > end;
    for (const m of s.members) {
      if (m.status === STATUS_NONE) {
        out.push({ kind: "remind", circle: s.address, name: s.name, cycle: s.settledCycles, member: m.address, late, deadline: end });
      }
    }
  }
  return out;
}

export function reminderKey(a: Extract<Action, { kind: "remind" }>): string {
  return `${a.circle}:${a.cycle}:${a.member}:${a.late ? "late" : "soon"}`;
}

export function describe(a: Action): string {
  switch (a.kind) {
    case "settle":
      return `settle cycle ${a.cycle + 1} of "${a.name}"`;
    case "cancel":
      return `cancel unfilled circle "${a.name}" so deposits can be refunded`;
    case "remind":
      return `${a.late ? "LATE" : "due soon"}: ${a.member} has not paid cycle ${a.cycle + 1} of "${a.name}"`;
  }
}
