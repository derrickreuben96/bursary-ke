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

  it("anon UPDATE on bursary_applications is blocked", async () => {
    const sb = anonClient();
    const { data, error } = await sb
      .from("bursary_applications")
      .update({ status: "approved" })
      .eq("tracking_number", "BKE-AAAAAA")
      .select();
    // Either explicit denial or zero rows affected (RLS hides target rows)
    if (error) {
      expect(isDenialError(error.message, error.code)).toBe(true);
    } else {
      expect(data?.length ?? 0).toBe(0);
    }
  }, 15_000);

  it("anon DELETE on bursary_applications is blocked", async () => {
    const sb = anonClient();
    const { data, error } = await sb
      .from("bursary_applications")
      .delete()
      .eq("tracking_number", "BKE-AAAAAA")
      .select();
    if (error) {
      expect(isDenialError(error.message, error.code)).toBe(true);
    } else {
      expect(data?.length ?? 0).toBe(0);
    }
  }, 15_000);

  it("anon INSERT on user_roles is blocked", async () => {
    const sb = anonClient();
    const { error } = await sb
      .from("user_roles")
      .insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        role: "admin",
      });
    expect(error).not.toBeNull();
    expect(isDenialError(error!.message, error!.code)).toBe(true);
  }, 15_000);

  it("anon INSERT on application_status_history is blocked", async () => {
    const sb = anonClient();
    const { error } = await sb
      .from("application_status_history")
      .insert({
        application_id: "00000000-0000-0000-0000-000000000000",
        to_status: "approved",
      });
    expect(error).not.toBeNull();
    expect(isDenialError(error!.message, error!.code)).toBe(true);
  }, 15_000);

  const uploadViaRest = async (path: string) => {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/applicant-documents/${path}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "text/plain",
        },
        body: "test-payload",
      },
    );
    return res.status;
  };

  it("storage upload to applicant-documents with junk folder is blocked", async () => {
    const status = await uploadViaRest(`hacker-folder-xyz/test.txt`);
    expect([400, 401, 403]).toContain(status);
  }, 15_000);

  it("storage upload with valid format but non-existent tracking number is blocked", async () => {
    const status = await uploadViaRest(`BKE-ZZZZZZ/test.txt`);
    expect([400, 401, 403]).toContain(status);
  }, 15_000);

  it("storage upload under a temp-<timestamp> folder is allowed (pre-submission)", async () => {
    const status = await uploadViaRest(`temp-${Date.now()}/probe-${Math.random().toString(36).slice(2)}.txt`);
    expect([200, 201]).toContain(status);
  }, 15_000);

  it("storage upload under an EXISTING tracking_number folder is allowed (post-submission)", async () => {
    // Look up a real tracking number from the public-readable adverts? No — applications are RLS-protected.
    // Instead, use the public bursary_adverts surface to confirm anon connectivity, then attempt upload
    // using a known-existing tracking number passed via env, falling back to skip.
    const sb = anonClient();
    // We can't read tracking numbers as anon (correctly RLS-blocked), so we rely on the
    // policy: upload should succeed when folder == any tracking_number in bursary_applications.
    // Use a tracking number provided at test-time via VITE_TEST_TRACKING_NUMBER.
    const tn = (import.meta.env.VITE_TEST_TRACKING_NUMBER as string | undefined) ?? "BKE-2B1286";
    const status = await uploadViaRest(`${tn}/post-submit-${Date.now()}.txt`);
    expect([200, 201]).toContain(status);
    void sb;
  }, 15_000);

  it("storage upload under a malformed/lowercase tracking_number is blocked", async () => {
    const status = await uploadViaRest(`bke-aaaaaa/test.txt`);
    expect([400, 401, 403]).toContain(status);
  }, 15_000);

  it("storage upload under an empty / root path is blocked", async () => {
    const status = await uploadViaRest(`rootfile-${Date.now()}.txt`);
    expect([400, 401, 403]).toContain(status);
  }, 15_000);
});
