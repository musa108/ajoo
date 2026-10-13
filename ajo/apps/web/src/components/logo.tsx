import Link from "next/link";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="12" fill="none" stroke="#101437" strokeWidth="3" strokeDasharray="4 4.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="6.5" fill="#FFC933" stroke="#101437" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full pr-2" aria-label="Ajo home">
      <Mark />
      <span className="font-display text-[1.65rem] font-extrabold leading-none tracking-tight" style={{ fontStretch: "86%" }}>
        Ajo
      </span>
    </Link>
  );
}
