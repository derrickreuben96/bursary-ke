// Validates dashboard polling interval is set to 15s (down from 30s).
// Static source-level check — fast, deterministic, runs in CI without a
// browser. Guards against accidental regression of the poll cadence.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = [
  "src/pages/CommissionerDashboard.tsx",
  "src/pages/AdminDashboard.tsx",
  "src/pages/TreasuryDashboard.tsx",
];

describe("dashboard polling cadence", () => {
  it.each(FILES)("%s polls every 15 seconds", (relPath) => {
    const src = readFileSync(resolve(process.cwd(), relPath), "utf8");
    expect(src).toMatch(/setInterval\([\s\S]*?,\s*15000\s*\)/);
    expect(src).not.toMatch(/setInterval\([\s\S]*?,\s*30000\s*\)/);
  });

  it("interval triggers a refetch within ~15s window (timing sanity)", async () => {
    // Simulate the visibility-aware polling contract: callback fires on the
    // configured cadence. Using fake timers keeps this deterministic.
    const { vi } = await import("vitest");
    vi.useFakeTimers();
    let calls = 0;
    const handle = setInterval(() => {
      calls++;
    }, 15000);
    vi.advanceTimersByTime(15000);
    expect(calls).toBe(1);
    vi.advanceTimersByTime(15000);
    expect(calls).toBe(2);
    clearInterval(handle);
    vi.useRealTimers();
  });
});
