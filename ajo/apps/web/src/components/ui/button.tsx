import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const button = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-cobalt text-white hover:bg-cobalt-press",
        pot: "bg-marigold text-ink hover:bg-[rgb(255_190_20)]",
        secondary: "bg-cobalt-tint text-cobalt-press hover:bg-[rgb(205_212_255)]",
        outline: "border-2 border-ink/90 bg-surface text-ink hover:bg-marigold-tint",
        ghost: "text-cobalt-press hover:bg-cobalt-tint",
        danger: "bg-coral-tint text-coral hover:bg-[rgb(255_208_202)]",
      },
      size: { md: "min-h-11 px-5 text-[0.9375rem]", lg: "min-h-12 px-7 text-base", sm: "min-h-11 px-4 text-sm" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ className, variant, size, loading, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn(button({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
