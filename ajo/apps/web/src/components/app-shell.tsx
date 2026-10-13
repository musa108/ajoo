"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { BalanceChip, NetworkGuard, WalletButton } from "./wallet";
import { cn } from "@/lib/cn";
import { isMockToken, chain, addresses } from "@/lib/config";

const NAV = [
  { href: "/circles", label: "Circles", match: (p: string) => p === "/circles" || (p.startsWith("/circles/") && p !== "/circles/new") },
  { href: "/circles/new", label: "Start a circle", match: (p: string) => p === "/circles/new" },
  { href: "/record", label: "My record", match: (p: string) => p.startsWith("/record") },
  { href: "/credit", label: "Credit", match: (p: string) => p.startsWith("/credit") },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[70] focus:rounded-full focus:bg-marigold focus:px-4 focus:py-2 focus:font-semibold">
        Skip to content
      </a>
      <NetworkGuard />
      <header className="sticky top-0 z-40 border-b-2 border-ink/90 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto pb-1 md:order-2 md:w-auto md:pb-0">
            {NAV.map((n) => {
              const on = n.match(path);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[0.9375rem] font-semibold transition-colors duration-150",
                    on ? "bg-ink text-white" : "text-ink hover:bg-cobalt-tint",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="order-2 flex items-center gap-3 md:order-3">
            <div className="hidden lg:block">
              <BalanceChip />
            </div>
            <WalletButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-page px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        {!addresses.factory && (
          <div role="alert" className="mb-8 rounded-card border-2 border-coral/50 bg-coral-tint p-4 text-[0.9375rem]">
            <p className="font-semibold">No contracts configured for {chain.name}.</p>
            <p className="mt-1">Deploy with the Deploy script and set the NEXT_PUBLIC_*_ADDRESS variables, or run the one-command local setup. See the README.</p>
          </div>
        )}
        {children}
      </main>
      <footer className="border-t-2 border-ink/90 bg-surface">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ink-soft sm:px-6">
          <p>
            {isMockToken ? "Demo deployment: payments use test dollars with no real value." : "Prototype. The contracts are not audited."} Network: {chain.name}.
          </p>
          <p>Ajo is a prototype and not a regulated financial service.</p>
        </div>
      </footer>
    </>
  );
}
