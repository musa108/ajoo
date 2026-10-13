"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import { useAccount } from "wagmi";
import { ArrowLeft, CheckCircle2, Info, PartyPopper } from "lucide-react";
import { ajoCircleAbi, mockUSDAbi } from "@ajo/abi";
import { useCircle, useChainNow } from "@/lib/hooks";
import { useTx } from "@/lib/tx";
import { isMockToken } from "@/lib/config";
import { periodLabel, shortAddr, termsSentence, usd, duration } from "@/lib/format";
import { Ring, type Seat, type SeatStatus } from "@/components/ring";
import { Ledger, LedgerLegend } from "@/components/ledger";
import { StateChip } from "@/components/state-chip";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CopyButton, Skeleton } from "@/components/small";
import { WalletButton } from "@/components/wallet";
import { cn } from "@/lib/cn";

type Data = NonNullable<ReturnType<typeof useCircle>["data"]>;

const SEAT_STATUS: SeatStatus[] = ["pending", "paid", "late", "covered", "missed"];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-panel border-2 border-ink/90 bg-surface p-5 sm:p-6", className)}>{children}</section>;
}

function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "good" }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-field p-3 text-[0.9375rem]", tone === "info" && "bg-cobalt-tint/70", tone === "warn" && "bg-marigold-tint", tone === "good" && "bg-leaf-tint")}>
      {tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

function Actions({ address, data, now }: { address: Address; data: Data; now: number }) {
  const { isConnected } = useAccount();
  const { run, pending, busy } = useTx();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const s = data.summary;
  const mine = data.mine;
  const call = (functionName: string) => ({ address, abi: ajoCircleAbi, functionName }) as const;
  const approve = (amount: bigint, label: string) =>
    run(label, "Approved", { address: s.token, abi: mockUSDAbi, functionName: "approve", args: [address, amount] });

  if (!isConnected || !mine) {
    return (
      <Panel>
        <h2 className="text-xl font-bold">Take part</h2>
        <p className="mt-1.5 text-ink-soft">Connect your wallet to join, pay, or collect.</p>
        <div className="mt-4">
          <WalletButton />
        </div>
      </Panel>
    );
  }

  const deposit = s.contribution * BigInt(s.depositMultiple);
  const end = s.currentCycleStart + s.period;
  const windowOpen = now >= s.currentCycleStart;
  const windowClosed = now > end + s.grace;
  const late = now > end;
  const paid = mine.paidThisCycle !== 0;
  const cyclesLeft = s.maxMembers - s.settledCycles;
  const recipient = data.order[s.settledCycles];

  const blocks: React.ReactNode[] = [];

  // ---------------------------------------------------------------- open
  if (s.state === 0) {
    if (!mine.joined) {
      const full = s.memberCount >= s.maxMembers;
      const past = now > s.joinDeadline;
      const lowScore = s.minScore > 0 && mine.score < s.minScore;
      const poor = mine.balance < deposit;
      const needsApproval = deposit > 0n && mine.allowance < deposit;
      blocks.push(
        <div key="join" className="space-y-4">
          <h2 className="text-xl font-bold">Join this circle</h2>
          <p className="text-ink-soft">
            You pay <span className="tnum font-semibold text-ink">{usd(s.contribution)}</span> every {periodLabel(s.period)}.{" "}
            {deposit > 0n ? <>Joining locks a <span className="tnum font-semibold text-ink">{usd(deposit)}</span> deposit, returned when the circle ends.</> : "There is no deposit."}
          </p>
          {full && <Note tone="warn">This circle is full.</Note>}
          {!full && past && <Note tone="warn">The joining deadline has passed.</Note>}
          {lowScore && <Note tone="warn">This circle needs a reputation score of {s.minScore}. Yours is {mine.score}. Finish a circle to raise it.</Note>}
          {!full && !past && !lowScore && poor && (
            <Note tone="warn">
              You need {usd(deposit)} in your wallet to join. You have {usd(mine.balance, { cents: true })}.
              {isMockToken && " Use “Get 1,000 test dollars” in the menu above."}
            </Note>
          )}
          {!full && !past && !lowScore && !poor && needsApproval && (
            <>
              <p className="text-sm font-semibold text-ink-soft">Step 1 of 2</p>
              <Button size="lg" className="w-full" loading={pending === "Approve deposit"} disabled={busy} onClick={() => approve(deposit, "Approve deposit")}>
                Approve {usd(deposit)} deposit
              </Button>
            </>
          )}
          {!full && !past && !lowScore && !poor && !needsApproval && (
            <>
              {deposit > 0n && <p className="text-sm font-semibold text-ink-soft">Step 2 of 2</p>}
              <Button size="lg" variant="pot" className="w-full" loading={pending === "Join circle"} disabled={busy} onClick={() => run("Join circle", "You joined the circle", call("join"))}>
                Join circle
              </Button>
            </>
          )}
        </div>,
      );
    } else {
      blocks.push(
        <div key="in" className="space-y-4">
          <h2 className="text-xl font-bold">You are in</h2>
          <Note tone="good">
            {s.maxMembers - s.memberCount === 0
              ? "The circle is full and starting."
              : `Waiting for ${s.maxMembers - s.memberCount} more ${s.maxMembers - s.memberCount === 1 ? "person" : "people"}. The first cycle starts the moment the last seat is filled.`}
          </Note>
          <Button variant="secondary" className="w-full" loading={pending === "Leave circle"} disabled={busy} onClick={() => run("Leave circle", "You left the circle and your deposit is back", call("leave"))}>
            Leave circle and take my deposit back
          </Button>
        </div>,
      );
    }
  }

  // ---------------------------------------------------------------- active
  if (s.state === 1) {
    if (!mine.joined) {
      blocks.push(
        <div key="watch" className="space-y-3">
          <h2 className="text-xl font-bold">Running</h2>
          <Note>This circle is full and in progress. You can follow every payment below.</Note>
        </div>,
      );
    } else {
      const needsApproval = mine.allowance < s.contribution;
      blocks.push(
        <div key="pay" className="space-y-4">
          <h2 className="text-xl font-bold">Cycle {s.settledCycles + 1} of {s.maxMembers}</h2>
          {recipient && (
            <p className="text-ink-soft">
              <span className="font-semibold text-ink tnum">{shortAddr(recipient)}</span> receives <span className="font-semibold text-ink tnum">{usd(s.contribution * BigInt(s.maxMembers))}</span> this cycle.
            </p>
          )}
          {paid ? (
            <Note tone="good">You paid {usd(s.contribution)} for this cycle. {mine.paidThisCycle === 2 ? "It was late, so it counted for less." : "Nothing more to do."}</Note>
          ) : !windowOpen ? (
            <Note>The next cycle opens in {duration(s.currentCycleStart - now)}. You can pay then.</Note>
          ) : windowClosed ? (
            <Note tone="warn">The payment window for this cycle has closed. Your deposit covers it when the cycle is settled.</Note>
          ) : (
            <>
              <Note tone={late ? "warn" : "info"}>
                {late ? `Late: ${duration(end + s.grace - now)} left in the grace period. Paying now costs a small reputation penalty.` : `Due in ${duration(end - now)}. Paying on time raises your score.`}
              </Note>
              {mine.balance < s.contribution && (
                <Note tone="warn">
                  Your wallet has {usd(mine.balance, { cents: true })}.{isMockToken && " Use “Get 1,000 test dollars” in the menu above."}
                </Note>
              )}
              {needsApproval ? (
                <>
                  <p className="text-sm font-semibold text-ink-soft">Step 1 of 2</p>
                  <Button size="lg" className="w-full" loading={pending === "Approve payments"} disabled={busy} onClick={() => approve(s.contribution * BigInt(cyclesLeft), "Approve payments")}>
                    Approve {usd(s.contribution * BigInt(cyclesLeft))} for this circle
                  </Button>
                </>
              ) : (
                <Button size="lg" variant="pot" className="w-full" loading={pending === "Pay"} disabled={busy || mine.balance < s.contribution} onClick={() => run("Pay", `Paid ${usd(s.contribution)}`, call("contribute"))}>
                  Pay {usd(s.contribution)}
                </Button>
              )}
            </>
          )}
        </div>,
      );
    }
    if (data.canSettle) {
      blocks.push(
        <div key="settle" className="space-y-2 border-t-2 border-line pt-4">
          <p className="text-[0.9375rem] text-ink-soft">
            {s.paidThisCycle === s.memberCount ? "Everyone has paid." : "The deadline has passed."} Anyone can settle the cycle and send the pot.
          </p>
          <Button variant="outline" className="w-full" loading={pending === "Settle cycle"} disabled={busy} onClick={() => run("Settle cycle", `Cycle ${s.settledCycles + 1} settled and the pot was sent`, call("settleCycle"))}>
            Settle cycle {s.settledCycles + 1}
          </Button>
        </div>,
      );
    }
  }

  // ---------------------------------------------------------------- finished / cancelled
  if (s.state === 2 || s.state === 3) {
    blocks.push(
      <div key="end" className="space-y-3">
        <h2 className="text-xl font-bold">{s.state === 2 ? "This circle is finished" : "This circle was cancelled"}</h2>
        {s.state === 2 && <Note tone="good">Everyone has had a turn. Records have been updated.</Note>}
        {mine.joined && mine.deposit > 0n && (
          <Button size="lg" variant="pot" className="w-full" loading={pending === "Take deposit back"} disabled={busy} onClick={() => run("Take deposit back", `${usd(mine.deposit)} returned to your wallet`, call("claimRefund"))}>
            Take {usd(mine.deposit)} deposit back
          </Button>
        )}
        {mine.joined && mine.deposit === 0n && mine.claimable === 0n && <p className="text-ink-soft">You have nothing left to claim here.</p>}
      </div>,
    );
  }

  if (mine.claimable > 0n) {
    blocks.push(
      <div key="claimable" className="space-y-2 border-t-2 border-line pt-4">
        <p className="text-[0.9375rem] text-ink-soft">{usd(mine.claimable)} is waiting for you because a direct payout could not be delivered.</p>
        <Button variant="pot" className="w-full" loading={pending === "Withdraw"} disabled={busy} onClick={() => run("Withdraw", `${usd(mine.claimable)} withdrawn`, call("withdraw"))}>
          Withdraw {usd(mine.claimable)}
        </Button>
      </div>,
    );
  }

  // cancel: organizer any time while open, anyone after the deadline
  const canCancel = s.state === 0 && (now > s.joinDeadline || mine.isOrganizer);
  if (canCancel) {
    blocks.push(
      <div key="cancel" className="border-t-2 border-line pt-4">
        <Button variant="danger" className="w-full" disabled={busy} onClick={() => setConfirmCancel(true)}>
          Cancel this circle
        </Button>
      </div>,
    );
  }

  return (
    <Panel className="space-y-5 shadow-[6px_6px_0_0_rgb(16_20_55)]">
      {blocks}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this circle?"
        body={
          <p>
            The circle closes for good. The {s.memberCount} {s.memberCount === 1 ? "person" : "people"} who joined can take their deposits back. This cannot be undone.
          </p>
        }
        confirmLabel="Cancel circle"
        keepLabel="Keep circle open"
        loading={pending === "Cancel circle"}
        onConfirm={async () => {
          const ok = await run("Cancel circle", "Circle cancelled. Members can take their deposits back.", call("cancel"));
          if (ok) setConfirmCancel(false);
        }}
      />
    </Panel>
  );
}

export default function CirclePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const valid = isAddress(address);
  return valid ? <CircleView address={address as Address} /> : (
    <div className="rounded-card border-2 border-coral/50 bg-coral-tint p-6">
      <h1 className="text-2xl">That is not a circle address</h1>
      <p className="mt-2">Check the link you were sent, or browse open circles.</p>
      <Link href="/circles" className="mt-4 inline-block font-semibold text-cobalt-press underline underline-offset-4">
        Back to circles
      </Link>
    </div>
  );
}

