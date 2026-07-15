// Builds a unified audit timeline for a household by merging
// application_status_history + submission/allocation/release timestamps.
import type { Household } from "./types";

export interface AuditEntry {
  key: string;
  action: string;
  actor: string | null;
  at: string; // ISO
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

export interface StatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by?: string | null;
}

export function buildTimeline(h: Household, history: StatusHistoryRow[] = []): AuditEntry[] {
  const entries: AuditEntry[] = [];
  entries.push({
    key: `submit-${h.id}`,
    action: "Submitted",
    actor: h.parent_name_masked,
    at: h.created_at,
    tone: "neutral",
  });

  for (const row of history) {
    const to = (row.to_status || "").toLowerCase();
    let tone: AuditEntry["tone"] = "info";
    let action = `Status: ${row.from_status ?? "submitted"} → ${row.to_status}`;
    if (to === "approved") { tone = "success"; action = "Commissioner Approved"; }
    else if (to === "rejected") { tone = "danger"; action = "Rejected"; }
    else if (to === "disbursed") { tone = "info"; action = "Treasurer Allocated / Disbursed"; }
    else if (to === "review" || to === "verification") { action = "Under Review"; }
    entries.push({
      key: row.id,
      action,
      actor: row.changed_by ?? null,
      at: row.changed_at,
      tone,
    });
  }

  if (h.released_to_treasury) {
    entries.push({
      key: `release-${h.id}`,
      action: "Pending Treasurer Allocation",
      actor: null,
      at: h.updated_at,
      tone: "warning",
    });
  }

  const anyDisbursed = h.students.some(s => s.status === "disbursed");
  if (anyDisbursed) {
    entries.push({
      key: `disbursed-${h.id}`,
      action: "Disbursed",
      actor: null,
      at: h.updated_at,
      tone: "success",
    });
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
