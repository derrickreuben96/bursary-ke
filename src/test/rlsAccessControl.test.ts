// Browser-runnable RLS access-control tests (run via `vitest run`).
// Uses the public anon key only — safe for CI. Mirrors the Deno suite at
// supabase/functions/_tests/rls_test.ts so the protections are verified from
// both edge and frontend code paths.

import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const hasEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const anonClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const PII_TABLES = [
  "bursary_applications",
  "profiles",
  "user_roles",
  "applicant_history",
  "fairness_tracking",
  "fairness_audit_log",
  "application_status_history",
  "allocation_cycles",
  "bursary_subscriptions",
] as const;

const PROTECTED_RPCS = [
  "get_treasury_applications",
  "get_commissioner_applications",
] as const;

const isDenialError = (msg: string, code?: string) =>
  /permission|denied|policy|not allowed|JWT|does not exist/i.test(msg) ||
  code === "42501" ||
  code === "PGRST301";

describe.skipIf(!hasEnv)("RLS — anon access control", () => {
  it.each(PII_TABLES)("anon SELECT on %s leaks no rows", async (table) => {
    const sb = anonClient();
    const { data, error } = await sb.from(table).select("*").limit(5);

    if (error) {
      expect(
        isDenialError(error.message, error.code),
        `Unexpected error on ${table}: ${error.message}`,
      ).toBe(true);
    } else {
      expect(data?.length ?? 0).toBe(0);
    }
  }, 15_000);

  it.each(PROTECTED_RPCS)("anon RPC %s is denied or empty", async (fn) => {
    const sb = anonClient();
    const { data, error } = await sb.rpc(fn);

    if (error) {
      expect(isDenialError(error.message, error.code)).toBe(true);
    } else {
      expect(Array.isArray(data) ? data.length : 0).toBe(0);
    }
  }, 15_000);

  it("anon CAN read public bursary_adverts surface", async () => {
    const sb = anonClient();
    const { error } = await sb
      .from("bursary_adverts")
      .select("id,title,is_active")
      .eq("is_active", true)
      .limit(1);

    if (error) {
      expect(/permission|denied|policy/i.test(error.message)).toBe(false);
    }
  }, 15_000);
});
