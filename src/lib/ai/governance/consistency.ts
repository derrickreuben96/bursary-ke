// Phase 6C — Consistency: cluster similar households and flag pairs whose
// recommended allocation differs materially. Purely observational.

export interface ConsistencySample {
  household_id: string;
  tracking_number: string;
  cohort: "secondary" | "higher_ed";
  income_band: "low" | "mid" | "high";
  vulnerability_flags: number; // count of vulnerability indicators
  recommended_allocation: number;
}

export interface ConsistencyPair {
  a: string;
  b: string;
  cluster_key: string;
  delta: number;
  delta_pct: number;
}

export interface ConsistencyReport {
  cluster_count: number;
  pair_count: number;
  flagged: ConsistencyPair[];
  score: number; // 0..100 (higher = more consistent)
}

const bandOf = (income: number): "low" | "mid" | "high" =>
  income < 20000 ? "low" : income < 60000 ? "mid" : "high";

export function fromIncome(sample: Omit<ConsistencySample, "income_band"> & { monthly_income: number }): ConsistencySample {
  const { monthly_income, ...rest } = sample;
  return { ...rest, income_band: bandOf(monthly_income) };
}

export function computeConsistency(
  samples: ConsistencySample[],
  opts: { pct_threshold?: number } = {},
): ConsistencyReport {
  const threshold = opts.pct_threshold ?? 25;
  const clusters = new Map<string, ConsistencySample[]>();

  for (const s of samples) {
    const key = `${s.cohort}|${s.income_band}|${s.vulnerability_flags}`;
    const arr = clusters.get(key) ?? [];
    arr.push(s);
    clusters.set(key, arr);
  }

  const flagged: ConsistencyPair[] = [];
  let pairCount = 0;
  let goodPairs = 0;

  for (const [key, arr] of clusters.entries()) {
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        pairCount++;
        const a = arr[i];
        const b = arr[j];
        const base = Math.max(a.recommended_allocation, b.recommended_allocation, 1);
        const delta = Math.abs(a.recommended_allocation - b.recommended_allocation);
        const pct = (delta / base) * 100;
        if (pct >= threshold) {
          flagged.push({
            a: a.tracking_number,
            b: b.tracking_number,
            cluster_key: key,
            delta,
            delta_pct: Math.round(pct),
          });
        } else {
          goodPairs++;
        }
      }
    }
  }

  const score = pairCount ? Math.round((goodPairs / pairCount) * 100) : 100;
  return { cluster_count: clusters.size, pair_count: pairCount, flagged, score };
}
