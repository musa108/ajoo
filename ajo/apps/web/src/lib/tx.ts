"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import type { Abi, Address } from "viem";
import { useToast } from "@/components/toast";
import { explain } from "./errors";
import { chain } from "./config";
import { usePc, useRefresh } from "./hooks";

export type Call = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

export function useWrongNetwork() {
  const { isConnected } = useAccount();
  const id = useChainId();
  const { data: wc } = useWalletClient();
  const walletChain = wc?.chain?.id;
  void id;
  return isConnected && walletChain !== undefined && walletChain !== chain.id;
}

/**
 * Sends one transaction and tells the person what is happening at each stage.
 * The label is a verb phrase ("Pay $5", "Join circle") and is reused for pending and success messages.
 */
export function useTx() {
  const { data: wc } = useWalletClient();
  const pc = usePc();
  const toast = useToast();
  const refresh = useRefresh();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, done: string, call: Call): Promise<boolean> => {
      if (!wc) {
        toast.push({ tone: "error", title: "Connect your wallet first", body: "Use the Connect wallet button at the top." });
        return false;
      }
      setPending(label);
      const wait = toast.push({ tone: "info", title: `${label}…`, body: "Confirm in your wallet." });
      try {
        // simulate first so a revert shows a readable reason instead of a wallet error
        const { request } = (await pc.simulateContract({ ...(call as Record<string, unknown>), account: wc.account } as never)) as { request: unknown };
        const hash = await wc.writeContract(request as never);
        toast.dismiss(wait);
        const waiting = toast.push({ tone: "info", title: `${label}…`, body: "Waiting for the network to confirm." });
        const rc = await pc.waitForTransactionReceipt({ hash });
        toast.dismiss(waiting);
        if (rc.status !== "success") throw new Error("The transaction was rejected by the network.");
        toast.push({ tone: "success", title: done });
        await refresh();
        return true;
      } catch (e) {
        toast.dismiss(wait);
        toast.push({ tone: "error", title: `${label} did not go through`, body: explain(e) });
        return false;
      } finally {
        setPending(null);
      }
    },
    [wc, pc, toast, refresh],
  );

  return { run, pending, busy: pending !== null };
}
