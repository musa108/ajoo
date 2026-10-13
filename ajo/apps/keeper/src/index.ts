import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { ajoCircleAbi, ajoFactoryAbi, creditPoolAbi } from "@ajo/abi";
import { account, addresses, chain, settings } from "./config.js";
import { describe, planCircle, reminderKey, type Action, type CircleSnap } from "./plan.js";
import { notify } from "./notify.js";

const pub = createPublicClient({ chain, transport: http(settings.rpcUrl) });
const wallet = account ? createWalletClient({ account, chain, transport: http(settings.rpcUrl) }) : undefined;

const reminded = new Set<string>();
let txThisLoop = 0;

async function snapshot(circle: Address): Promise<CircleSnap> {
  const [s, members, canSettle] = await Promise.all([
    pub.readContract({ address: circle, abi: ajoCircleAbi, functionName: "summary" }),
    pub.readContract({ address: circle, abi: ajoCircleAbi, functionName: "members" }),
    pub.readContract({ address: circle, abi: ajoCircleAbi, functionName: "canSettle" }),
  ]);
  const statuses =
    s.state === 1
      ? await Promise.all(
          members.map((m) =>
            pub.readContract({ address: circle, abi: ajoCircleAbi, functionName: "statusOf", args: [s.settledCycles, m] }),
          ),
        )
      : members.map(() => 0);
  return {
    address: circle,
    name: s.name,
    state: s.state,
    canSettle,
    joinDeadline: Number(s.joinDeadline),
    memberCount: s.memberCount,
    settledCycles: s.settledCycles,
    currentCycleStart: Number(s.currentCycleStart),
    period: s.period,
    grace: s.grace,
    members: members.map((address, i) => ({ address, status: Number(statuses[i]) })),
  };
}

async function send(fn: "settleCycle" | "cancel", circle: Address, label: string) {
  if (txThisLoop >= settings.maxTxPerLoop) {
    console.warn(`tx cap (${settings.maxTxPerLoop}/loop) reached, deferring: ${label}`);
    return;
  }
  if (settings.dryRun || !wallet) {
    await notify("dry-run", `would ${label}`, { circle });
    return;
  }
  try {
    const hash = await wallet.writeContract({ address: circle, abi: ajoCircleAbi, functionName: fn });
    txThisLoop++;
    const rc = await pub.waitForTransactionReceipt({ hash });
    await notify(rc.status === "success" ? "tx" : "tx-failed", `${label} (${hash})`, { circle, hash });
  } catch (e) {
    // Another keeper (or a human) may have settled first; that is fine.
    await notify("tx-error", `${label}: ${(e as Error).message.split("\n")[0]}`, { circle });
  }
}

async function handle(a: Action) {
  if (a.kind === "settle") return send("settleCycle", a.circle, describe(a));
  if (a.kind === "cancel") return send("cancel", a.circle, describe(a));
  const key = reminderKey(a);
  if (reminded.has(key)) return;
  reminded.add(key);
  await notify("reminder", describe(a), { circle: a.circle, member: a.member, cycle: a.cycle, deadline: a.deadline });
}

async function sweepCredit() {
  if (!addresses.creditPool) return;
  const pool = addresses.creditPool;
  const logs = await pub.getLogs({
    address: pool,
    event: { type: "event", name: "Borrowed", inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "due", type: "uint64", indexed: false },
    ] },
    fromBlock: settings.startBlock,
  });
  const borrowers = [...new Set(logs.map((l) => l.args.borrower!))];
  const grace = Number(await pub.readContract({ address: pool, abi: creditPoolAbi, functionName: "defaultGrace" }));
  const now = Math.floor(Date.now() / 1000);
  for (const b of borrowers) {
    const [, , due, open] = await pub.readContract({ address: pool, abi: creditPoolAbi, functionName: "loans", args: [b] });
    if (!open || now <= Number(due) + grace) continue;
    const label = `write off overdue loan of ${b}`;
    if (settings.dryRun || !wallet) {
      await notify("dry-run", `would ${label}`, { borrower: b });
      continue;
    }
    try {
      const hash = await wallet.writeContract({ address: pool, abi: creditPoolAbi, functionName: "markDefault", args: [b] });
      await pub.waitForTransactionReceipt({ hash });
      await notify("tx", `${label} (${hash})`, { borrower: b, hash });
    } catch (e) {
      await notify("tx-error", `${label}: ${(e as Error).message.split("\n")[0]}`, { borrower: b });
    }
  }
}

async function loop() {
  txThisLoop = 0;
  const block = await pub.getBlock();
  const now = Number(block.timestamp); // chain time, so local time-travel demos work

  if (wallet && account) {
    const bal = await pub.getBalance({ address: account.address });
    if (bal < settings.minNativeBalance) console.warn(`keeper balance low: ${bal} wei (${account.address})`);
  }

  const total = Number(await pub.readContract({ address: addresses.factory, abi: ajoFactoryAbi, functionName: "circleCount" }));
  const circles = total
    ? await pub.readContract({ address: addresses.factory, abi: ajoFactoryAbi, functionName: "getCircles", args: [0n, BigInt(total)] })
    : [];

  let actions = 0;
  for (const c of circles) {
    const snap = await snapshot(c);
    for (const a of planCircle(snap, now, settings.remindBeforeSec)) {
      actions++;
      await handle(a);
    }
  }
  await sweepCredit();
  console.log(`[${new Date().toISOString()}] swept ${circles.length} circle(s), ${actions} action(s)${settings.dryRun ? " (dry run)" : ""}`);
}

async function main() {
  console.log(`Ajo keeper on chain ${chain.id} | factory ${addresses.factory} | ${account ? account.address : "no signer (dry run)"}`);
  if (settings.once) return loop();
  for (;;) {
    try {
      await loop();
    } catch (e) {
      console.error("loop error:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, settings.pollMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
