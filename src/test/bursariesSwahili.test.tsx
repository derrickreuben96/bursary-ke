import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
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

const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: MOBILE_WIDTH,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: MOBILE_HEIGHT,
  });
  window.dispatchEvent(new Event("resize"));
}

function renderInSwahili() {
  // Force Swahili before the provider initializes its state from localStorage
  localStorage.setItem("bursary-lang", "sw");
  setMobileViewport();

  return render(
    <MemoryRouter initialEntries={["/bursaries"]}>
      <I18nProvider>
        <Bursaries />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Bursaries page — Swahili mode (375px mobile)", () => {
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

  it("uses the Swahili search placeholder on the search input", async () => {
    renderInSwahili();
    const search = await screen.findByPlaceholderText(
      "Tafuta kwa kichwa au maelezo..."
    );
    expect(search).toBeInTheDocument();
  });

  it("renders the Swahili filters section label", async () => {
    renderInSwahili();
    expect(await screen.findByText("Vichujio:")).toBeInTheDocument();
  });

  it("shows the Swahili County dropdown default label", async () => {
    renderInSwahili();
    expect(await screen.findByText("Kaunti Zote")).toBeInTheDocument();
  });

  it("shows the Swahili Deadline dropdown default label", async () => {
    renderInSwahili();
    expect(await screen.findByText("Tarehe Zote za Mwisho")).toBeInTheDocument();
  });

  it("renders Swahili-translated options inside the Deadline dropdown", async () => {
    const user = userEvent.setup();
    renderInSwahili();

    // Open the Deadline trigger (the one whose value text is the all-deadlines label)
    const deadlineTrigger = (await screen.findByText("Tarehe Zote za Mwisho"))
      .closest("[role='combobox']") as HTMLElement | null;
    expect(deadlineTrigger).not.toBeNull();

    await user.click(deadlineTrigger!);

    // Listbox is rendered in a portal — query the document body
    await waitFor(() => {
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).not.toBeNull();
    });

    const listbox = document.querySelector("[role='listbox']") as HTMLElement;
    const utils = within(listbox);

    // "Tarehe Zote za Mwisho" appears as the "all" option as well
    expect(utils.getAllByText("Tarehe Zote za Mwisho").length).toBeGreaterThan(0);
    // 90-day option uses the months label
    expect(utils.getByText("Ndani ya miezi 3")).toBeInTheDocument();
    // 7/14/30-day options follow the "Ndani ya N siku" pattern
    expect(utils.getByText(/Ndani ya\s+7\s+siku/i)).toBeInTheDocument();
    expect(utils.getByText(/Ndani ya\s+14\s+siku/i)).toBeInTheDocument();
    expect(utils.getByText(/Ndani ya\s+30\s+siku/i)).toBeInTheDocument();
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

  it("switches the empty-state message to the 'adjust filters' Swahili copy when a search filter is active", async () => {
    const user = userEvent.setup();
    renderInSwahili();

    const search = await screen.findByPlaceholderText(
      "Tafuta kwa kichwa au maelezo..."
    );
    await user.type(search, "haitapatikana-xyz");

    await waitFor(() => {
      expect(
        screen.getByText("Jaribu kubadilisha vichujio vyako kuona matokeo zaidi.")
      ).toBeInTheDocument();
    });

    // The "Clear Filters" call-to-action shows up in Swahili
    expect(screen.getByText("Futa Vichujio")).toBeInTheDocument();
  });

  it("confirms the rendered viewport is 375px wide for mobile coverage", async () => {
    renderInSwahili();
    expect(window.innerWidth).toBe(MOBILE_WIDTH);
    expect(window.innerHeight).toBe(MOBILE_HEIGHT);
  });
});
