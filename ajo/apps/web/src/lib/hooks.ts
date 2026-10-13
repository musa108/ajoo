"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import type { Address } from "viem";
import {
  ajoCircleAbi,
  ajoFactoryAbi,
  creditPoolAbi,
  mockUSDAbi,
  reputationRegistryAbi,
} from "@ajo/abi";
import { addresses } from "./config";

export const FAST = 5_000;
export const SLOW = 15_000;

type ReadCall = { address: Address; abi: any; functionName: string; args?: readonly unknown[] };

/** Concurrent reads. The transport batches them into one JSON-RPC request, so this needs no Multicall3. */
async function readAll<T = any>(pc: ReturnType<typeof usePc>, calls: ReadCall[]): Promise<T[]> {
  return Promise.all(calls.map((c) => pc.readContract(c as never))) as Promise<T[]>;
}

export function usePc() {
  const pc = usePublicClient();
  if (!pc) throw new Error("No public client");
  return pc;
}

/**
 * Chain time that keeps ticking between polls, so countdowns follow the chain (and local time-travel demos).
 * Returns 0 until the first block time arrives. Never falls back to the browser clock: on a chain whose time
 * differs from the wall clock that would briefly show wrong deadlines. Callers treat 0 as "still loading".
 */
export function useChainNow(): number {
  const pc = usePc();
  const base = useRef<{ chain: number; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const q = useQuery({
    queryKey: ["chain-time"],
    queryFn: async () => Number((await pc.getBlock()).timestamp),
    refetchInterval: FAST,
  });
  useEffect(() => {
    if (q.data) {
      base.current = { chain: q.data, at: Date.now() };
      setNow(q.data);
    }
  }, [q.data]);
  useEffect(() => {
    const t = setInterval(() => {
      const b = base.current;
      if (b) setNow(b.chain + Math.floor((Date.now() - b.at) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ---------------------------------------------------------------- circles

export type CircleSummary = {
  address: Address;
  name: string;
  token: Address;
  organizer: Address;
  contribution: bigint;
  period: number;
  grace: number;
  maxMembers: number;
  depositMultiple: number;
  orderMode: number;
  joinDeadline: number;
  minScore: number;
  state: number;
  memberCount: number;
  settledCycles: number;
  paidThisCycle: number;
  startTime: number;
  currentCycleStart: number;
  weight: number;
};

function toSummary(address: Address, s: any): CircleSummary {
  return {
    address,
    name: s.name,
    token: s.token,
    organizer: s.organizer,
    contribution: s.contribution,
    period: Number(s.period),
    grace: Number(s.grace),
    maxMembers: Number(s.maxMembers),
    depositMultiple: Number(s.depositMultiple),
    orderMode: Number(s.orderMode),
    joinDeadline: Number(s.joinDeadline),
    minScore: Number(s.minScore),
    state: Number(s.state),
    memberCount: Number(s.memberCount),
    settledCycles: Number(s.settledCycles),
    paidThisCycle: Number(s.paidThisCycle),
    startTime: Number(s.startTime),
    currentCycleStart: Number(s.currentCycleStart),
    weight: Number(s.weight),
  };
}

export function useCircleList() {
  const pc = usePc();
  return useQuery({
    queryKey: ["circles"],
    enabled: Boolean(addresses.factory),
    refetchInterval: SLOW,
    queryFn: async (): Promise<CircleSummary[]> => {
      try {
      const factory = addresses.factory!;
      const count = Number(await pc.readContract({ address: factory, abi: ajoFactoryAbi, functionName: "circleCount" }));
      if (count === 0) return [];
      const list = await pc.readContract({ address: factory, abi: ajoFactoryAbi, functionName: "getCircles", args: [0n, BigInt(Math.min(count, 60))] });
      const res = await readAll(pc, list.map((address) => ({ address, abi: ajoCircleAbi, functionName: "summary" })));
      return res.map((s, i) => toSummary(list[i], s));
      } catch (e) { console.error("DBG useCircleList", (e as Error).message, (e as Error).stack?.slice(0, 400)); throw e; }
    },
  });
}

export function useCircle(address: Address) {
  const pc = usePc();
  const { address: me } = useAccount();
  return useQuery({
    queryKey: ["circle", address, me],
    refetchInterval: FAST,
    queryFn: async () => {
      const base = { address, abi: ajoCircleAbi } as const;
      const [summary, members, order, ledger, canSettle, totalClaimable] = await Promise.all([
        pc.readContract({ ...base, functionName: "summary" }),
        pc.readContract({ ...base, functionName: "members" }),
        pc.readContract({ ...base, functionName: "payoutOrder" }),
        pc.readContract({ ...base, functionName: "ledger" }),
        pc.readContract({ ...base, functionName: "canSettle" }),
        pc.readContract({ ...base, functionName: "totalClaimable" }),
      ]);
      const s = toSummary(address, summary);

      const scores = addresses.registry && members.length
        ? await readAll<number>(pc, members.map((m) => ({ address: addresses.registry!, abi: reputationRegistryAbi, functionName: "scoreOf", args: [m] })))
        : [];

      let mine = null as null | {
        joined: boolean;
        deposit: bigint;
        defaulted: boolean;
        claimable: bigint;
        balance: bigint;
        allowance: bigint;
        score: number;
        paidThisCycle: number;
        isOrganizer: boolean;
      };
      if (me) {
        const [info, claimable, balance, allowance, score, paid] = await Promise.all([
          pc.readContract({ ...base, functionName: "memberInfo", args: [me] }),
          pc.readContract({ ...base, functionName: "claimable", args: [me] }),
          pc.readContract({ address: s.token, abi: mockUSDAbi, functionName: "balanceOf", args: [me] }),
          pc.readContract({ address: s.token, abi: mockUSDAbi, functionName: "allowance", args: [me, address] }),
          addresses.registry
            ? pc.readContract({ address: addresses.registry, abi: reputationRegistryAbi, functionName: "scoreOf", args: [me] })
            : Promise.resolve(0),
          s.state === 1 ? pc.readContract({ ...base, functionName: "statusOf", args: [s.settledCycles, me] }) : Promise.resolve(0),
        ]);
        mine = {
          joined: info.joined,
          deposit: info.deposit,
          defaulted: info.defaulted,
          claimable,
          balance,
          allowance,
          score: Number(score),
          paidThisCycle: Number(paid),
          isOrganizer: s.organizer.toLowerCase() === me.toLowerCase(),
        };
      }

      return {
        summary: s,
        members: [...members] as Address[],
        order: [...order] as Address[],
        ledger: ledger.map((row) => row.map(Number)) as number[][],
        scores: scores.map(Number),
        canSettle,
        totalClaimable,
        mine,
      };
    },
  });
}

// ---------------------------------------------------------------- reputation

export type Stats = {
  score: number;
  onTime: number;
  late: number;
  defaultsCovered: number;
  defaultsUncovered: number;
  circlesCompleted: number;
  creditRepaid: number;
  creditDefaulted: number;
  totalContributed: bigint;
};

export function useStats(who?: Address) {
  const pc = usePc();
  return useQuery({
    queryKey: ["stats", who],
    enabled: Boolean(who && addresses.registry),
    refetchInterval: SLOW,
    queryFn: async (): Promise<Stats> => {
      const s = await pc.readContract({ address: addresses.registry!, abi: reputationRegistryAbi, functionName: "statsOf", args: [who!] });
      return {
        score: Number(s.score),
        onTime: Number(s.onTime),
        late: Number(s.late),
        defaultsCovered: Number(s.defaultsCovered),
        defaultsUncovered: Number(s.defaultsUncovered),
        circlesCompleted: Number(s.circlesCompleted),
        creditRepaid: Number(s.creditRepaid),
        creditDefaulted: Number(s.creditDefaulted),
        totalContributed: s.totalContributed,
      };
    },
  });
}

export function useMyCircles(who?: Address) {
  const pc = usePc();
  return useQuery({
    queryKey: ["my-circles", who],
    enabled: Boolean(who && addresses.factory),
    refetchInterval: SLOW,
    queryFn: async (): Promise<CircleSummary[]> => {
      const f = addresses.factory!;
      const [joined, organized] = await Promise.all([
        pc.readContract({ address: f, abi: ajoFactoryAbi, functionName: "circlesOfMember", args: [who!] }),
        pc.readContract({ address: f, abi: ajoFactoryAbi, functionName: "circlesOfOrganizer", args: [who!] }),
      ]);
      const list = [...new Set([...joined, ...organized])];
      if (!list.length) return [];
      const res = await readAll(pc, list.map((address) => ({ address, abi: ajoCircleAbi, functionName: "summary" })));
      return res.map((s, i) => toSummary(list[i], s)).reverse();
    },
  });
}

// ---------------------------------------------------------------- credit

export function useCredit() {
  const pc = usePc();
  const { address: me } = useAccount();
  return useQuery({
    queryKey: ["credit", me],
    enabled: Boolean(addresses.creditPool),
    refetchInterval: FAST,
    queryFn: async () => {
      const pool = addresses.creditPool!;
      const b = { address: pool, abi: creditPoolAbi } as const;
      const [idle, loaned, minScore, perPoint, feeBps, term, grace] = await Promise.all([
        pc.readContract({ ...b, functionName: "idle" }),
        pc.readContract({ ...b, functionName: "totalLoaned" }),
        pc.readContract({ ...b, functionName: "minScore" }),
        pc.readContract({ ...b, functionName: "creditPerPoint" }),
        pc.readContract({ ...b, functionName: "feeBps" }),
        pc.readContract({ ...b, functionName: "term" }),
        pc.readContract({ ...b, functionName: "defaultGrace" }),
      ]);
      let mine = null as null | {
        score: number;
        limit: bigint;
        loan: { principalOut: bigint; feeOut: bigint; due: number; open: boolean };
        owed: bigint;
        shares: bigint;
        supplied: bigint;
        balance: bigint;
        allowance: bigint;
      };
      if (me) {
        const [score, limit, loan, owed, shares, supplied, balance, allowance] = await Promise.all([
          pc.readContract({ address: addresses.registry!, abi: reputationRegistryAbi, functionName: "scoreOf", args: [me] }),
          pc.readContract({ ...b, functionName: "creditLimit", args: [me] }),
          pc.readContract({ ...b, functionName: "loans", args: [me] }),
          pc.readContract({ ...b, functionName: "owed", args: [me] }),
          pc.readContract({ ...b, functionName: "sharesOf", args: [me] }),
          pc.readContract({ ...b, functionName: "valueOf", args: [me] }),
          pc.readContract({ address: addresses.token!, abi: mockUSDAbi, functionName: "balanceOf", args: [me] }),
          pc.readContract({ address: addresses.token!, abi: mockUSDAbi, functionName: "allowance", args: [me, pool] }),
        ]);
        mine = {
          score: Number(score),
          limit,
          loan: { principalOut: loan[0], feeOut: loan[1], due: Number(loan[2]), open: loan[3] },
          owed,
          shares,
          supplied,
          balance,
          allowance,
        };
      }
      return { idle, loaned, minScore: Number(minScore), perPoint, feeBps: Number(feeBps), term: Number(term), grace: Number(grace), mine };
    },
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return useMemo(() => () => qc.invalidateQueries(), [qc]);
}

export function useTokenBalance() {
  const pc = usePc();
  const { address: me } = useAccount();
  return useQuery({
    queryKey: ["token-balance", me],
    enabled: Boolean(me && addresses.token),
    refetchInterval: FAST,
    queryFn: () => pc.readContract({ address: addresses.token!, abi: mockUSDAbi, functionName: "balanceOf", args: [me!] }),
  });
}
