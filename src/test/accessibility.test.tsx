import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
    then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    supabase: {
      from: () => builder,
    },
  };
});

import Bursaries from "@/pages/Bursaries";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { I18nProvider } from "@/lib/i18n";

const MOBILE_WIDTH = 375;

function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: MOBILE_WIDTH,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("Accessibility — Bursaries filters on mobile", () => {
  it("has no detectable axe violations on the filters region", async () => {
    setMobileViewport();
    const { container } = render(
      <MemoryRouter initialEntries={["/bursaries"]}>
        <I18nProvider>
          <Bursaries />
        </I18nProvider>
      </MemoryRouter>
    );

    // Wait for the page heading so the filters have rendered.
    await screen.findByRole("heading", { level: 1 });

    const results = await axe(container, {
      // Color contrast assertions are noisy in jsdom (no actual painting); skip.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("exposes ARIA roles for each filter combobox and labels the search input", async () => {
    setMobileViewport();
    render(
      <MemoryRouter initialEntries={["/bursaries"]}>
        <I18nProvider>
          <Bursaries />
        </I18nProvider>
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText(/search|tafuta/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput.tagName.toLowerCase()).toBe("input");

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
    for (const cb of comboboxes) {
      expect(cb).toHaveAttribute("aria-expanded");
    }
  });

  it("supports keyboard focus traversal across the filter controls", async () => {
    setMobileViewport();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/bursaries"]}>
        <I18nProvider>
          <Bursaries />
        </I18nProvider>
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText(/search|tafuta/i);
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);

    // Tab moves focus forward — the next focusable control should be a combobox.
    await user.tab();
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
  });
});

describe("Accessibility — Application stepper", () => {
  it("has no detectable axe violations at mobile width", async () => {
    setMobileViewport();
    const { container } = render(
      <ApplicationStepper
        steps={["Parent/Guardian", "Student", "Documents", "Review"]}
        currentStep={2}
      />
    );

    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it("renders every step label so each is announceable to screen readers", () => {
    setMobileViewport();
    const steps = ["Parent/Guardian", "Student", "Documents", "Review"];
    render(<ApplicationStepper steps={steps} currentStep={1} />);

    for (const step of steps) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });
});
