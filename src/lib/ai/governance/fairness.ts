// Phase 6C — Fairness monitoring. Aggregates approval and allocation rates
// across sensitive attributes and flags disparities that exceed a threshold.

export interface FairnessSample {
  cohort: "secondary" | "higher_ed";
  county?: string | null;
  disability?: boolean;
  orphan_status?: "none" | "single" | "double" | null;
  approved: boolean;
  allocated: number;
}

export interface FairnessGroup {
  key: string;
  group: string;
  n: number;
  approval_rate: number; // 0..1
  avg_allocation: number;
}

export interface FairnessReport {
  attribute: "county" | "disability" | "orphan_status" | "cohort";
  groups: FairnessGroup[];
  max_gap: number; // percentage points
  flagged: boolean;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function fairnessBy(
  attribute: FairnessReport["attribute"],
  samples: FairnessSample[],
  opts: { gap_threshold_pp?: number } = {},
): FairnessReport {
  const threshold = opts.gap_threshold_pp ?? 20;
  const buckets = new Map<string, FairnessSample[]>();

  for (const s of samples) {
    let key: string;
    switch (attribute) {
      case "county": key = s.county || "unknown"; break;
      case "disability": key = s.disability ? "disability" : "no_disability"; break;
      case "orphan_status": key = s.orphan_status || "none"; break;
      case "cohort": key = s.cohort; break;
    }
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }

  const groups: FairnessGroup[] = [];
  for (const [key, arr] of buckets.entries()) {
    const approved = arr.filter((s) => s.approved);
    const rate = ratio(approved.length, arr.length);
    const avg = approved.length
      ? approved.reduce((n, s) => n + s.allocated, 0) / approved.length
      : 0;
    groups.push({
      key,
      group: key,
      n: arr.length,
      approval_rate: Math.round(rate * 1000) / 1000,
      avg_allocation: Math.round(avg),
    });
  }

  groups.sort((a, b) => b.approval_rate - a.approval_rate);
  const rates = groups.map((g) => g.approval_rate * 100);
  const gap = rates.length ? Math.max(...rates) - Math.min(...rates) : 0;

  return {
    attribute,
    groups,
    max_gap: Math.round(gap),
    flagged: gap >= threshold,
  };
}
