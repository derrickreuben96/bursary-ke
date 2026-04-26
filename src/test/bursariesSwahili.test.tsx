import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase client BEFORE importing the page so the page picks up the stub.
vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: () => builder,
    },
  };
});

import Bursaries from "@/pages/Bursaries";
import { I18nProvider } from "@/lib/i18n";

function renderInSwahili() {
  // Force Swahili before the provider initializes its state from localStorage
  localStorage.setItem("bursary-lang", "sw");
  // Mobile viewport (already set via matchMedia in setup, but assert width too)
  Object.defineProperty(window, "innerWidth", { writable: true, value: 375 });
  Object.defineProperty(window, "innerHeight", { writable: true, value: 812 });

  return render(
    <MemoryRouter initialEntries={["/bursaries"]}>
      <I18nProvider>
        <Bursaries />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Bursaries page — Swahili mode (mobile)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the translated Swahili page title and subtitle", async () => {
    renderInSwahili();
    expect(await screen.findByText("Bursari Zinazopatikana")).toBeInTheDocument();
    expect(
      screen.getByText("Tazama na uombe programu za bursari za kaunti")
    ).toBeInTheDocument();
  });

  it("uses the Swahili search placeholder", async () => {
    renderInSwahili();
    const search = await screen.findByPlaceholderText(
      "Tafuta kwa kichwa au maelezo..."
    );
    expect(search).toBeInTheDocument();
  });

  it("renders Swahili dropdown labels for County and Deadline filters", async () => {
    renderInSwahili();
    // County trigger placeholder
    expect(await screen.findByText("Kaunti Zote")).toBeInTheDocument();
    // Deadline trigger placeholder
    expect(screen.getByText("Tarehe Zote za Mwisho")).toBeInTheDocument();
    // Filter section label
    expect(screen.getByText("Vichujio:")).toBeInTheDocument();
  });

  it("shows the Swahili 'no bursaries found' empty state when the dataset is empty", async () => {
    renderInSwahili();
    await waitFor(() => {
      expect(
        screen.getByText("Hakuna bursari zilizopatikana")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Hakuna programu za bursari zinazoendelea kwa sasa. Tafadhali rudi baadaye."
      )
    ).toBeInTheDocument();
  });
});
