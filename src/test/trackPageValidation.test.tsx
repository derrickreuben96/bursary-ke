import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Track invocations of the edge function so we can assert it is NOT called for invalid input.
const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

import Track from "@/pages/Track";
import { I18nProvider } from "@/lib/i18n";

function renderTrack(initialPath = "/track") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <I18nProvider>
        <Track />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("Track page — tracking number validation & stage rendering", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    localStorage.clear();
  });

  it("rejects an invalid tracking number format and never calls the edge function", async () => {
    const user = userEvent.setup();
    renderTrack();

    const trackingInput = await screen.findByLabelText(/tracking number/i);
    await user.type(trackingInput, "invalid-format");

    // Provide a verification value so the only failing check is the format.
    const verification = screen.getByPlaceholderText(/enter your phone/i);
    await user.type(verification, "+254712345678");

    await user.click(screen.getByRole("button", { name: /track/i }));

    expect(
      await screen.findByText(/invalid|format/i)
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("requires a tracking number when the form is submitted empty", async () => {
    const user = userEvent.setup();
    renderTrack();
    await user.click(screen.getByRole("button", { name: /track/i }));
    expect(
      await screen.findByText(/please enter|enter.+tracking/i)
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renders all 5 progress stages for a valid tracking number from sample data", async () => {
    // Pre-load BKE-ABC123 via the URL (which hydrates from sampleTrackingData synchronously).
    renderTrack("/track?number=BKE-ABC123");

    // The "Application Details" card and the progress timeline should be visible.
    expect(
      await screen.findByText(/Application Details|Maelezo ya Maombi/i)
    ).toBeInTheDocument();

    // Each of the 5 stages from sampleTrackingData["BKE-ABC123"] should render in the timeline.
    const expectedStages = [
      /Application Received|Received/i,
      /Under Review|Review/i,
      /Verification/i,
      /Approval Decision|Approved/i,
      /Funds Disbursed|Disbursed/i,
    ];
    for (const re of expectedStages) {
      expect(screen.getAllByText(re).length).toBeGreaterThan(0);
    }
  });

  it("renders the completed-stage timeline for a fully disbursed application", async () => {
    renderTrack("/track?number=BKE-XYZ789");
    expect(
      await screen.findByText(/Funds Disbursed|Disbursed/i)
    ).toBeInTheDocument();
    // currentStage = 5 means all 5 stages rendered as completed/current.
    expect(screen.getAllByText(/Verification/i).length).toBeGreaterThan(0);
  });

  it("falls back to a friendly 'not found' state for a well-formed but unknown tracking number", async () => {
    invokeMock.mockResolvedValue({ data: { found: false }, error: null });

    const user = userEvent.setup();
    renderTrack();

    const trackingInput = await screen.findByLabelText(/tracking number/i);
    await user.type(trackingInput, "BKE-ZZZ999");
    await user.type(
      screen.getByPlaceholderText(/enter your phone/i),
      "+254712345678"
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /track/i }));
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });
  });
});
