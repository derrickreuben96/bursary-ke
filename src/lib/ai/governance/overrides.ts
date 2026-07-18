// Phase 6C — Officer override analytics. Aggregates rate and reasons.

export interface OverrideSample {
  student_id: string;
  ai_recommended: number;
  officer_final: number;
  reason?: string | null;
  occurred_at: string;
}

export interface OverrideReport {
  total_decisions: number;
  overrides: number;
  override_rate: number; // 0..1
  avg_delta_pct: number;
  top_reasons: Array<{ reason: string; count: number }>;
}

export function computeOverrides(samples: OverrideSample[]): OverrideReport {
  const overrides = samples.filter((s) => s.officer_final !== s.ai_recommended);
  const rate = samples.length ? overrides.length / samples.length : 0;
  const avgDelta = overrides.length
    ? overrides.reduce((n, s) => {
        const base = Math.max(s.ai_recommended, 1);
        return n + Math.abs((s.officer_final - s.ai_recommended) / base) * 100;
      }, 0) / overrides.length
    : 0;
  const reasons = new Map<string, number>();
  for (const s of overrides) {
    const r = (s.reason || "unspecified").toLowerCase().slice(0, 60);
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  const top = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    total_decisions: samples.length,
    overrides: overrides.length,
    override_rate: Math.round(rate * 1000) / 1000,
    avg_delta_pct: Math.round(avgDelta),
    top_reasons: top,
  };
}
