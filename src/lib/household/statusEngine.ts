// Derives display status per role. Commissioner NEVER sees "Allocated".
// Treasury flips to Allocated / Disbursed. Admin sees the raw pipeline.
import type { Household } from "./types";

export type DashboardRole = "commissioner" | "treasury" | "admin";

export interface DisplayStatus {
  label: string;
  tone: "neutral" | "warning" | "success" | "info" | "danger";
}

export function displayStatus(h: Household, role: DashboardRole): DisplayStatus {
  const raw = (h.status || "").toLowerCase();
  const released = h.released_to_treasury;

  if (role === "commissioner") {
    if (raw === "rejected") return { label: "Rejected", tone: "danger" };
    if (raw === "approved" && released) return { label: "Approved · Pending Treasurer Allocation", tone: "success" };
    if (raw === "approved") return { label: "Approved · Pending Release", tone: "success" };
    if (raw === "disbursed") return { label: "Approved · Pending Treasurer Allocation", tone: "success" };
    if (raw === "returned") return { label: "Returned for Correction", tone: "warning" };
    return { label: "Pending Review", tone: "neutral" };
  }

  if (role === "treasury") {
    if (raw === "disbursed") return { label: "Disbursed", tone: "info" };
    // Any approved student that treasury has finalised.
    const anyAllocated = h.students.some(s => s.status === "disbursed" || (s.allocated_amount && s.allocated_amount > 0 && s.released_to_treasury && s.status === "approved" && s.disability_status !== undefined));
    if (raw === "approved" && released && anyAllocated && h.students.every(s => s.status === "disbursed")) {
      return { label: "Allocated", tone: "success" };
    }
    if (released) return { label: "Pending Allocation", tone: "warning" };
    return { label: "Awaiting Commissioner", tone: "neutral" };
  }

  // admin — raw
  return { label: raw ? raw[0].toUpperCase() + raw.slice(1) : "Unknown", tone: "neutral" };
}

/** Recommended allocation total for the household (AI). */
export function recommendedAllocation(h: Household): number {
  return h.students.reduce((sum, s) => sum + (Number(s.allocated_amount) || 0), 0);
}
