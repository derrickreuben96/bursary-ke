import { describe, it, expect } from "vitest";
import { featureFlags, isEnabled } from "@/lib/featureFlags";

describe("feature flags", () => {
  it("defaults all v2 flags to enabled", () => {
    expect(featureFlags.householdDashboards).toBe(true);
    expect(featureFlags.reportingEngine).toBe(true);
    expect(featureFlags.aiRecommendations).toBe(true);
    expect(featureFlags.consistencyWarnings).toBe(true);
  });
  it("isEnabled reflects the map", () => {
    expect(isEnabled("aiRecommendations")).toBe(featureFlags.aiRecommendations);
  });
});
