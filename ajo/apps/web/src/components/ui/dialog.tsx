"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

/**
 * Confirmation for irreversible actions only. The title carries the message; the two buttons answer it.
 * Esc, the close button, a click outside, and the "keep" button all dismiss. The scrim is a pale cobalt tint,
 * never dark, to keep the product light end to end.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  keepLabel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  keepLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-cobalt-tint/65 backdrop-blur-[3px]" />
        <D.Content className="fixed left-1/2 top-[45%] z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel border-2 border-coral/40 bg-surface p-6 shadow-[0_20px_60px_-20px_rgb(37_64_232/0.45)]">
          <D.Close aria-label="Close" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:bg-cobalt-tint">
            <X className="h-5 w-5" />
          </D.Close>
          <D.Title className="pr-10 font-display text-2xl font-bold tracking-tight">{title}</D.Title>
          <D.Description asChild>
            <div className="mt-2 text-[0.9375rem] text-ink-soft">{body}</div>
          </D.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <D.Close asChild>
              <Button variant="secondary" autoFocus>
                {keepLabel}
              </Button>
            </D.Close>
            <Button variant="danger" onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
