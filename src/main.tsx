import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { loadLogoDataUrl } from "./lib/brandLogo";
import { loadKenyaLocations } from "./lib/useKenyaLocations";

// Pre-warm the brand logo cache so PDF exports embed it without delay.
void loadLogoDataUrl().catch(() => {});
// Pre-warm the Kenya counties/wards dataset.
void loadKenyaLocations().catch(() => {});

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
