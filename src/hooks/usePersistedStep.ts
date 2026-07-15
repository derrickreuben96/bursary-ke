import { useEffect, useState } from "react";

/**
 * Persist a wizard step number to sessionStorage so that accidental refreshes,
 * tab switches, or auto-locks on shared devices don't reset the applicant to
 * step 1. Uses sessionStorage (cleared on tab close) to avoid leaving PII-
 * adjacent state on public/kiosk devices.
 */
export function usePersistedStep(key: string, initial = 1): [
  number,
  (updater: number | ((prev: number) => number)) => void,
  () => void,
] {
  const [step, setStepRaw] = useState<number>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : initial;
    } catch {
      return initial;
    }
  });

  const setStep = (updater: number | ((prev: number) => number)) => {
    setStepRaw((prev) => {
      const next = typeof updater === "function" ? (updater as (p: number) => number)(prev) : updater;
      try {
        window.sessionStorage.setItem(key, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const clear = () => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  // Flush current step on tab hide (belt-and-suspenders — we already save on
  // every setStep, but visibilitychange handles very fast tab switches on
  // slow mobile browsers that may throttle React state updates).
  useEffect(() => {
    const flush = () => {
      try {
        window.sessionStorage.setItem(key, String(step));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [key, step]);

  return [step, setStep, clear];
}
