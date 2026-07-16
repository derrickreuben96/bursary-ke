// Version 2.0 feature flags. Read from Vite env at build time with safe
// defaults (all enabled). Administrators can disable a v2 module by setting
// the corresponding VITE_FF_* var to "false" and redeploying — legacy code
// paths remain intact, so rollback is a redeploy, not a migration.
//
// Flags are intentionally read-only in code; there is no runtime toggle UI.

type FlagKey =
  | "householdDashboards"   // Phase 2 household-centric rendering
  | "reportingEngine"       // Phase 3 reports/exports
  | "aiRecommendations"     // Phase 4 policy-driven AI engine
  | "consistencyWarnings";  // Phase 1 non-blocking validation warnings

const parse = (v: unknown, fallback = true): boolean => {
  if (v === undefined || v === null || v === "") return fallback;
  return String(v).toLowerCase() !== "false";
};

const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

export const featureFlags: Record<FlagKey, boolean> = {
  householdDashboards: parse(env.VITE_FF_HOUSEHOLD_DASHBOARDS),
  reportingEngine: parse(env.VITE_FF_REPORTING_ENGINE),
  aiRecommendations: parse(env.VITE_FF_AI_RECOMMENDATIONS),
  consistencyWarnings: parse(env.VITE_FF_CONSISTENCY_WARNINGS),
};

export const isEnabled = (key: FlagKey): boolean => featureFlags[key];
