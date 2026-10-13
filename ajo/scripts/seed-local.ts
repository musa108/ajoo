/**
 * Seeds a LOCAL anvil chain with a believable demo state using time travel.
 *   anvil &  ->  forge script Deploy  ->  npm run seed:local
 *
 * Refuses to run on anything but chain 31337.
 */
import { createPublicClient, createTestClient, createWalletClient, http, parseUnits, defineChain, type Address } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { ajoCircleAbi, ajoFactoryAbi, creditPoolAbi, mockUSDAbi, reputationRegistryAbi, deployments } from "@ajo/abi";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const chain = defineChain({ id: 31337, name: "anvil", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const dep = deployments[31337];
if (!dep) throw new Error("No deployment for chain 31337. Run the Deploy script against anvil first.");

const pub = createPublicClient({ chain, transport: http(RPC) });
const test = createTestClient({ chain, transport: http(RPC), mode: "anvil" });
const MNEMONIC = "test test test test test test test test test test test junk";
const accounts = Array.from({ length: 10 }, (_, i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }));
const wallets = accounts.map((account) => createWalletClient({ account, chain, transport: http(RPC) }));

const NAMES = ["Deployer", "Ada", "Tunde", "Ngozi", "Musa", "Bisi", "Chidi", "Funmi", "Emeka", "Halima"];
const usd = (n: number) => parseUnits(String(n), 6);
const DAY = 86_400;

async function tx(i: number, address: Address, abi: any, functionName: string, args: unknown[] = []) {
  const hash = await wallets[i].writeContract({ address, abi, functionName, args } as never);
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`${functionName} failed`);
  return rc;
}
async function warp(sec: number) {
  await test.increaseTime({ seconds: sec });
  await test.mine({ blocks: 1 });
}
async function create(i: number, p: Record<string, unknown>): Promise<Address> {
  const before = await pub.readContract({ address: dep.factory, abi: ajoFactoryAbi, functionName: "circleCount" });
  await tx(i, dep.factory, ajoFactoryAbi, "createCircle", [p]);
  const page = await pub.readContract({ address: dep.factory, abi: ajoFactoryAbi, functionName: "getCircles", args: [0n, 1n] });
  void before;
  return page[0];
}
async function now() {
  return Number((await pub.getBlock()).timestamp);
}

async function main() {
  if ((await pub.getChainId()) !== 31337) throw new Error("seed-local only runs on a local anvil chain");
  if (!dep.tokenIsMock) throw new Error("token is not the mock token; refusing to seed");

  console.log("minting demo balances...");
  for (let i = 1; i < 10; i++) {
    await tx(i, dep.token, mockUSDAbi, "faucet", [usd(1000)]);
    await tx(i, dep.token, mockUSDAbi, "approve", [dep.factory, 2n ** 256n - 1n]);
    await tx(i, dep.token, mockUSDAbi, "approve", [dep.creditPool, 2n ** 256n - 1n]);
  }

  const common = { token: dep.token, grace: 2 * 3600, organizer: accounts[0].address, minScore: 0 };
  const approveCircle = async (c: Address, who: number[]) => {
    for (const i of who) await tx(i, dep.token, mockUSDAbi, "approve", [c, 2n ** 256n - 1n]);
  };

  // ---- Circle C: a short, finished circle so some wallets already have a track record
  console.log("circle: Starter Circle (completed)");
  const starter = await create(6, { ...common, name: "Starter Circle", contribution: usd(2), period: 3600, grace: 600, maxMembers: 3, depositMultiple: 1, orderMode: 0, joinDeadline: BigInt((await now()) + 7 * DAY) });
  await approveCircle(starter, [6, 7, 8]);
  for (const i of [6, 7, 8]) await tx(i, starter, ajoCircleAbi, "join");
  for (let c = 0; c < 3; c++) {
    for (const i of [6, 7, 8]) await tx(i, starter, ajoCircleAbi, "contribute");
    await tx(0, starter, ajoCircleAbi, "settleCycle");
    if (c < 2) await warp(3600);
  }

  // ---- Circle A: five market women, mid-flight with one covered default
  console.log("circle: Balogun Market Women (active, cycle 3)");
  const balogun = await create(1, { ...common, name: "Balogun Market Women", contribution: usd(5), period: DAY, maxMembers: 5, depositMultiple: 1, orderMode: 1, joinDeadline: BigInt((await now()) + 7 * DAY) });
  await approveCircle(balogun, [1, 2, 3, 4, 5]);
  for (const i of [1, 2, 3, 4, 5]) await tx(i, balogun, ajoCircleAbi, "join");
  for (const i of [1, 2, 3, 4, 5]) await tx(i, balogun, ajoCircleAbi, "contribute"); // cycle 1: everyone
  await tx(0, balogun, ajoCircleAbi, "settleCycle");
  await warp(DAY);
  for (const i of [1, 2, 3, 4]) await tx(i, balogun, ajoCircleAbi, "contribute"); // cycle 2: member 5 misses
  await warp(DAY + 3 * 3600);
  await tx(0, balogun, ajoCircleAbi, "settleCycle"); // deposit covers member 5
  for (const i of [1, 2, 3]) await tx(i, balogun, ajoCircleAbi, "contribute"); // cycle 3 underway: 3 of 5 paid

  // ---- Circle B: still filling
  console.log("circle: Ikeja Dev Savers (open, 3 of 6)");
  const ikeja = await create(2, { ...common, name: "Ikeja Dev Savers", contribution: usd(25), period: 7 * DAY, maxMembers: 6, depositMultiple: 2, orderMode: 1, joinDeadline: BigInt((await now()) + 6 * DAY) });
  await approveCircle(ikeja, [2, 3, 9]);
  for (const i of [2, 3, 9]) await tx(i, ikeja, ajoCircleAbi, "join");

  // ---- Credit pool: a lender, plus demo reputation so the credit page can be shown
  console.log("credit pool: lender supplies $500");
  await tx(9, dep.creditPool, creditPoolAbi, "supply", [usd(500)]);

  console.log("DEMO ONLY: owner writes a reputation history for Ada so the credit flow can be shown (mock token only)");
  await tx(0, dep.registry, reputationRegistryAbi, "setWriter", [accounts[0].address, true]);
  for (let k = 0; k < 24; k++) await tx(0, dep.registry, reputationRegistryAbi, "record", [accounts[1].address, 0, 4, 20_000_000n]);
  await tx(0, dep.registry, reputationRegistryAbi, "setWriter", [accounts[0].address, false]);

  const score = await pub.readContract({ address: dep.registry, abi: reputationRegistryAbi, functionName: "scoreOf", args: [accounts[1].address] });
  console.log("\nseeded. demo wallets (anvil mnemonic, local only):");
  accounts.forEach((a, i) => console.log(`  ${i} ${NAMES[i].padEnd(9)} ${a.address}`));
  console.log(`\nAda score: ${score}`);
  console.log("circles:", { starter, balogun, ikeja });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
