import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, within } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";

// Stub Supabase + auth + service hooks BEFORE importing the dashboard.
vi.mock("@/integrations/supabase/client", () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => Promise.resolve("ok"),
  };
  return {
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      channel: () => channel,
      removeChannel: () => Promise.resolve("ok"),
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com", id: "admin-1" },
    signOut: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/lib/applicationService", () => ({
  fetchDashboardStats: () =>
    Promise.resolve({
      totalApplications: 1234,
      approvedApplications: 800,
      pendingApplications: 200,
      rejectedApplications: 234,
      totalBudgetDisbursed: 5_000_000,
      povertyDistribution: [
        { tier: "High Priority", count: 500, percentage: 40 },
        { tier: "Medium Priority", count: 400, percentage: 35 },
        { tier: "Low Priority", count: 334, percentage: 25 },
      ],
      applicationsByCounty: [{ county: "Nairobi", count: 600 }],
      monthlyTrends: [{ month: "Jan", applications: 200 }],
    }),
}));

import AdminDashboard from "@/pages/AdminDashboard";
import { I18nProvider } from "@/lib/i18n";

// PII shapes that must NEVER appear unmasked in any admin dashboard render.
const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Kenyan national ID (8 digits, not preceded/followed by another digit).
  { name: "national ID (8 digits)", pattern: /(?<!\d)\d{8}(?!\d)/ },
  // International phone format like +254712345678.
  { name: "international phone (+254...)", pattern: /\+254\d{6,9}/ },
  // Local phone format starting with 07 or 01 followed by 8 digits.
  { name: "local Kenyan phone (07x/01x)", pattern: /(?<!\d)0(?:7|1)\d{8}(?!\d)/ },
  // Bare email addresses (any non-support address).
  {
    name: "email address",
    pattern: /[a-zA-Z0-9._%+-]+@(?!bursary-ke\.go\.ke)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  },
  // NEMIS ID format CCC-SSSS-NNNN (11 digits with hyphens).
  { name: "NEMIS ID format", pattern: /\d{3}-\d{4}-\d{4}/ },
];

function renderDashboard() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AdminDashboard />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Admin dashboard — PII masking", () => {
  it("does not render any unmasked national IDs, phones, emails, or NEMIS IDs", async () => {
    renderDashboard();

    // Wait for the loading spinner to disappear and main content to render.
    await screen.findByText(/Total Applications/i);

    const text = document.body.textContent || "";
    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      const match = text.match(pattern);
      expect(
        match,
        `Admin dashboard leaked ${name}: ${match?.[0] ?? "<none>"}`
      ).toBeNull();
    }
  });

  it("renders only aggregated/masked summaries (counts, percentages, currency)", async () => {
    renderDashboard();
    await screen.findByText(/Total Applications/i);

    // Privacy notice should be present
    expect(
      screen.getByText(/aggregated statistics/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Privacy Compliant Dashboard/i)
    ).toBeInTheDocument();

    // Aggregated formatted totals appear (formatNumber inserts commas)
    expect(screen.getAllByText(/1,234/).length).toBeGreaterThan(0);
  });

  it("masks any sensitive identifiers exposed via the maskData utilities", async () => {
    const { maskId, maskPhone, maskEmail, maskNemisId } = await import("@/lib/maskData");
    expect(maskId("12345678")).toMatch(/\*+\d{3}$/);
    expect(maskPhone("+254712345678")).toMatch(/^\+254\*+\d{3}$/);
    expect(maskEmail("john.doe@example.com")).toMatch(/^jo\*+@example\.com$/);
    expect(maskNemisId("12345678901")).toMatch(/^\*+\d{4}$/);
  });
});
