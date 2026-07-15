// Role-gated household actions. Wraps existing supabase mutations only —
// no new RPCs, no schema change. The engine returns a list of actions per
// role so every dashboard renders the same buttons in the same order.
import { supabase } from "@/integrations/supabase/client";
import type { Household } from "./types";
import type { DashboardRole } from "./statusEngine";

export type HouseholdAction =
  | "view"
  | "approve"
  | "reject"
  | "return_for_correction"
  | "release_to_treasury"
  | "allocate"
  | "disburse"
  | "print_summary";

export function availableActions(role: DashboardRole, h: Household): HouseholdAction[] {
  const raw = (h.status || "").toLowerCase();
  if (role === "commissioner") {
    if (raw === "approved" && !h.released_to_treasury) {
      return ["view", "release_to_treasury", "print_summary"];
    }
    if (raw === "approved") return ["view", "print_summary"];
    if (raw === "rejected" || raw === "disbursed") return ["view", "print_summary"];
    return ["view", "approve", "reject", "return_for_correction", "print_summary"];
  }
  if (role === "treasury") {
    if (!h.released_to_treasury) return ["view"];
    if (raw === "approved") return ["view", "allocate", "print_summary"];
    if (raw === "disbursed") return ["view", "print_summary"];
    return ["view", "print_summary"];
  }
  // admin — read-only monitoring
  return ["view", "print_summary"];
}

export async function releaseHouseholdToTreasury(h: Household): Promise<void> {
  const approvedIds = h.students
    .filter(s => s.status === "approved" && !s.released_to_treasury)
    .map(s => s.id);
  if (approvedIds.length === 0) throw new Error("No AI-approved students to release");
  const { error: stuErr } = await supabase
    .from("student_beneficiaries")
    .update({ released_to_treasury: true })
    .in("id", approvedIds);
  if (stuErr) throw stuErr;
  await supabase.from("parent_applications").update({ released_to_treasury: true }).eq("id", h.id);
}
