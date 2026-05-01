// Integration tests verifying RLS and SECURITY DEFINER function access control.
// These run against the live Supabase project using only the anon key — no
// service role key is required, so they're safe to run from CI.
//
// Coverage:
//  - Anonymous SELECT is denied on PII / sensitive tables
//  - Anonymous cannot call SECURITY DEFINER RPCs reserved for authenticated roles
//  - A freshly signed-up user with no role assignment (default 'user') is
//    treated like a non-commissioner / non-treasury actor and is denied access
//    to commissioner/treasury views and RPCs.
//
// Run with: supabase functions test (Deno test runner)

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

assert(SUPABASE_URL, "SUPABASE_URL is required");
assert(SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY is required");

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Tables that should NEVER be readable by anon
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

// SECURITY DEFINER RPCs that should reject anon callers
const PROTECTED_RPCS = [
  "get_treasury_applications",
  "get_commissioner_applications",
] as const;

// ---------------------------------------------------------------------------
// 1. Anon access to PII tables must return zero rows (RLS deny)
// ---------------------------------------------------------------------------
for (const table of PII_TABLES) {
  Deno.test(`anon SELECT on ${table} returns no rows`, async () => {
    const sb = anonClient();
    const { data, error } = await sb.from(table).select("*").limit(5);

    // PostgREST returns either an explicit error OR an empty array under RLS
    // depending on policy shape. Both are acceptable as long as no row leaks.
    if (error) {
      // permission denied / RLS rejection — acceptable
      assert(
        /permission|denied|policy|not allowed|JWT/i.test(error.message) ||
          error.code === "42501" ||
          error.code === "PGRST301",
        `Unexpected error on ${table}: ${error.message}`,
      );
    } else {
      assertEquals(
        data?.length ?? 0,
        0,
        `RLS leak: anon read ${data?.length} rows from ${table}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 2. SECURITY DEFINER RPCs must reject anon callers
// ---------------------------------------------------------------------------
for (const fn of PROTECTED_RPCS) {
  Deno.test(`anon cannot invoke RPC ${fn}`, async () => {
    const sb = anonClient();
    const { data, error } = await sb.rpc(fn);

    if (error) {
      assert(
        /permission|denied|not allowed|JWT|does not exist/i.test(
          error.message,
        ) || error.code === "42501",
        `Unexpected RPC error for ${fn}: ${error.message}`,
      );
    } else {
      // EXECUTE was revoked from anon — if it somehow succeeds, it must at
      // minimum return zero rows (no data leak through the function body).
      assertEquals(
        Array.isArray(data) ? data.length : 0,
        0,
        `RLS leak via RPC ${fn}: returned ${JSON.stringify(data).slice(0, 200)}`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Anon-readable surfaces should still work (sanity check — not a leak)
// ---------------------------------------------------------------------------
Deno.test("anon CAN read active bursary_adverts (public surface)", async () => {
  const sb = anonClient();
  const { error } = await sb
    .from("bursary_adverts")
    .select("id,title,county,is_active")
    .eq("is_active", true)
    .limit(1);
  // Must not be a permission error; row count may legitimately be 0.
  if (error) {
    assert(
      !/permission|denied|policy/i.test(error.message),
      `bursary_adverts public read unexpectedly blocked: ${error.message}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. A freshly signed-up authenticated user (default 'user' role only) is
//    treated as non-commissioner / non-treasury and must be denied.
// ---------------------------------------------------------------------------
Deno.test({
  name: "non-privileged authenticated user is denied commissioner/treasury access",
  // Email signups may be disabled in some environments; skip gracefully.
  ignore: Deno.env.get("SKIP_AUTH_TESTS") === "1",
  fn: async () => {
    const sb = anonClient();
    const email = `rls-test-${crypto.randomUUID()}@example.com`;
    const password = `Pw!${crypto.randomUUID()}`;

    const { data: signUp, error: signUpErr } = await sb.auth.signUp({
      email,
      password,
    });

    if (signUpErr || !signUp.session) {
      // If email confirmation is required (no session), we cannot complete
      // this assertion path in CI — treat as skipped rather than failing.
      console.warn(
        `Skipping authed test (signup did not yield session): ${signUpErr?.message ?? "email confirmation required"}`,
      );
      return;
    }

    // Commissioner RPC — should return zero rows for a plain user
    const { data: commData, error: commErr } = await sb.rpc(
      "get_commissioner_applications",
    );
    if (!commErr) {
      assertEquals(
        Array.isArray(commData) ? commData.length : 0,
        0,
        "Plain user leaked commissioner applications",
      );
    }

    // Treasury RPC — same expectation
    const { data: treasData, error: treasErr } = await sb.rpc(
      "get_treasury_applications",
    );
    if (!treasErr) {
      assertEquals(
        Array.isArray(treasData) ? treasData.length : 0,
        0,
        "Plain user leaked treasury applications",
      );
    }

    // Direct table reads must also be empty for a non-admin / non-commissioner
    const { data: appsData, error: appsErr } = await sb
      .from("bursary_applications")
      .select("id")
      .limit(5);
    if (!appsErr) {
      assertEquals(
        appsData?.length ?? 0,
        0,
        "Plain user leaked bursary_applications rows",
      );
    }

    // has_role(self, 'admin') must be false for this user
    const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
      _user_id: signUp.user!.id,
      _role: "admin",
    });
    if (!roleErr) {
      assertNotEquals(isAdmin, true, "Fresh user wrongly reported as admin");
    }

    await sb.auth.signOut();
  },
});
