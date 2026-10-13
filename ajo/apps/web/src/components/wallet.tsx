"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { AlertTriangle, LogOut, Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { shortAddr } from "@/lib/format";
import { chain, isMockToken, addresses } from "@/lib/config";
import { useMounted } from "@/lib/use-mounted";
import { useWrongNetwork, useTx } from "@/lib/tx";
import { useTokenBalance } from "@/lib/hooks";
import { usd } from "@/lib/format";
import { mockUSDAbi } from "@ajo/abi";
import { Avatar } from "./avatar";
import { useToast } from "./toast";

export function WalletButton() {
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const toast = useToast();

  if (!mounted) return <div className="h-11 w-36" aria-hidden />;

  if (!isConnected || !address) {
    return (
      <Button
        loading={isPending}
        onClick={() => {
          const hasWallet = typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
          if (!hasWallet) {
            toast.push({ tone: "error", title: "No wallet found", body: "Install a browser wallet such as MetaMask, or open this page inside your wallet's browser." });
            return;
          }
          connect({ connector: connectors[0], chainId: chain.id });
        }}
      >
        <Wallet className="h-4 w-4" aria-hidden />
        Connect wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-surface py-1 pl-1.5 pr-3.5 text-sm font-semibold tnum">
        <Avatar seed={address} size={28} />
        {shortAddr(address)}
      </span>
      <Button variant="ghost" size="sm" aria-label="Disconnect wallet" onClick={() => disconnect()} className="px-3">
        <LogOut className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

export function NetworkGuard() {
  const mounted = useMounted();
  const wrong = useWrongNetwork();
  const { switchChain, isPending } = useSwitchChain();
  if (!mounted || !wrong) return null;
  return (
    <div role="alert" className="border-b-2 border-ink/90 bg-marigold-tint">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <AlertTriangle className="h-5 w-5 shrink-0 text-marigold-deep" aria-hidden />
        <p className="min-w-0 flex-1 text-[0.9375rem] font-medium">Your wallet is on a different network. Switch to {chain.name} to use Ajo.</p>
        <Button size="sm" variant="outline" loading={isPending} onClick={() => switchChain({ chainId: chain.id })}>
          Switch to {chain.name}
        </Button>
      </div>
    </div>
  );
}

/** Test-money helper. Only exists when the deployment uses the mock token. */
export function BalanceChip() {
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const bal = useTokenBalance();
  const { run, busy } = useTx();
  if (!mounted || !isConnected || !addresses.token) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="tnum font-semibold">{bal.data !== undefined ? usd(bal.data, { cents: true }) : "…"}</span>
      {isMockToken && (
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={() => run("Get test dollars", "1,000 test dollars added", { address: addresses.token!, abi: mockUSDAbi, functionName: "faucet", args: [1_000_000_000n] })}
        >
          Get 1,000 test dollars
        </Button>
      )}
    </div>
  );
}
