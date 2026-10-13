import { test } from "node:test";
import assert from "node:assert/strict";
import { planCircle, reminderKey, type CircleSnap } from "../src/plan.js";

const A = "0x00000000000000000000000000000000000000a1" as const;
const B = "0x00000000000000000000000000000000000000b2" as const;
const C = "0x00000000000000000000000000000000000000c3" as const;

const base: CircleSnap = {
  address: C,
  name: "Test",
  state: 1,
  canSettle: false,
  joinDeadline: 0,
  memberCount: 2,
  settledCycles: 0,
  currentCycleStart: 1_000,
  period: 86_400,
  grace: 7_200,
  members: [
    { address: A, status: 1 },
    { address: B, status: 0 },
  ],
};

test("settles when the contract says it can", () => {
  const a = planCircle({ ...base, canSettle: true }, 2_000, 3_600);
  assert.deepEqual(a.map((x) => x.kind), ["settle"]);
});

test("no reminders early in the cycle", () => {
  assert.equal(planCircle(base, 2_000, 3_600).length, 0);
});

test("reminds only members who have not paid, inside the window", () => {
  const end = base.currentCycleStart + base.period;
  const a = planCircle(base, end - 1_800, 3_600);
  assert.equal(a.length, 1);
  assert.equal(a[0].kind, "remind");
  assert.equal((a[0] as { member: string }).member, B);
  assert.equal((a[0] as { late: boolean }).late, false);
});

test("marks reminders as late once the deadline has passed", () => {
  const end = base.currentCycleStart + base.period;
  const a = planCircle(base, end + 60, 3_600);
  assert.equal((a[0] as { late: boolean }).late, true);
});

test("late and soon reminders have different dedupe keys", () => {
  const end = base.currentCycleStart + base.period;
  const soon = planCircle(base, end - 60, 3_600)[0];
  const late = planCircle(base, end + 60, 3_600)[0];
  assert.notEqual(reminderKey(soon as never), reminderKey(late as never));
});

test("nothing after grace expires except settle", () => {
  const end = base.currentCycleStart + base.period;
  assert.equal(planCircle(base, end + base.grace + 1, 3_600).length, 0);
});

test("cancels an unfilled circle after the join deadline", () => {
  const a = planCircle({ ...base, state: 0, joinDeadline: 500 }, 600, 3_600);
  assert.deepEqual(a.map((x) => x.kind), ["cancel"]);
});

test("does not cancel an empty circle or one still within the deadline", () => {
  assert.equal(planCircle({ ...base, state: 0, joinDeadline: 500, memberCount: 0 }, 600, 3_600).length, 0);
  assert.equal(planCircle({ ...base, state: 0, joinDeadline: 900 }, 600, 3_600).length, 0);
});

test("completed and cancelled circles are ignored", () => {
  assert.equal(planCircle({ ...base, state: 2 }, 5_000, 3_600).length, 0);
  assert.equal(planCircle({ ...base, state: 3 }, 5_000, 3_600).length, 0);
});
