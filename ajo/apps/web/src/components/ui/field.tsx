"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Label above the control, always visible. Helper text is one line; the error sits directly under the field. */
export function Field({ label, required, optional, helper, error, children }: FieldProps) {
  const id = useId();
  const helperId = helper ? `${id}-h` : undefined;
  const errorId = error ? `${id}-e` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-0.5 text-coral" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="ml-1.5 font-normal text-ink-soft">(optional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-coral">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        helper && (
          <p id={helperId} className="text-sm text-ink-soft">
            {helper}
          </p>
        )
      )}
    </div>
  );
}

const control =
  "block min-h-11 w-full rounded-field border-2 bg-surface px-3.5 text-base text-ink transition-colors duration-150 placeholder:text-ink-soft/60 focus:border-cobalt focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-cobalt/20";

export function TextInput({ invalid, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...p} aria-invalid={invalid || undefined} className={cn(control, invalid ? "border-coral" : "border-line hover:border-cobalt/50", className)} />;
}

export function Select({ invalid, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...p} aria-invalid={invalid || undefined} className={cn(control, "pr-9", invalid ? "border-coral" : "border-line hover:border-cobalt/50", className)}>
      {children}
    </select>
  );
}

/** A radio set drawn as large tappable rows: label plus one line of consequence. */
export function Choice<T extends string | number>({
  name,
  value,
  onChange,
  options,
  legend,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  legend: string;
  options: { value: T; title: string; note: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={String(o.value)}
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-field border-2 p-3.5 transition-colors duration-150",
              on ? "border-cobalt bg-cobalt-tint/70" : "border-line bg-surface hover:border-cobalt/50",
              "focus-within:ring-4 focus-within:ring-cobalt/20",
            )}
          >
            <input type="radio" name={name} checked={on} onChange={() => onChange(o.value)} className="mt-1 h-4 w-4 shrink-0 accent-[rgb(37_64_232)]" />
            <span>
              <span className="block text-[0.9375rem] font-semibold leading-tight">{o.title}</span>
              <span className="mt-0.5 block text-sm text-ink-soft">{o.note}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
