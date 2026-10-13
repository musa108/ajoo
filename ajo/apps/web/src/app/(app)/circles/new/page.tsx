"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ajoFactoryAbi } from "@ajo/abi";
import { Field, TextInput, Select, Choice } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addresses, PERIOD_OPTIONS } from "@/lib/config";
import { termsSentence, usd } from "@/lib/format";
import { useTx } from "@/lib/tx";
import { usePc } from "@/lib/hooks";
import { parseUnits } from "viem";
import { TOKEN_DECIMALS } from "@/lib/config";
import { Ring, type Seat } from "@/components/ring";

type Form = {
  name: string;
  amount: string;
  members: string;
  period: string;
  order: "0" | "1";
  deposit: "0" | "1" | "2";
  minScore: string;
  joinDays: string;
};

const INITIAL: Form = { name: "", amount: "5", members: "5", period: "1", order: "0", deposit: "1", minScore: "", joinDays: "7" };

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  const name = f.name.trim();
  if (!name) e.name = "Give the circle a name so members recognise it.";
  else if (name.length > 48) e.name = "Use 48 characters or fewer.";

  if (!/^\d+(\.\d{1,2})?$/.test(f.amount) || Number(f.amount) <= 0) e.amount = "Enter an amount like 5 or 12.50.";
  else if (Number(f.amount) > 10_000) e.amount = "The most a circle can take per cycle is $10,000.";

  const m = Number(f.members);
  if (!Number.isInteger(m) || m < 2 || m > 12) e.members = "A circle needs between 2 and 12 people.";

  if (f.minScore !== "") {
    const s = Number(f.minScore);
    if (!Number.isInteger(s) || s < 0 || s > 1000) e.minScore = "Use a whole number from 0 to 1000, or leave it empty.";
  }
  return e;
}

