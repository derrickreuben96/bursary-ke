// Push-based dashboard updates via Supabase Realtime broadcast.
// Payload is sanitized server-side (see emit_dashboard_event trigger):
// only application_id, status, released_to_treasury, ts — never PII.
// Falls back gracefully to polling if the websocket is unhealthy.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordSyncMetric } from "@/lib/syncMetrics";

export type DashboardScope =
  | { kind: "admin" }
  | { kind: "commissioner"; ward: string }
  | { kind: "treasury"; county: string };

const slug = (v: string) => v.toLowerCase().replace(/\s+/g, "_");

export function topicFor(scope: DashboardScope): string {
  switch (scope.kind) {
    case "admin": return "dashboard:admin";
    case "commissioner": return `dashboard:commissioner:${slug(scope.ward)}`;
    case "treasury": return `dashboard:treasury:${slug(scope.county)}`;
  }
}

export function useDashboardRealtime(
  scope: DashboardScope | null,
  onChange: () => void,
) {
  const lastRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!scope) return;
    const topic = topicFor(scope);
    const channel = supabase.channel(topic, { config: { private: false } });

    channel
      .on("broadcast", { event: "app.change" }, (msg) => {
        const now = Date.now();
        const sentAt = (msg?.payload as { ts?: number } | undefined)?.ts;
        if (typeof sentAt === "number") {
          const latencyMs = Math.max(0, now - Math.round(sentAt * 1000));
          void recordSyncMetric({
            source: topic,
            metric: "broadcast_latency_ms",
            value: latencyMs,
            severity: latencyMs > 5000 ? "warn" : "info",
          });
        }
        lastRef.current = now;
        onChange();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void recordSyncMetric({ source: topic, metric: "channel_subscribed", value: 1 });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void recordSyncMetric({
            source: topic, metric: "channel_error", value: 1, severity: "error",
            details: { status },
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope?.kind, "ward" in (scope ?? {}) ? (scope as { ward?: string }).ward : "",
      "county" in (scope ?? {}) ? (scope as { county?: string }).county : "",
      onChange]);
}
