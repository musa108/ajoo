"use client";
import { useEffect, useState } from "react";
/** Wallet state only exists in the browser; render wallet-dependent UI after mount to avoid hydration mismatches. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
