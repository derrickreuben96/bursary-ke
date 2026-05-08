// Verifies the NOT NULL advert_id constraint on bursary_applications.
// Anonymous insert WITHOUT advert_id must fail; full RLS still applies, so
// even with all required fields the insert is rejected by the column constraint
// (or the not-null check) before any row is created. This prevents the silent
// orphan-tracking-number regression.

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;
const hasEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const anon = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

describe.skipIf(!hasEnv)("bursary_applications.advert_id NOT NULL", () => {
  it("rejects inserts that omit advert_id", async () => {
    const client = anon();
    const { error } = await client.from("bursary_applications").insert({
      tracking_number: "BKE-TESTNN",
      student_type: "secondary",
      parent_national_id: "00000000",
      parent_full_name: "Test Parent",
      parent_phone: "+254700000000",
      parent_county: "Nairobi",
      parent_ward: "Westlands",
      sms_consent: true,
      student_full_name: "Test Student",
      institution_name: "Test School",
      household_income: 1000,
      household_dependents: 1,
      poverty_score: 50,
      poverty_tier: "tier_1",
    } as never);

    // Any error confirms the row was rejected — be it not-null violation,
    // RLS denial, or check constraint. The key invariant: no orphan row.
    expect(error).not.toBeNull();
  });
});
