"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; title: string; body?: string };

const Ctx = createContext<{ push: (t: Omit<Toast, "id">, ms?: number) => number; dismiss: (id: number) => void } | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("ToastProvider missing");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">, ms?: number) => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l.slice(-3), { ...t, id }]);
      const life = ms ?? (t.tone === "error" ? 9000 : t.tone === "info" ? 0 : 4500);
      if (life > 0) setTimeout(() => dismiss(id), life);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* polite live region: announces without stealing focus */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-surface p-4 shadow-[0_8px_30px_-12px_rgb(37_64_232/0.35)]",
              t.tone === "success" && "border-leaf/40",
              t.tone === "error" && "border-coral/50",
              t.tone === "info" && "border-cobalt/40",
            )}
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {t.tone === "success" && <CheckCircle2 className="h-5 w-5 text-leaf" />}
              {t.tone === "error" && <AlertCircle className="h-5 w-5 text-coral" />}
              {t.tone === "info" && <Loader2 className="h-5 w-5 animate-spin text-cobalt" />}
            </span>
            <div className="min-w-0 flex-1 text-[0.9375rem] leading-snug">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 break-words text-ink-soft">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss message"
              className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cobalt-tint"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
