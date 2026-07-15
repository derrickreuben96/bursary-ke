// sessionStorage-backed useState — dashboard state (filters, tab, expanded rows,
// pagination, scroll position, notes) survives tab switches, refreshes and
// silent background polling. NEVER resets on visibilitychange.
import { useCallback, useEffect, useRef, useState } from "react";

export function useDashboardState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* ignore */ }
    return initial;
  });

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);

  return [value, setValue];
}

/** Persist a Set<string> (e.g. expanded household ids). */
export function useDashboardSet(key: string): [Set<string>, (id: string) => void, (next: Set<string>) => void] {
  const [arr, setArr] = useDashboardState<string[]>(key, []);
  const set = new Set(arr);
  const toggle = useCallback((id: string) => {
    setArr(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return Array.from(s);
    });
  }, [setArr]);
  const replace = useCallback((next: Set<string>) => setArr(Array.from(next)), [setArr]);
  return [set, toggle, replace];
}

/** Restore scroll position for a container element identified by ref. */
export function useScrollRestoration(key: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current ?? document.scrollingElement;
    if (!el) return;
    const raw = sessionStorage.getItem(`scroll:${key}`);
    if (raw) {
      const y = Number(raw);
      if (!Number.isNaN(y)) el.scrollTo?.({ top: y, behavior: "auto" });
    }
    const target: EventTarget = ref.current ?? window;
    const onScroll = () => {
      const y = ref.current ? ref.current.scrollTop : window.scrollY;
      sessionStorage.setItem(`scroll:${key}`, String(y));
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [key]);
  return ref;
}
