import { createConfig, http, injected } from "wagmi";
import { chain } from "./config";

// `injected` comes from wagmi's core export. Importing from "wagmi/connectors" pulls in every wallet SDK
// (Coinbase, Base Account, WalletConnect...) and their optional dependencies, which this app does not need.
export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  // batch: true sends concurrent reads as one JSON-RPC batch, so the app needs no Multicall3 deployment on the chain
  transports: { [chain.id]: http(undefined, { batch: { wait: 16 } }) },
  ssr: true,
});
