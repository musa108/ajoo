"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { duration } from "@/lib/format";
import { useChainNow } from "@/lib/hooks";

export function CopyButton({ text, label, done = "Copied" }: { text: string; label: string; done?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          window.prompt("Copy this link", text);
        }
      }}
    >
      {ok ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{ok ? done : label}</span>
    </Button>
  );
}

export function Countdown({ to, prefix = "", expired = "now" }: { to: number; prefix?: string; expired?: string }) {
  const now = useChainNow();
  if (!now) return <span className="tnum">…</span>;
  const left = to - now;
  return (
    <span className="tnum">
      {prefix}
      {left > 0 ? duration(left) : expired}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-ink/50 bg-surface p-8 text-center">
      <h3 className="text-xl">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-ink-soft">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-cobalt-tint/70 ${className}`} aria-hidden />;
}