function CircleView({ address }: { address: Address }) {
  const { address: me } = useAccount();
  const q = useCircle(address);
  const now = useChainNow();
  const [fresh, setFresh] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setFresh(new URLSearchParams(window.location.search).get("new") === "1");
    setOrigin(window.location.origin);
  }, []);

  if (q.isLoading || !now) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div role="alert" className="rounded-card border-2 border-coral/50 bg-coral-tint p-6">
        <h1 className="text-2xl">Could not load this circle</h1>
        <p className="mt-2">It may not exist on this network, or the connection dropped.</p>
        <Button className="mt-4" variant="outline" onClick={() => q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = q.data;
  const s = data.summary;
  const n = s.maxMembers;
  const pot = s.contribution * BigInt(n);
  const active = s.state === 1;
  const col = s.state === 2 ? n - 1 : Math.min(s.settledCycles, n - 1);
  const idxOf = (m: Address) => data.members.findIndex((x) => x.toLowerCase() === m.toLowerCase());
  const isMe = (m: Address) => Boolean(me && m.toLowerCase() === me.toLowerCase());

  let seats: Seat[];
  let recipient = 0;
  if (s.state === 0 || s.state === 3) {
    seats = Array.from({ length: n }, (_, i) =>
      data.members[i]
        ? { key: data.members[i], seed: data.members[i], status: "pending" as const, you: isMe(data.members[i]), label: shortAddr(data.members[i]) }
        : { key: `empty-${i}`, seed: "", status: "empty" as const, label: `Seat ${i + 1}` },
    );
  } else {
    seats = data.order.map((m) => ({
      key: m,
      seed: m,
      status: SEAT_STATUS[data.ledger[idxOf(m)]?.[col] ?? 0],
      you: isMe(m),
      label: shortAddr(m),
    }));
    recipient = active ? s.settledCycles : n - 1;
  }

  const cycleEnd = s.currentCycleStart + s.period;
  const link = origin ? `${origin}/circles/${address}` : "";
  const recipientAddr = data.order[recipient];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/circles" className="inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 text-[0.9375rem] font-semibold text-cobalt-press hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All circles
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 break-words">{s.name}</h1>
          <StateChip state={s.state} />
        </div>
        <p className="mt-2 max-w-2xl text-ink-soft text-pretty">{termsSentence({ members: n, contribution: s.contribution, periodSec: s.period, depositMultiple: s.depositMultiple })}</p>
      </div>

      {fresh && s.state === 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border-2 border-ink/90 bg-leaf-tint p-4">
          <PartyPopper className="h-5 w-5 text-leaf" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">Circle created. Join it yourself, then share the link so others can take their seats.</p>
          {link && <CopyButton text={link} label="Copy invite link" />}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel className="bg-marigold-tint">
          <Ring seats={seats} recipient={recipient} pot={usd(pot)} className="mx-auto w-full max-w-[26rem]" />
          <div className="mt-2 text-center" aria-live="polite">
            {active && recipientAddr && (
              <p className="text-lg font-semibold">
                <span className="tnum">{shortAddr(recipientAddr)}</span> receives {usd(pot)}
              </p>
            )}
            {s.state === 0 && (
              <p className="text-lg font-semibold">
                <span className="tnum">{s.memberCount}</span> of {n} seats filled
              </p>
            )}
            {s.state === 2 && <p className="text-lg font-semibold">All {n} cycles are done</p>}
            {s.state === 3 && <p className="text-lg font-semibold">Cancelled before it started</p>}
            <p className="mt-0.5 text-[0.9375rem] text-ink-soft tnum">
              {active && (
                <>
                  {s.paidThisCycle} of {s.memberCount} paid
                  {now < s.currentCycleStart ? ` · next cycle opens in ${duration(s.currentCycleStart - now)}` : now <= cycleEnd ? ` · due in ${duration(cycleEnd - now)}` : now <= cycleEnd + s.grace ? ` · grace ends in ${duration(cycleEnd + s.grace - now)}` : " · ready to settle"}
                </>
              )}
              {s.state === 0 && (now <= s.joinDeadline ? `Joining closes in ${duration(s.joinDeadline - now)}` : "Joining has closed")}
            </p>
          </div>
        </Panel>

        <Actions address={address} data={data} now={now} />
      </div>

      {active || s.state === 2 ? (
        <section aria-labelledby="ledger-h">
          <h2 id="ledger-h" className="mb-3 text-h2">
            The ledger
          </h2>
          <Ledger members={data.members} order={data.order} matrix={data.ledger} scores={data.scores} settled={s.settledCycles} active={active} me={me} />
          <LedgerLegend />
        </section>
      ) : (
        <section aria-labelledby="members-h">
          <h2 id="members-h" className="mb-3 text-h2">
            Who is in
          </h2>
          {data.members.length === 0 ? (
            <p className="text-ink-soft">Nobody has joined yet. Be the first.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.members.map((m, i) => (
                <li key={m} className="flex items-center justify-between rounded-field border-2 border-line bg-surface px-4 py-2.5">
                  <span className="tnum font-medium">
                    {shortAddr(m)}
                    {isMe(m) && <span className="ml-2 rounded-chip bg-cobalt-tint px-1.5 py-0.5 text-xs font-semibold text-cobalt-press">You</span>}
                  </span>
                  <span className="text-sm text-ink-soft tnum">Score {data.scores[i] ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="terms-h">
        <h2 id="terms-h" className="mb-3 text-h2">
          Terms, fixed in the contract
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-card border-2 border-ink/90 bg-ink/90 sm:grid-cols-2">
          {[
            ["Each person pays", `${usd(s.contribution)} every ${periodLabel(s.period)}`],
            ["The pot", `${usd(pot)} to one person each cycle`],
            ["Late payments", `Accepted for ${duration(s.grace)} after the deadline, with a small score penalty`],
            ["Safety deposit", s.depositMultiple ? `${usd(s.contribution * BigInt(s.depositMultiple))}, covers ${s.depositMultiple} missed ${s.depositMultiple === 1 ? "payment" : "payments"}` : "None"],
            ["Order of the pot", s.orderMode === 1 ? "Highest reputation first, then join order" : "The order people joined"],
            ["Minimum score to join", s.minScore ? String(s.minScore) : "Anyone can join"],
            ["If someone misses and has no deposit left", "They lose their own turn. Everyone who paid that cycle gets their money back."],
            ["Organizer powers", "None after creation, except cancelling a circle that has not started."],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3">
              <dt className="text-sm text-ink-soft">{k}</dt>
              <dd className="mt-0.5 font-semibold text-pretty">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-ink-soft">
          Circle contract: <span className="tnum break-all">{address}</span>
        </p>
      </section>
    </div>
  );
}
