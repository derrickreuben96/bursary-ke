import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    then: (resolve: any) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return {
    supabase: {
      from: () => builder,
    },
  };
});

import { PhoneConsentModal } from "@/components/application/PhoneConsentModal";
import { SuccessModal } from "@/components/application/SuccessModal";
import { I18nProvider } from "@/lib/i18n";
import {
  ApplicationProvider,
  useApplication,
} from "@/context/ApplicationContext";

function renderInSwahili(ui: React.ReactElement) {
  localStorage.setItem("bursary-lang", "sw");
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ApplicationProvider>{ui}</ApplicationProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("PhoneConsentModal — Swahili consent text", () => {
  it("renders the consent title, accept, and decline labels in Swahili", async () => {
    renderInSwahili(
      <PhoneConsentModal
        open={true}
        onOpenChange={() => {}}
        onConsent={() => {}}
        onDecline={() => {}}
        phoneNumber="+254712345678"
      />
    );

    expect(
      await screen.findByText("Idhini ya Mawasiliano Inahitajika")
    ).toBeInTheDocument();
    expect(screen.getByText("Ndiyo, Nakubali")).toBeInTheDocument();
    expect(screen.getByText("Hapana, Usitume Ujumbe")).toBeInTheDocument();
    // Feature labels
    expect(
      screen.getByText("Masasisho ya Hali ya Maombi")
    ).toBeInTheDocument();
    expect(screen.getByText("Mgawanyiko wa Bursari")).toBeInTheDocument();
    expect(screen.getByText("Faragha Yako Imelindwa")).toBeInTheDocument();
  });

  it("includes the displayed phone number in the consent description", async () => {
    renderInSwahili(
      <PhoneConsentModal
        open={true}
        onOpenChange={() => {}}
        onConsent={() => {}}
        onDecline={() => {}}
        phoneNumber="+254712345678"
      />
    );
    expect(
      await screen.findByText(/\+254712345678/)
    ).toBeInTheDocument();
  });
});

// Helper component that exposes the application context so we can assert
// the consent flag is persisted when the user accepts.
function ConsentFlow() {
  const { data, updateData } = useApplication();
  const accept = () =>
    updateData({
      parentGuardian: {
        ...(data.parentGuardian || {}),
        consentNotifications: true,
      } as any,
    });
  const decline = () =>
    updateData({
      parentGuardian: {
        ...(data.parentGuardian || {}),
        consentNotifications: false,
      } as any,
    });

  return (
    <>
      <PhoneConsentModal
        open={true}
        onOpenChange={() => {}}
        onConsent={accept}
        onDecline={decline}
        phoneNumber="+254712345678"
      />
      <div data-testid="consent-state">
        {String(data.parentGuardian?.consentNotifications ?? "unset")}
      </div>
    </>
  );
}

describe("Consent persistence into ApplicationContext", () => {
  it("stores consentNotifications=true when the user accepts in Swahili mode", async () => {
    const user = userEvent.setup();
    renderInSwahili(<ConsentFlow />);

    expect(screen.getByTestId("consent-state").textContent).toBe("unset");

    await act(async () => {
      await user.click(await screen.findByText("Ndiyo, Nakubali"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("consent-state").textContent).toBe("true");
    });
  });

  it("stores consentNotifications=false when the user declines", async () => {
    const user = userEvent.setup();
    renderInSwahili(<ConsentFlow />);

    await act(async () => {
      await user.click(await screen.findByText("Hapana, Usitume Ujumbe"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("consent-state").textContent).toBe("false");
    });
  });
});

describe("SuccessModal — surfaces the tracking number after consent submission", () => {
  it("displays the tracking number passed in after the application submits", () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <ApplicationProvider>
            <SuccessModal
              isOpen={true}
              trackingNumber="BKE-ABC123"
              onClose={() => {}}
            />
          </ApplicationProvider>
        </I18nProvider>
      </MemoryRouter>
    );
    expect(screen.getByText("BKE-ABC123")).toBeInTheDocument();
  });
});
