## Phase 2 Plan — Household-Centric Dashboards

Scope is limited to dashboards, workflow engine, rendering, persistence and audit UI. Application wizard (Phase 1) is untouched. No destructive DB changes — all additive.

### 1. Centralized engines (new shared code)

`src/lib/household/` — single source of truth reused by Commissioner, Treasury, Admin:

- `types.ts` — `Household`, `HouseholdStudent`, `HouseholdStatus`, `HouseholdCohort`.
- `useHouseholds.ts` — one hook that calls `get_parent_applications_for_commissioner` (admin/commissioner) or filters treasury RPC, returns normalized households + status history. Handles silent refresh; exposes `newCount` for "N New Applications" banner.
- `statusEngine.ts` — derives display status per role:
  - Commissioner: `Pending Review` → `Approved · Pending Treasurer Allocation` / `Rejected` / `Returned`
  - Treasury: `Pending Allocation` → `Allocated` → `Disbursed`
  - Admin: raw pipeline stages.
  - Never shows "Allocated" in commissioner view.
- `workflowEngine.ts` — role-gated actions: `approve`, `reject`, `return_for_correction` (commissioner); `allocate`, `disburse` (treasury). Wraps existing supabase mutations already used by the two dashboards; no new RPCs.
- `auditEngine.ts` — merges `application_status_history` + `dvl_verified_at` + `allocation_date` + `released_to_treasury` timestamp into a unified timeline with actor + action.

### 2. Household Rendering Engine (new shared components)

`src/components/household/`:

- `HouseholdCard.tsx` — summary: tracking #, parent (masked), ward, date, status badge, metrics chip (`4 Beneficiaries · 2 Secondary · 2 Higher Ed`). Auto-hides empty cohort sections.
- `HouseholdCohortList.tsx` — renders "Secondary Students" and "Higher Education Students" sub-lists; hides section if empty. Determines cohort from `student_type`.
- `HouseholdExpanded.tsx` — expanded panel: Details → Secondary → Higher Ed → Assessment Summary → Audit Timeline → Officer Actions.
- `HouseholdAuditTimeline.tsx` — vertical timeline (Submitted → Reviewed → Approved → Pending Allocation → Allocated → Disbursed) using `auditEngine` output.
- `HouseholdActionPanel.tsx` — one unified panel; buttons rendered from `workflowEngine.availableActions(role, household)`. Deduplicates the ad-hoc buttons currently scattered across dashboards.
- `HouseholdList.tsx` — virtualized list wrapper (React.memo per card + `useDeferredValue` for filter input) for performance with large wards.

### 3. Dashboard state persistence

`src/hooks/useDashboardState.ts` — generic `useState`-like hook that syncs to `sessionStorage` under a scoped key. Applied to:

- search query, filters, active tab, pagination page, sort key/dir
- expanded household id set, selected record id, open modal id
- scroll position (via `useScrollRestoration` on the main container)
- officer notes drafts (per-household, keyed by tracking #)

Rehydrates on mount; `visibilitychange` does NOT trigger reloads or reset UI. Silent polling continues in background but data merges without collapsing expansions.

### 4. Background sync

Extend existing `useDashboardRealtime` consumers to:

- Diff incoming ids vs prev; surface a non-blocking sticky pill: **"3 New Applications Received — Refresh"**.
- Never auto-scroll or auto-close expanded rows.
- Manual refresh button applies the pending diff.

### 5. Dashboard integration (edits only, no rewrites)

- `src/pages/CommissionerDashboard.tsx` — replace ad-hoc row rendering with `<HouseholdList>`. Remove any "Allocated" labels; use `statusEngine` for badge text. Add "Recommended Allocation KES x" display for approved rows.
- `src/pages/TreasuryDashboard.tsx` — render households with `<HouseholdList>`; show AI Recommendation vs Officer Decision columns; only Treasury path flips status to `Allocated` / `Disbursed`.
- `src/pages/AdminDashboard.tsx` — add Household Statistics tile (households, avg students/HH, cohort mix) using existing data. Keep current cards; do not overload.

### 6. Regression tests (Vitest)

`src/test/householdRendering.test.tsx`:
- secondary-only household hides Higher Ed section
- higher-ed-only hides Secondary section
- mixed shows both
- commissioner never shows "Allocated"
- treasury shows "Allocated" after allocation
- audit timeline order

`src/test/dashboardPersistence.test.ts`:
- tab, filter, expanded set survive unmount/remount
- silent poll does not collapse expanded rows

### Out of scope
- No schema changes, no new RPCs, no notification/AI/allocation logic changes, no wizard changes, no visual redesign.

### Deliverable
Implementation report at `.lovable/reports/phase-2-report.md`: modules modified, shared components, DB impact (none), regression results, risks.
