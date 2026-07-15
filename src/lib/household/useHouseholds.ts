// Central household data hook. One RPC call, one normalization.
// Silent refresh does NOT toggle isLoading — dashboards keep their UI state.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Household } from "./types";
import { cohortOf } from "./types";
import type { StatusHistoryRow } from "./auditEngine";

interface Options {
  ward?: string | null;
  county?: string | null;
  pollMs?: number;
}

interface State {
  households: Household[];
  historyByHouseholdId: Record<string, StatusHistoryRow[]>;
  loading: boolean;
  pendingNewCount: number;
  lastFetched: Date | null;
}

function normalize(row: any): Household {
  const students = (Array.isArray(row.students) ? row.students : []).map((s: any) => ({
    id: s.id,
    name_masked: s.student_name_masked ?? "Student",
    student_type: s.student_type ?? "secondary",
    cohort: cohortOf(s.student_type ?? "secondary"),
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
  }));
  return {
    id: row.id,
    tracking_number: row.tracking_number,
    parent_name_masked: row.parent_name_masked ?? "N/A",
    parent_county: row.parent_county ?? "",
    parent_ward: row.parent_ward ?? null,
    household_income: row.household_income ?? null,
    household_dependents: row.household_dependents ?? null,
    poverty_tier: row.poverty_tier ?? null,
    poverty_score: row.poverty_score ?? null,
    total_students: row.total_students ?? students.length,
    released_to_treasury: !!row.released_to_treasury,
    ai_decision_reason: row.ai_decision_reason ?? null,
    advert_id: row.advert_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status ?? "received",
    current_stage: row.current_stage ?? null,
    students,
  };
}

export function useHouseholds({ ward, county, pollMs = 20000 }: Options = {}): State & {
  refresh: () => Promise<void>;
  acknowledgeNew: () => void;
} {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [historyByHouseholdId, setHistory] = useState<Record<string, StatusHistoryRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase.rpc("get_parent_applications_for_commissioner");
    if (error) {
      if (!silent) setLoading(false);
      return;
    }
    let rows = (data || []).map(normalize) as Household[];
    if (ward) rows = rows.filter(r => r.parent_ward === ward);
    else if (county) rows = rows.filter(r => r.parent_county === county);

    const nextIds = new Set(rows.map(r => r.id));
    if (!firstLoadRef.current) {
      let added = 0;
      nextIds.forEach(id => { if (!prevIdsRef.current.has(id)) added++; });
      if (added > 0) setPendingNewCount(c => c + added);
    }
    prevIdsRef.current = nextIds;
    firstLoadRef.current = false;

    setHouseholds(rows);

    // Status history for audit timeline
    if (rows.length > 0) {
      const { data: hist } = await supabase
        .from("application_status_history")
        .select("id, from_status, to_status, changed_at, application_id, changed_by")
        .in("application_id", rows.map(r => r.id))
        .order("changed_at", { ascending: true });
      if (hist) {
        const grouped: Record<string, StatusHistoryRow[]> = {};
        for (const h of hist as any[]) {
          (grouped[h.application_id] ??= []).push(h as StatusHistoryRow);
        }
        setHistory(grouped);
      }
    }

    setLastFetched(new Date());
    if (!silent) setLoading(false);
  }, [ward, county]);

  useEffect(() => {
    void fetchAll(false);
  }, [fetchAll]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchAll(true);
    }, pollMs);
    return () => clearInterval(id);
  }, [fetchAll, pollMs]);

  const refresh = useCallback(async () => { await fetchAll(true); }, [fetchAll]);
  const acknowledgeNew = useCallback(() => setPendingNewCount(0), []);

  return { households, historyByHouseholdId, loading, pendingNewCount, lastFetched, refresh, acknowledgeNew };
}
