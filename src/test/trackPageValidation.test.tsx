import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

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

// The verification input has no accessible label — find it relative to the
// tracking input, since it's the second textbox-style input on the page.
function getVerificationInput() {
  return screen.getByPlaceholderText(/enter phone/i);
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
    await user.type(getVerificationInput(), "+254712345678");

    await user.click(screen.getByRole("button", { name: /track/i }));

    expect(
      await screen.findByText(/Invalid format/i)
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("requires a tracking number when the form is submitted empty", async () => {
    const user = userEvent.setup();
    renderTrack();
    await user.click(screen.getByRole("button", { name: /track/i }));
    expect(
      await screen.findByText("Please enter a tracking number")
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("renders all 5 progress stages for a valid tracking number from sample data", async () => {
    renderTrack("/track?number=BKE-ABC123");

    expect(
      await screen.findByText(/Application Details/i)
    ).toBeInTheDocument();

    const expectedStages = [
      /Application Received/i,
      /Under Review/i,
      /Verification/i,
      /Approval Decision/i,
      /Funds Disbursed/i,
    ];
    for (const re of expectedStages) {
      expect(screen.getAllByText(re).length).toBeGreaterThan(0);
    }
  });

  it("renders the disbursed-stage timeline for a fully completed application", async () => {
    renderTrack("/track?number=BKE-XYZ789");
    const matches = await screen.findAllByText(/Funds Disbursed/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Verification/i).length).toBeGreaterThan(0);
  });

  it("invokes the track-application edge function for a well-formed unknown tracking number", async () => {
    invokeMock.mockResolvedValue({ data: { found: false }, error: null });
    const user = userEvent.setup();
    renderTrack();

    const trackingInput = await screen.findByLabelText(/tracking number/i);
    await user.type(trackingInput, "BKE-ZZZ999");
    await user.type(getVerificationInput(), "+254712345678");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /track/i }));
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });
  });
});
