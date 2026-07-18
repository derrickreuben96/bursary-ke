
# Phase 6 — AI Governance Layer

Additive-only. No changes to Phases 1–5 behaviour, applicant flow, dashboards, or existing RPCs. All new work sits behind admin-only routes and a new `governance` feature flag.

## Scope Confirmation

This is a large module (~15 subsystems in the brief). To ship safely without breaking production I propose splitting it into **three sub-phases** and executing them in order. Confirm the split, or tell me to compress.

---

## Sub-Phase 6A — Policy Administration + Versioning (foundation)

**Goal:** move policy config out of `src/lib/ai/policyProfile.ts` into a versioned DB table, with an admin CRUD UI and a read-through cache. Every recommendation records the version it used.

**DB (single migration)**
- `policy_profiles` — id, name, version (semver), body jsonb (full `PolicyProfile`), status enum (`draft|pending|active|archived`), created_by, approved_by, approved_at, activated_at, reason, change_summary, timestamps.
- `policy_audit_log` — policy_id, action (`create|edit|submit|approve|activate|archive|simulate`), actor uuid, diff jsonb, occurred_at.
- `ai_recommendation_log` — student_beneficiary_id, policy_version, needs_score, recommended_allocation, reasons jsonb, input_hash, generated_at. (Enables drift + consistency later.)
- GRANTs for `authenticated` + `service_role`. RLS: read = admin; write = admin; approve/activate = admin with a second `governance_approver` app_role check (added to `app_role` enum).
- `has_role` unchanged.

**Code**
- `src/lib/ai/policyProfile.ts` — extend `loadPolicyProfile(id)` to fall back to DB when `governance` flag on; default profile still returned when DB empty.
- `src/lib/ai/decisionEngine.ts` — no logic change; already stores `policy_version` on output. Add optional side-effect: when caller passes `logRun: true`, write to `ai_recommendation_log` via service RPC.
- New `src/pages/admin/PolicyAdministration.tsx` (route `/admin/governance/policies`) — list, create draft, edit, submit for approval, approve, activate, archive, view diff/history.
- Reused shadcn: Table, Dialog, Form (RHF+Zod), Tabs.

**Tests**
- `policyProfileVersioning.test.ts` — CRUD, status transitions, diff generation.

---

## Sub-Phase 6B — Simulation (Policy + Budget)

**Goal:** dry-run policy or budget changes against a snapshot of pending/approved household data. Zero writes to allocation tables.

**Code**
- `src/lib/ai/simulator.ts` — `simulatePolicy({ profile, households, budget? })` → aggregates estimated beneficiaries, avg allocation, tier distribution, deficit/surplus. Reuses `evaluateHousehold` in-memory only.
- `src/pages/admin/PolicySimulator.tsx` (`/admin/governance/simulator`) — side-by-side compare (active vs draft), Recharts distribution chart.
- `src/pages/admin/BudgetSimulator.tsx` (`/admin/governance/budget`) — enter budget + cohort caps → estimated coverage %.
- `simulation_runs` table (id, actor, policy_id, params jsonb, results jsonb, created_at) — audit only.

**Tests**
- `simulator.test.ts` — deterministic outputs for fixed inputs; no DB mutation.

---

## Sub-Phase 6C — Governance Monitoring & Health Dashboard

**Goal:** observability only. No behavioural change.

**Code**
- `src/lib/ai/governance/drift.ts` — compare last-N cycle averages by cohort; flag > configurable stddev.
- `src/lib/ai/governance/fairness.ts` — aggregate approval rates by disability / orphan / county / cohort from `ai_recommendation_log` + `student_beneficiaries`.
- `src/lib/ai/governance/consistency.ts` — cluster similar households (income band + cohort + vulnerability flags), flag pairs with allocation delta > threshold.
- `src/lib/ai/governance/overrides.ts` — read `application_status_history` + officer overrides → override rate, top reasons.
- `src/lib/ai/governance/dataQuality.ts` — reuse existing `duplicateDetector` + new checks (missing docs, orphaned household refs).
- `src/pages/admin/AIGovernanceDashboard.tsx` (`/admin/governance`) — tiles: engine status, active policy, avg recommendation time, consistency score, fairness summary, drift status, last review timestamps, quick links.
- `governance_notifications` table + list view — surfaced in existing admin notification area, no toast/interrupt.
- Monthly report generator reuses `src/lib/reporting/exportPdf.ts`.

**Tests**
- `governance/drift.test.ts`, `fairness.test.ts`, `consistency.test.ts`, `overrides.test.ts` — pure-function unit tests on fixture data.

---

## Cross-cutting

- Feature flag: `VITE_FF_GOVERNANCE` (default **off** until 6A+6B+6C all pass). Legacy `DEFAULT_POLICY_PROFILE` remains the fallback when off — instant rollback.
- New nav entry visible only when `isAdmin && featureFlags.governance`.
- All new tables use `SECURITY DEFINER` RPCs for admin reads (mirrors existing pattern).
- No changes to: applicant wizard, tracking, notifications, dashboards' existing tabs, RLS on Phase 1–5 tables, edge functions.
- Regression: run existing 135-test suite after each sub-phase.

---

## Technical Details

Files to add (~18):
```
supabase/migrations/<ts>_phase6_governance.sql
src/lib/ai/simulator.ts
src/lib/ai/governance/{drift,fairness,consistency,overrides,dataQuality}.ts
src/pages/admin/{PolicyAdministration,PolicySimulator,BudgetSimulator,AIGovernanceDashboard}.tsx
src/components/governance/{PolicyDiffCard,PolicyVersionBadge,GovernanceTile,DriftAlert}.tsx
src/test/governance/*.test.ts (5)
.lovable/reports/phase-6-report.md
```

Files touched (minimal, additive only):
```
src/App.tsx                          – 4 new admin routes
src/lib/ai/policyProfile.ts          – DB fallback path (flag-gated)
src/lib/ai/decisionEngine.ts         – optional logRun side-effect
src/lib/featureFlags.ts              – add `governance`
src/pages/AdminDashboard.tsx         – 1 nav card linking to /admin/governance
```

No modifications to `bursary_applications`, `parent_applications`, `student_beneficiaries`, `disbursements`, or any existing RPC.

---

## Confirm before I build

1. **Split into 6A → 6B → 6C** (safer, ~1 turn each), or one shot?
2. **Add `governance_approver` app_role** for the two-person policy activation rule, or reuse `admin`?
3. Ship with governance flag **off** by default (recommended) so no user-visible change until admins opt in?