export default function NewCirclePage() {
  const router = useRouter();
  const { address: me } = useAccount();
  const pc = usePc();
  const { run, busy } = useTx();
  const [f, setF] = useState<Form>(INITIAL);
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const errors = useMemo(() => validate(f), [f]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const blur = (k: keyof Form) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k: keyof Form) => (touched[k] ? errors[k] : undefined);

  const members = Math.min(12, Math.max(2, Number(f.members) || 2));
  const contribution = /^\d+(\.\d{1,2})?$/.test(f.amount) ? parseUnits(f.amount, TOKEN_DECIMALS) : 0n;
  const period = PERIOD_OPTIONS[Number(f.period)] ?? PERIOD_OPTIONS[0];

  const preview: Seat[] = Array.from({ length: members }, (_, i) => ({ key: String(i), seed: `seat-${i}`, text: String(i + 1), status: "pending", label: `Seat ${i + 1}` }));

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const all = Object.fromEntries(Object.keys(f).map((k) => [k, true])) as Record<keyof Form, boolean>;
    setTouched(all);
    const first = (Object.keys(errors) as (keyof Form)[])[0];
    if (first) {
      (ev.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    if (!addresses.factory || !addresses.token) return;

    const block = await pc.getBlock();
    const joinDeadline = block.timestamp + BigInt(Number(f.joinDays) * 86_400);
    const ok = await run("Create circle", "Circle created", {
      address: addresses.factory,
      abi: ajoFactoryAbi,
      functionName: "createCircle",
      args: [
        {
          name: f.name.trim(),
          token: addresses.token,
          contribution,
          period: period.seconds,
          grace: period.grace,
          maxMembers: members,
          depositMultiple: Number(f.deposit),
          orderMode: Number(f.order),
          joinDeadline,
          minScore: f.minScore === "" ? 0 : Number(f.minScore),
          organizer: "0x0000000000000000000000000000000000000000",
        },
      ],
    });
    if (ok && me) {
      const mine = await pc.readContract({ address: addresses.factory, abi: ajoFactoryAbi, functionName: "circlesOfOrganizer", args: [me] });
      const last = mine[mine.length - 1];
      if (last) router.push(`/circles/${last}?new=1`);
    }
  }

  return (
    <div>
      <h1 className="text-h2">Start a circle</h1>
      <p className="mt-2 max-w-xl text-ink-soft">Set the terms once. The contract enforces them, and nobody, including you, can change them afterwards.</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <form noValidate onSubmit={submit} className="space-y-8">
          <section className="space-y-5" aria-labelledby="g-basics">
            <h2 id="g-basics" className="text-xl font-bold">
              The basics
            </h2>
            <Field label="Circle name" required error={err("name")}>
              {({ id, describedBy, invalid }) => (
                <TextInput id={id} name="name" aria-describedby={describedBy} invalid={invalid} value={f.name} maxLength={60} autoComplete="off" placeholder="e.g. Balogun Market Women" onChange={(e) => set("name", e.target.value)} onBlur={blur("name")} />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Each person pays (USD)" required error={err("amount")} helper="Per cycle.">
                {({ id, describedBy, invalid }) => (
                  <TextInput id={id} name="amount" aria-describedby={describedBy} invalid={invalid} value={f.amount} inputMode="decimal" autoComplete="off" onChange={(e) => set("amount", e.target.value)} onBlur={blur("amount")} />
                )}
              </Field>
              <Field label="Number of people" required error={err("members")} helper="2 to 12. Everyone takes one turn.">
                {({ id, describedBy, invalid }) => (
                  <Select id={id} name="members" aria-describedby={describedBy} invalid={invalid} value={f.members} onChange={(e) => set("members", e.target.value)} onBlur={blur("members")}>
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n} people
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="How often" required>
              {({ id }) => (
                <Select id={id} name="period" value={f.period} onChange={(e) => set("period", e.target.value)}>
                  {PERIOD_OPTIONS.map((p, i) => (
                    <option key={p.label} value={i}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </section>

          <section className="space-y-5" aria-labelledby="g-safety">
            <h2 id="g-safety" className="text-xl font-bold">
              Protection
            </h2>
            <Choice
              legend="Safety deposit"
              name="deposit"
              value={f.deposit}
              onChange={(v) => set("deposit", v)}
              options={[
                { value: "1", title: "One payment", note: "Covers one missed cycle. Returned in full if you never miss." },
                { value: "2", title: "Two payments", note: "Covers two missed cycles. Better for people who have not saved together before." },
                { value: "0", title: "No deposit", note: "Easiest to join, but a missed payment makes the pot smaller for everyone." },
              ]}
            />
            <Choice
              legend="Who gets the pot first"
              name="order"
              value={f.order}
              onChange={(v) => set("order", v)}
              options={[
                { value: "0", title: "In the order people join", note: "Simple and predictable." },
                { value: "1", title: "Highest reputation first", note: "People with a better record go earlier. Newcomers go later." },
              ]}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Minimum score to join" optional error={err("minScore")} helper="0 to 1000. Leave empty for anyone.">
                {({ id, describedBy, invalid }) => (
                  <TextInput id={id} name="minScore" aria-describedby={describedBy} invalid={invalid} value={f.minScore} inputMode="numeric" autoComplete="off" onChange={(e) => set("minScore", e.target.value)} onBlur={blur("minScore")} />
                )}
              </Field>
              <Field label="People can join for" required>
                {({ id }) => (
                  <Select id={id} name="joinDays" value={f.joinDays} onChange={(e) => set("joinDays", e.target.value)}>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </Select>
                )}
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4 border-t-2 border-ink/90 pt-6">
            <Button type="submit" size="lg" loading={busy} disabled={!addresses.factory}>
              Create circle
            </Button>
            <p className="max-w-sm text-sm text-ink-soft">You sign one transaction. You join the circle as a member in a second step.</p>
          </div>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Preview">
          <div className="rounded-panel border-2 border-ink/90 bg-marigold-tint p-5">
            <Ring seats={preview} recipient={0} pot={usd(contribution * BigInt(members))} className="mx-auto w-full max-w-[20rem]" />
            <p className="mt-3 text-center text-[0.9375rem] leading-snug text-pretty" aria-live="polite">
              {contribution > 0n ? termsSentence({ members, contribution, periodSec: period.seconds, depositMultiple: Number(f.deposit) }) : "Enter an amount to see how the circle works."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
