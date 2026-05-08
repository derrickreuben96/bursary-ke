// Lightweight client-side reporter for the public.sync_metrics table.
// Throttles per-(source, metric) to ≤1 row / 30s to avoid log floods.
// Authenticated INSERTs only; anonymous calls are dropped silently.
import { supabase } from "@/integrations/supabase/client";

type Severity = "info" | "warn" | "error" | "critical";

export interface SyncMetric {
  source: string;
  metric: string;
  value: number;
  severity?: Severity;
  details?: Record<string, unknown>;
}

const lastSent = new Map<string, number>();
const THROTTLE_MS = 30_000;

export async function recordSyncMetric(m: SyncMetric): Promise<void> {
  try {
    const key = `${m.source}::${m.metric}`;
    const now = Date.now();
    const prev = lastSent.get(key) ?? 0;
    if (now - prev < THROTTLE_MS) return;
    lastSent.set(key, now);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // anon writes blocked by RLS anyway

    await supabase.from("sync_metrics").insert({
      source: m.source,
      metric: m.metric,
      value: m.value,
      severity: m.severity ?? "info",
      details: m.details ?? {},
    });
  } catch {
    // monitoring must never break dashboards
  }
}
