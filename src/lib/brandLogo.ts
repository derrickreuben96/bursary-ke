// Lazily loads the Bursary-KE logo as a base64 data URL so it can be embedded
// directly into jsPDF documents (which require synchronous image data when
// calling addImage). The fetch is cached after the first call.
import logoUrl from "@/assets/bursary-ke-logo.png";

let cachedDataUrl: string | null = null;
let inflight: Promise<string> | null = null;

export const LOGO_URL = logoUrl;

export async function loadLogoDataUrl(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    cachedDataUrl = dataUrl;
    return dataUrl;
  })();

  return inflight;
}

/** Synchronous accessor — returns null until loadLogoDataUrl() resolves. */
export function getCachedLogoDataUrl(): string | null {
  return cachedDataUrl;
}
