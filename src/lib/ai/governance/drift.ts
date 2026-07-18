// Phase 6C — Recommendation drift monitoring.
// Compares average allocation & score per cohort across cycle windows and
// flags shifts that exceed a configurable threshold.

export interface RecommendationSample {
  policy_version: string;
  cohort: "secondary" | "higher_ed";
  needs_score: number;
  recommended_allocation: number;
  generated_at: string; // ISO
}

export interface DriftWindow {
  from: string;
  to: string;
  count: number;
  avg_score: number;
  avg_allocation: number;
}

export interface DriftReport {
  cohort: "secondary" | "higher_ed";
  current: DriftWindow;
  previous: DriftWindow;
  score_delta: number;      // percentage points
  allocation_delta_pct: number;
  drift_detected: boolean;
  severity: "info" | "warn" | "critical";
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0);

function windowFor(rows: RecommendationSample[]): DriftWindow {
  if (!rows.length) {
    return { from: "", to: "", count: 0, avg_score: 0, avg_allocation: 0 };
  }
  const sorted = [...rows].sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return {
    from: sorted[0].generated_at,
    to: sorted[sorted.length - 1].generated_at,
    count: rows.length,
    avg_score: Math.round(avg(rows.map((r) => r.needs_score))),
    avg_allocation: Math.round(avg(rows.map((r) => r.recommended_allocation))),
  };
}

export function computeDrift(
  samples: RecommendationSample[],
  opts: { score_threshold_pp?: number; allocation_threshold_pct?: number } = {},
): DriftReport[] {
  const scoreT = opts.score_threshold_pp ?? 10;
  const allocT = opts.allocation_threshold_pct ?? 15;

  const cohorts: Array<"secondary" | "higher_ed"> = ["secondary", "higher_ed"];
  const reports: DriftReport[] = [];

  for (const c of cohorts) {
    const rows = samples.filter((s) => s.cohort === c);
    if (rows.length < 4) {
      reports.push({
        cohort: c,
        current: windowFor(rows),
        previous: windowFor([]),
        score_delta: 0,
        allocation_delta_pct: 0,
        drift_detected: false,
        severity: "info",
      });
      continue;
    }
    const sorted = [...rows].sort((a, b) => a.generated_at.localeCompare(b.generated_at));
    const mid = Math.floor(sorted.length / 2);
    const prev = sorted.slice(0, mid);
    const cur = sorted.slice(mid);
    const cw = windowFor(cur);
    const pw = windowFor(prev);
    const scoreDelta = cw.avg_score - pw.avg_score;
    const allocDelta = pw.avg_allocation
      ? ((cw.avg_allocation - pw.avg_allocation) / pw.avg_allocation) * 100
      : 0;
    const drift = Math.abs(scoreDelta) >= scoreT || Math.abs(allocDelta) >= allocT;
    const severity: DriftReport["severity"] = !drift
      ? "info"
      : Math.abs(scoreDelta) >= scoreT * 2 || Math.abs(allocDelta) >= allocT * 2
        ? "critical"
        : "warn";
    reports.push({
      cohort: c,
      current: cw,
      previous: pw,
      score_delta: Math.round(scoreDelta),
      allocation_delta_pct: Math.round(allocDelta),
      drift_detected: drift,
      severity,
    });
  }
  return reports;
}
