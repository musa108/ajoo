import { defineChain, type Address } from "viem";
import { deployments } from "@ajo/abi";

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

export const chainId = num(process.env.NEXT_PUBLIC_CHAIN_ID, 31337);
const symbol = process.env.NEXT_PUBLIC_NATIVE_SYMBOL ?? "ETH";

export const chain = defineChain({
  id: chainId,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME ?? (chainId === 31337 ? "Local anvil" : `Chain ${chainId}`),
  nativeCurrency: { name: symbol, symbol, decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"] } },
  blockExplorers: process.env.NEXT_PUBLIC_EXPLORER_URL
    ? { default: { name: "Explorer", url: process.env.NEXT_PUBLIC_EXPLORER_URL } }
    : undefined,
});

const dep = deployments[chainId];

/** Deployed addresses: env wins, otherwise the generated deployment file for this chain. */
export const addresses = {
  factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? dep?.factory) as Address | undefined,
  registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? dep?.registry) as Address | undefined,
  token: (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? dep?.token) as Address | undefined,
  creditPool: (process.env.NEXT_PUBLIC_CREDIT_POOL_ADDRESS ?? dep?.creditPool) as Address | undefined,
};

export const isMockToken = process.env.NEXT_PUBLIC_TOKEN_IS_MOCK
  ? process.env.NEXT_PUBLIC_TOKEN_IS_MOCK === "1"
  : Boolean(dep?.tokenIsMock && addresses.token === dep.token);

export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = isMockToken ? "mUSD" : (process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USD");

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";
export const DEMO_VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? "";
export const HACKATHON = "Monad Metropolis";

/** Cycle length choices offered in the create form. The 5-minute option exists so a circle can be demoed live. */
export const PERIOD_OPTIONS = [
  { label: "Every day", seconds: 86_400, grace: 4 * 3600 },
  { label: "Every week", seconds: 7 * 86_400, grace: 24 * 3600 },
  { label: "Every two weeks", seconds: 14 * 86_400, grace: 48 * 3600 },
  { label: "Every month", seconds: 30 * 86_400, grace: 72 * 3600 },
  ...(isMockToken ? [{ label: "Demo: every 5 minutes", seconds: 300, grace: 120 }] : []),
] as const;
