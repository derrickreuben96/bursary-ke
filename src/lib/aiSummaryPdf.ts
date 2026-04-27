import jsPDF from "jspdf";

export interface AiSummaryFooterMeta {
  /** Display label for the report scope (e.g. "Commissioner Ward Report"). */
  scopeLabel?: string;
  /** Jurisdiction string (e.g. "Westlands Ward, Nairobi County"). */
  jurisdiction?: string;
  /** Human-readable data freshness note (e.g. "Live data as of 14:32 EAT"). */
  dataFreshness?: string;
  /** Optional org/portal name shown on the brand strip. */
  portalName?: string;
}

export interface AiSummaryPayload {
  title: string;
  scope: "system" | "advert" | "commissioner" | "treasury";
  context: Record<string, unknown>;
  summary: string;
  generated_at: string;
  /** Optional footer metadata. When omitted, a generic footer is rendered. */
  footer?: AiSummaryFooterMeta;
}

/**
 * Renders an AI-generated executive summary into a downloadable PDF.
 * The PDF contains aggregate-only data (no PII) plus a natural-language
 * analysis produced by the admin-summary edge function.
 */
export function generateAiSummaryPdf(payload: AiSummaryPayload): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageWidth = 595; // A4 in pt
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text("Bursary-KE — AI Executive Summary", marginX, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  const subtitle = `${payload.scope === "advert" ? "Advert report" : "System-wide overview"} · Generated ${new Date(
    payload.generated_at,
  ).toLocaleString()}`;
  doc.text(subtitle, marginX, y);

  y += 24;
  doc.setDrawColor(0, 102, 0);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, marginX + maxWidth, y);

  // Title block
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(payload.title, marginX, y, { maxWidth });

  // Key metrics table from context.totals
  const totals = (payload.context?.totals ?? {}) as Record<string, unknown>;
  const totalEntries = Object.entries(totals);
  if (totalEntries.length) {
    y += 22;
    doc.setFontSize(12);
    doc.text("Key Metrics", marginX, y);
    y += 12;
    doc.setDrawColor(220);
    doc.line(marginX, y, marginX + maxWidth, y);
    y += 16;

    doc.setFontSize(10);
    for (const [k, v] of totalEntries) {
      if (y > 760) {
        doc.addPage();
        y = 56;
      }
      const label = k
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const value =
        typeof v === "number" && /amount|kes|allocated|budget/i.test(k)
          ? `KES ${Number(v).toLocaleString()}`
          : String(v);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text(label, marginX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20);
      doc.text(value, marginX + 240, y, { maxWidth: maxWidth - 240 });
      y += 16;
    }
  }

  // AI summary body
  y += 14;
  if (y > 720) {
    doc.addPage();
    y = 56;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("AI Analysis", marginX, y);
  y += 12;
  doc.setDrawColor(220);
  doc.line(marginX, y, marginX + maxWidth, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30);

  // Simple markdown stripping for PDF readability
  const cleanText = payload.summary
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "");

  const paragraphs = cleanText.split(/\n\s*\n/);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim(), maxWidth);
    for (const line of lines) {
      if (y > 780) {
        doc.addPage();
        y = 56;
      }
      const isBullet = /^[-*•]\s+/.test(line);
      if (isBullet) {
        const text = line.replace(/^[-*•]\s+/, "");
        doc.text("•", marginX, y);
        doc.text(text, marginX + 14, y, { maxWidth: maxWidth - 14 });
      } else {
        doc.text(line, marginX, y);
      }
      y += 15;
    }
    y += 6;
  }

  // Branded footer rendered on every page
  const scopeLabelMap: Record<AiSummaryPayload["scope"], string> = {
    system: "System-wide Overview",
    advert: "Advert Report",
    commissioner: "Commissioner Ward Report",
    treasury: "Treasury County Report",
  };
  const generatedDate = new Date(payload.generated_at);
  const generatedStr = generatedDate.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const meta = payload.footer ?? {};
  const scopeLabel = meta.scopeLabel ?? scopeLabelMap[payload.scope];
  const jurisdiction = meta.jurisdiction ?? "All jurisdictions";
  const dataFreshness = meta.dataFreshness ?? `Snapshot captured ${generatedStr}`;
  const portalName = meta.portalName ?? "Bursary-KE";

  const pageCount = doc.getNumberOfPages();
  const footerTopY = 792;
  const footerBottomY = 830;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Brand strip — Kenyan green accent
    doc.setDrawColor(0, 102, 0);
    doc.setLineWidth(2);
    doc.line(marginX, footerTopY, marginX + maxWidth, footerTopY);

    // Left block: portal + scope
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 102, 0);
    doc.text(portalName, marginX, footerTopY + 14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(scopeLabel, marginX, footerTopY + 26);

    // Center block: jurisdiction + freshness
    doc.setFontSize(8);
    doc.setTextColor(80);
    const centerX = marginX + maxWidth / 2;
    doc.text(`Jurisdiction: ${jurisdiction}`, centerX, footerTopY + 14, { align: "center" });
    doc.text(dataFreshness, centerX, footerTopY + 26, { align: "center" });

    // Right block: timestamp + page number
    const rightX = marginX + maxWidth;
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(`Generated ${generatedStr}`, rightX, footerTopY + 14, { align: "right" });
    doc.text(`Page ${i} of ${pageCount}`, rightX, footerTopY + 26, { align: "right" });

    // Bottom disclaimer line
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      "AI-generated summary based on aggregated, anonymised data. No PII included. Confidential — for authorised use only.",
      centerX,
      footerBottomY,
      { align: "center" },
    );
  }

  return doc;
}

export function downloadAiSummaryPdf(payload: AiSummaryPayload, filenameHint?: string): void {
  const doc = generateAiSummaryPdf(payload);
  const safeName = (filenameHint ?? payload.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  doc.save(`bursary-ke-summary-${safeName || "report"}.pdf`);
}
