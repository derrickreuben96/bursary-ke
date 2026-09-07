// Live snapshot loader — feeds the governance simulator with real applicant
// data (all education levels: secondary, university, college, TVET) instead of
// a static demo set. Read-only; never writes to allocation tables.
import { supabase } from "@/integrations/supabase/client";
import type { Household } from "@/lib/household/types";
import { cohortOf } from "@/lib/household/types";
import type { HouseholdContext, StudentContext } from "./decisionEngine";
import { maskName } from "@/lib/maskData";

export interface LiveSnapshot {
  households: Household[];
  household_ctx: Record<string, HouseholdContext>;
  student_ctx: Record<string, StudentContext>;
}

interface StudentRow {
  id: string;
  parent_application_id: string;
  student_full_name: string;
  student_type: string;
  education_category: string | null;
  institution_name: string;
  class_form: string | null;
  year_of_study: string | null;
  status: string;
  allocated_amount: number | null;
  released_to_treasury: boolean;
  ai_decision_reason: string | null;
  fraud_score: number | null;
  disability_status: string | null;
  ncpwd_registration_number: string | null;
  disability_card_url: string | null;
  dvl_verified_at: string | null;
  fee_balance: number | null;
}

interface ParentRow {
  id: string;
  tracking_number: string;
  parent_full_name: string;
  parent_county: string;
  parent_ward: string | null;
  household_income: number;
  household_dependents: number;
  poverty_tier: string | null;
  poverty_score: number | null;
  total_students: number;
  released_to_treasury: boolean;
  ai_decision_reason: string | null;
  advert_id: string | null;
  status: string;
  current_stage: string | null;
  household_disability_burden: boolean | null;
  created_at: string;
  updated_at: string;
}

export async function loadLiveSnapshot(limit = 200): Promise<LiveSnapshot> {
  const { data: parents } = await supabase
    .from("parent_applications")
    .select(
      "id, tracking_number, parent_full_name, parent_county, parent_ward, household_income, household_dependents, poverty_tier, poverty_score, total_students, released_to_treasury, ai_decision_reason, advert_id, status, current_stage, household_disability_burden, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const parentRows = (parents as ParentRow[] | null) ?? [];
  if (parentRows.length === 0) {
    return { households: [], household_ctx: {}, student_ctx: {} };
  }

  const { data: studs } = await supabase
    .from("student_beneficiaries")
    .select(
      "id, parent_application_id, student_full_name, student_type, education_category, institution_name, class_form, year_of_study, status, allocated_amount, released_to_treasury, ai_decision_reason, fraud_score, disability_status, ncpwd_registration_number, disability_card_url, dvl_verified_at, fee_balance",
    )
    .in("parent_application_id", parentRows.map((p) => p.id));

  const studentRows = (studs as StudentRow[] | null) ?? [];
  const byParent = new Map<string, StudentRow[]>();
  for (const s of studentRows) {
    const list = byParent.get(s.parent_application_id) ?? [];
    list.push(s);
    byParent.set(s.parent_application_id, list);
  }

  const household_ctx: Record<string, HouseholdContext> = {};
  const student_ctx: Record<string, StudentContext> = {};
  const households: Household[] = [];

  for (const p of parentRows) {
    const rows = byParent.get(p.id) ?? [];
    if (rows.length === 0) continue;

    households.push({
      id: p.id,
      tracking_number: p.tracking_number,
      parent_name_masked: maskName(p.parent_full_name || ""),
      parent_county: p.parent_county ?? "",
      parent_ward: p.parent_ward ?? null,
      household_income: p.household_income ?? null,
      household_dependents: p.household_dependents ?? null,
      poverty_tier: p.poverty_tier ?? null,
      poverty_score: p.poverty_score ?? null,
      total_students: p.total_students ?? rows.length,
      released_to_treasury: !!p.released_to_treasury,
      ai_decision_reason: p.ai_decision_reason ?? null,
      advert_id: p.advert_id ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      status: p.status ?? "received",
      current_stage: p.current_stage ?? null,
      students: rows.map((s) => ({
        id: s.id,
        name_masked: maskName(s.student_full_name || ""),
        student_type: s.education_category ?? s.student_type ?? "secondary",
        cohort: cohortOf(s.education_category ?? s.student_type ?? "secondary"),
        institution_name: s.institution_name ?? null,
        class_form: s.class_form ?? null,
        year_of_study: s.year_of_study ?? null,
        status: s.status ?? "received",
        allocated_amount: s.allocated_amount != null ? Number(s.allocated_amount) : null,
        released_to_treasury: !!s.released_to_treasury,
        ai_decision_reason: s.ai_decision_reason ?? null,
        fraud_score: s.fraud_score != null ? Number(s.fraud_score) : null,
        disability_status: s.disability_status ?? null,
        ncpwd_registration_number: s.ncpwd_registration_number ?? null,
        disability_card_url: s.disability_card_url ?? null,
        dvl_verified_at: s.dvl_verified_at ?? null,
      })),
    });

    household_ctx[p.id] = {
      monthly_income: p.household_income != null ? Math.round(Number(p.household_income) / 12) : undefined,
      dependents: p.household_dependents ?? undefined,
      disabled_member: !!p.household_disability_burden,
    } as HouseholdContext;

    for (const s of rows) {
      student_ctx[s.id] = {
        fee_balance: s.fee_balance != null ? Number(s.fee_balance) : undefined,
        exam_class: /(form\s*4|grade\s*12)/i.test(s.class_form ?? ""),
      } as StudentContext;
    }
  }

  return { households, household_ctx, student_ctx };
}
