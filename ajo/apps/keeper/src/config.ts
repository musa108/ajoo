import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployments } from "@ajo/abi";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

const chainId = Number(process.env.CHAIN_ID ?? 31337);
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

export const chain = defineChain({
  id: chainId,
  name: process.env.CHAIN_NAME ?? `chain-${chainId}`,
  nativeCurrency: { name: process.env.NATIVE_SYMBOL ?? "ETH", symbol: process.env.NATIVE_SYMBOL ?? "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

const dep = deployments[chainId];
export const addresses = {
  factory: (process.env.FACTORY_ADDRESS ?? dep?.factory) as `0x${string}`,
  creditPool: (process.env.CREDIT_POOL_ADDRESS ?? dep?.creditPool) as `0x${string}`,
};
if (!addresses.factory) throw new Error(`No factory address for chain ${chainId}. Set FACTORY_ADDRESS or deploy first.`);

export const settings = {
  rpcUrl,
  dryRun: process.env.DRY_RUN === "1" || process.argv.includes("--dry"),
  once: process.argv.includes("--once"),
  pollMs: Number(process.env.POLL_MS ?? 15_000),
  remindBeforeSec: Number(process.env.REMIND_BEFORE_SEC ?? 6 * 3600),
  maxTxPerLoop: Number(process.env.MAX_TX_PER_LOOP ?? 10),
  minNativeBalance: BigInt(process.env.MIN_NATIVE_BALANCE_WEI ?? "10000000000000000"),
  webhookUrl: process.env.WEBHOOK_URL,
  startBlock: BigInt(process.env.START_BLOCK ?? 0),
};

export const account = settings.dryRun && !process.env.KEEPER_PRIVATE_KEY ? undefined : privateKeyToAccount(need("KEEPER_PRIVATE_KEY") as `0x${string}`);
