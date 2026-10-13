import { CheckCircle2, CircleDashed, Flag, Hourglass } from "lucide-react";
import { cn } from "@/lib/cn";

const MAP = [
  { label: "Open to join", icon: CircleDashed, cls: "bg-cobalt-tint text-cobalt-press" },
  { label: "In progress", icon: Hourglass, cls: "bg-leaf-tint text-leaf" },
  { label: "Finished", icon: Flag, cls: "bg-marigold-tint text-marigold-deep" },
  { label: "Cancelled", icon: CheckCircle2, cls: "bg-coral-tint text-coral" },
] as const;

export function StateChip({ state, className }: { state: number; className?: string }) {
  const m = MAP[state] ?? MAP[0];
  const Icon = state === 3 ? CircleDashed : m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-sm font-semibold", m.cls, className)}>
      <Icon className="h-4 w-4" aria-hidden />
      {m.label}
    </span>
  );
}
