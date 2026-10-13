"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { creditPoolAbi, mockUSDAbi } from "@ajo/abi";
import { useCredit } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { addresses, TOKEN_DECIMALS, isMockToken } from "@/lib/config";
import { duration, usd } from "@/lib/format";
import { Field, TextInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Countdown, EmptyState, Skeleton } from "@/components/small";
import { WalletButton } from "@/components/wallet";
import { useChainNow } from "@/lib/hooks";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/cn";

function parseAmount(v: string): bigint | null {
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) return null;
  const n = parseUnits(v.trim(), TOKEN_DECIMALS);
  return n > 0n ? n : null;
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4 rounded-panel border-2 border-ink/90 bg-surface p-5 sm:p-6", className)}>
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Borrow({ d }: { d: NonNullable<ReturnType<typeof useCredit>["data"]> }) {
  const { run, pending, busy } = useTx();
  const now = useChainNow();
  const [amt, setAmt] = useState("");
  const [touched, setTouched] = useState(false);
  const mine = d.mine!;
  const pool = addresses.creditPool!;
  const loan = mine.loan;

  const parsed = parseAmount(amt);
  const max = mine.limit < d.idle ? mine.limit : d.idle;
  const error = !touched
    ? undefined
    : !parsed
      ? "Enter an amount like 25 or 12.50."
      : parsed > mine.limit
        ? `Your limit is ${usd(mine.limit)}.`
        : parsed > d.idle
          ? `The pool only has ${usd(d.idle)} free right now.`
          : undefined;

  if (mine.score < d.minScore) {
    return (
      <Panel title="Borrow">
        <p className="text-ink-soft">
          Your score is <span className="font-semibold text-ink tnum">{mine.score}</span>. Loans unlock at <span className="font-semibold text-ink tnum">{d.minScore}</span>.
        </p>
        <p className="text-[0.9375rem] text-ink-soft">Pay on time and finish circles to build it. There is no way to buy a score.</p>
        <Link href="/circles" className="inline-block font-semibold text-cobalt-press underline underline-offset-4">
          Find a circle to join
        </Link>
      </Panel>
    );
  }

  if (loan.open) {
    const repayAmt = parseAmount(amt) ?? mine.owed;
    const needsApproval = mine.allowance < repayAmt;
    const overdue = now > 0 && now > loan.due;
    return (
      <Panel title="Your loan">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border-2 border-ink/90 bg-ink/90 text-sm">
          <div className="bg-surface p-3">
            <dt className="text-ink-soft">You owe</dt>
            <dd className="font-display text-2xl font-bold tnum">{usd(mine.owed, { cents: true })}</dd>
          </div>
          <div className="bg-surface p-3">
            <dt className="text-ink-soft">{overdue ? "Overdue by" : "Due in"}</dt>
            <dd className="font-display text-2xl font-bold tnum">{overdue ? duration(now - loan.due) : <Countdown to={loan.due} />}</dd>
          </div>
        </dl>
        {overdue && (
          <p className="flex items-start gap-2 rounded-field bg-coral-tint p-3 text-[0.9375rem]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden />
            Repay now. After the grace period of {duration(d.grace)} anyone can write this loan off, which costs 300 score points.
          </p>
        )}
        <Field label="Repay amount (USD)" helper={`Leave empty to repay everything: ${usd(mine.owed, { cents: true })}.`} error={touched && amt && !parsed ? "Enter an amount like 25 or 12.50." : undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} onBlur={() => setTouched(true)} />
          )}
        </Field>
        {mine.balance < repayAmt && <p className="text-sm font-medium text-coral">Your wallet has {usd(mine.balance, { cents: true })}.{isMockToken && " Use “Get 1,000 test dollars” in the menu above."}</p>}
        {needsApproval ? (
          <Button size="lg" className="w-full" loading={pending === "Approve repayment"} disabled={busy} onClick={() => run("Approve repayment", "Approved", { address: addresses.token!, abi: mockUSDAbi, functionName: "approve", args: [pool, repayAmt] })}>
            Approve {usd(repayAmt, { cents: true })}
          </Button>
        ) : (
          <Button size="lg" variant="pot" className="w-full" loading={pending === "Repay"} disabled={busy || mine.balance < repayAmt} onClick={() => run("Repay", "Repayment received", { address: pool, abi: creditPoolAbi, functionName: "repay", args: [repayAmt] }).then((ok) => ok && setAmt(""))}>
            Repay {usd(repayAmt, { cents: true })}
          </Button>
        )}
      </Panel>
    );
  }

  const fee = parsed ? (parsed * BigInt(d.feeBps)) / 10_000n : 0n;
  return (
    <Panel title="Borrow">
      <p className="text-ink-soft">
        You can borrow up to <span className="font-display text-2xl font-bold text-ink tnum">{usd(mine.limit)}</span> at your score of <span className="font-semibold text-ink tnum">{mine.score}</span>.
      </p>
      <Field label="Amount (USD)" error={error} helper={`Up to ${usd(max)} right now.`}>
        {({ id, describedBy, invalid }) => (
          <div className="flex gap-2">
            <TextInput id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} onBlur={() => setTouched(true)} placeholder="0" />
            <Button type="button" variant="secondary" onClick={() => setAmt((Number(max) / 10 ** TOKEN_DECIMALS).toString())}>
              Max
            </Button>
          </div>
        )}
      </Field>
      {parsed && !error && (
        <p className="rounded-field bg-marigold-tint p-3 text-[0.9375rem]" aria-live="polite">
          A fee of {usd(fee, { cents: true })} ({d.feeBps / 100}%) applies. You repay <span className="font-semibold tnum">{usd(parsed + fee, { cents: true })}</span> within {duration(d.term)}.
        </p>
      )}
      <Button
        size="lg"
        variant="pot"
        className="w-full"
        loading={pending === "Borrow"}
        disabled={busy || mine.limit === 0n}
        onClick={() => {
          setTouched(true);
          if (!parsed || error) return;
          run("Borrow", `${usd(parsed)} sent to your wallet`, { address: pool, abi: creditPoolAbi, functionName: "borrow", args: [parsed] }).then((ok) => ok && setAmt(""));
        }}
      >
        {parsed ? `Borrow ${usd(parsed)}` : "Borrow"}
      </Button>
    </Panel>
  );
}

