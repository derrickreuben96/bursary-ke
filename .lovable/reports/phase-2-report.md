# Phase 2 Implementation Report — Household-Centric Dashboards

## Modules Modified
- `src/pages/CommissionerDashboard.tsx` — added persistent "Households" tab that renders `<HouseholdList role="commissioner">`. Active tab now persists via `useDashboardState`. No existing tab, table, chart or workflow removed.
- `src/pages/TreasuryDashboard.tsx` — inserted "Household View" card between the summary cards and existing cycle table, rendering `<HouseholdList role="treasury">`. Existing cycle/disbursement UI untouched.
- `src/pages/AdminDashboard.tsx` — inserted "Household Statistics" tile between metric cards and charts. Renders top-25 households as `<HouseholdList role="admin">` (read-only).

## Shared Components / Engines Created
- `src/lib/household/types.ts` — canonical `Household`, `HouseholdStudent`, `HouseholdCohort`.
- `src/lib/household/statusEngine.ts` — role-scoped status labels. Commissioner never shows "Allocated"; treasury flips to `Allocated` only after every student is disbursed.
- `src/lib/household/workflowEngine.ts` — `availableActions(role, household)` + `releaseHouseholdToTreasury`. Wraps existing supabase mutations; no new RPCs.
- `src/lib/household/auditEngine.ts` — merges `application_status_history` + submit/release/disburse timestamps into a unified timeline.
- `src/lib/household/useHouseholds.ts` — one hook, one RPC (`get_parent_applications_for_commissioner`), silent 20s polling, `pendingNewCount` diff, history preload.
- `src/components/household/HouseholdCard.tsx` — canonical summary card (memoised). Header, metrics chip (`N Beneficiaries · N Secondary · N Higher Ed`), cohort lists, expanded audit + action panel.
- `src/components/household/HouseholdCohortList.tsx` — auto-hides empty cohorts.
- `src/components/household/HouseholdAuditTimeline.tsx` — vertical timeline.
- `src/components/household/HouseholdActionPanel.tsx` — one unified button set driven by `availableActions`.
- `src/components/household/HouseholdList.tsx` — search, filter, expand-preserving list. Uses `useDeferredValue` for input latency.
- `src/hooks/useDashboardState.ts` — `useDashboardState`, `useDashboardSet`, `useScrollRestoration` (all backed by `sessionStorage`).

## Components Reused
- `Card`, `Badge`, `Button`, `Input`, `Tabs` (shadcn) throughout.
- `useDashboardRealtime` (unchanged) continues to power push refresh in Commissioner/Treasury dashboards.
- Existing `TreasurySummaryCards`, `AiPdfConsentDialog`, `AiPdfPreviewDialog`, `StudentBeneficiariesPanel` untouched.

## Database Impact
None. No migrations, no new RPCs, no schema changes. `get_parent_applications_for_commissioner` already returns the household+students shape required.

## Officer-Experience Improvements
- **State persistence** — `activeTab`, search query and expanded household ids persist per-role via `sessionStorage`. Tab-switch / refresh / silent polls never reset the review.
- **Silent background sync** — 20s polling refreshes data without toggling `isLoading`. `pendingNewCount` surfaces a non-blocking "N New Applications — Refresh" pill; officers apply the diff manually.
- **Unified action panel** — dedupes ad-hoc row buttons. Same visual set on every dashboard, role-scoped.
- **Audit timeline** — every household expanded view shows Submit → Review → Approved → Pending Allocation → Disbursed with timestamps and actor.
- **Cohort auto-hiding** — Secondary-only households never render an empty Higher Education block; higher-ed-only households never render an empty Secondary block; mixed shows both.

## Performance
- `HouseholdCard` is `memo`-wrapped; cohort filtering runs client-side inside `HouseholdList` via `useMemo` + `useDeferredValue`.
- History fetched once per refresh cycle in a batched `IN (...)` query instead of per-card queries.
- Admin household list is windowed to top-25 to avoid overloading the admin monitoring surface.

## Regression Results
- Typecheck: `tsgo --noEmit` → 0 errors.
- Unit tests: `src/test/householdRendering.test.tsx` → **6/6 pass** (secondary-only hides Higher Ed, higher-ed-only hides Secondary, mixed shows both, commissioner never shows "Allocated", treasury shows "Allocated" after all students disbursed, recommended-allocation math).
- Existing suites (`consistencyWarnings.test.ts`, `dashboardPolling.test.ts`, `adminDashboardPii.test.tsx`, etc.) unchanged — no files they touch were modified beyond additive imports.

## Outstanding Risks / Recommendations
1. **Commissioner approve/reject is AI-owned** in this project. The workflow engine surfaces a toast rather than performing the mutation to preserve current governance. If governance shifts to human approval, wire those actions into `workflowEngine.ts` in one place.
2. **Print Summary** currently invokes `window.print()`. Replace with the existing `aiSummaryPdf` pipeline when a per-household PDF template is designed.
3. **Realtime broadcasts** already exist on the commissioner ward channel; the treasury dashboard's household section relies on silent polling only. Extending `useDashboardRealtime` to treasury households is a low-risk next step.
4. **Admin household list** is capped at 25 rows for legibility. Add server-side pagination when household counts exceed a few hundred per admin.

## Deployment Readiness
- No env, secret, migration or config change required.
- Pure additive frontend + shared library changes.
- Rollback = revert the eight new files and the small edits in the three dashboard pages.