function Lend({ d }: { d: NonNullable<ReturnType<typeof useCredit>["data"]> }) {
  const { run, pending, busy } = useTx();
  const [sup, setSup] = useState("");
  const [wd, setWd] = useState("");
  const [touched, setTouched] = useState<{ s?: boolean; w?: boolean }>({});
  const mine = d.mine!;
  const pool = addresses.creditPool!;
  const ps = parseAmount(sup);
  const pw = parseAmount(wd);
  const needsApproval = ps !== null && mine.allowance < ps;
  const withdrawable = mine.supplied < d.idle ? mine.supplied : d.idle;

  const wdErr = !touched.w || !wd ? undefined : !pw ? "Enter an amount like 25." : pw > mine.supplied ? `You have ${usd(mine.supplied, { cents: true })} in the pool.` : pw > d.idle ? `Only ${usd(d.idle, { cents: true })} is free right now. The rest is out on loan.` : undefined;

  return (
    <Panel title="Lend">
      <p className="text-[0.9375rem] text-ink-soft">
        Lenders earn the fee borrowers pay. This is unsecured lending: if a borrower does not repay, <span className="font-semibold text-ink">lenders absorb the loss</span>. Only lend what you can afford to lose.
      </p>
      <p>
        You have <span className="font-display text-2xl font-bold tnum">{usd(mine.supplied, { cents: true })}</span> in the pool.
      </p>

      <Field label="Add to the pool (USD)" error={touched.s && sup && !ps ? "Enter an amount like 100." : undefined}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" value={sup} onChange={(e) => setSup(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, s: true }))} />
        )}
      </Field>
      {needsApproval ? (
        <Button className="w-full" loading={pending === "Approve deposit"} disabled={busy} onClick={() => run("Approve deposit", "Approved", { address: addresses.token!, abi: mockUSDAbi, functionName: "approve", args: [pool, ps!] })}>
          Approve {usd(ps!, { cents: true })}
        </Button>
      ) : (
        <Button className="w-full" disabled={busy || !ps || mine.balance < (ps ?? 0n)} loading={pending === "Add to pool"} onClick={() => run("Add to pool", `${usd(ps!, { cents: true })} added to the pool`, { address: pool, abi: creditPoolAbi, functionName: "supply", args: [ps!] }).then((ok) => ok && setSup(""))}>
          {ps ? `Add ${usd(ps, { cents: true })}` : "Add to pool"}
        </Button>
      )}

      <div className="border-t-2 border-line pt-4">
        <Field label="Take out (USD)" error={wdErr} helper={`You can take out up to ${usd(withdrawable, { cents: true })} right now.`}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} invalid={invalid} inputMode="decimal" value={wd} onChange={(e) => setWd(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, w: true }))} />
          )}
        </Field>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          loading={pending === "Take out"}
          disabled={busy || !pw || Boolean(wdErr) || mine.supplied === 0n}
          onClick={() => {
            // convert the dollar amount to pool shares at the lender's own share price
            const shares = mine.supplied > 0n ? (pw! * mine.shares) / mine.supplied : 0n;
            run("Take out", `${usd(pw!, { cents: true })} returned to your wallet`, { address: pool, abi: creditPoolAbi, functionName: "withdraw", args: [pw === mine.supplied ? mine.shares : shares] }).then((ok) => ok && setWd(""));
          }}
        >
          {pw ? `Take out ${usd(pw, { cents: true })}` : "Take out"}
        </Button>
      </div>
    </Panel>
  );
}

export default function CreditPage() {
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const q = useCredit();
  const d = q.data;

  const stats = useMemo(
    () =>
      d && [
        ["Free to borrow", usd(d.idle, { cents: true })],
        ["Out on loan", usd(d.loaned, { cents: true })],
        ["Fee per loan", `${d.feeBps / 100}%`],
        ["Time to repay", duration(d.term)],
        ["Loans unlock at score", String(d.minScore)],
        ["Credit per score point", usd(d.perPoint, { cents: true })],
      ],
    [d],
  );

  if (!addresses.creditPool) return <EmptyState title="Credit is not deployed on this network" body="The credit pool address is not configured. Deploy it with the Deploy script and set NEXT_PUBLIC_CREDIT_POOL_ADDRESS." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h2">Credit</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">Small loans from a shared pool, sized by your Ajo record. Repaying raises your score. Not repaying lowers it sharply.</p>
        <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-field bg-marigold-tint p-3 text-[0.9375rem]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-marigold-deep" aria-hidden />
          <span>Prototype. The pool lends without collateral, so lenders can lose money, and the contracts are not audited.</span>
        </p>
      </div>

      {q.isLoading || !d ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border-2 border-ink/90 bg-ink/90 md:grid-cols-3">
            {stats!.map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3.5">
                <dt className="text-sm text-ink-soft">{k}</dt>
                <dd className="mt-0.5 font-display text-xl font-bold tnum">{v}</dd>
              </div>
            ))}
          </dl>

          {!mounted || !isConnected || !d.mine ? (
            <EmptyState title="Connect to borrow or lend" body="Your credit limit comes from your wallet's record." action={<WalletButton />} />
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Borrow d={d} />
              <Lend d={d} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
