import jsPDF from "jspdf";
import type { AiSummaryLanguage } from "@/lib/aiSummaryPdf";

export interface ChartPdfRow {
  label: string;
  value: string | number;
}

export interface ChartPdfSection {
  heading: string;
  rows: ChartPdfRow[];
}

export interface ChartPdfFilter {
  label: string;
  value: string;
}

export interface ChartPdfPayload {
  /** Top-level title (e.g. "Application Distribution"). */
  title: string;
  /** Subtitle line (jurisdiction + filter description). */
  subtitle?: string;
  /** Portal banner shown in the header (e.g. "Bursary-KE · Commissioner Portal"). */
  portalName?: string;
  /** Scope label printed below the title. */
  scopeLabel?: string;
  /** Currently applied filters — printed in an audit block before the data tables. */
  appliedFilters?: ChartPdfFilter[];
  sections: ChartPdfSection[];
  /** Optional free-form notes printed under the tables. */
  notes?: string[];
  language?: AiSummaryLanguage;
}

const I18N = {
  en: {
    generated: "Generated",
    snapshot: "Live snapshot",
    metric: "Metric",
    value: "Value",
    notes: "Notes",
    appliedFilters: "Applied Filters",
    none: "None",
    disclaimer:
      "Snapshot of currently filtered data. Aggregated, anonymised — no PII included.",
  },
  sw: {
    generated: "Imetolewa",
    snapshot: "Picha ya wakati halisi",
    metric: "Kipimo",
    value: "Thamani",
    notes: "Maelezo",
    appliedFilters: "Vichujio Vilivyotumika",
    none: "Hakuna",
    disclaimer:
      "Picha ya data iliyochujwa kwa sasa. Imekusanywa bila vitambulisho — hakuna PII.",
  },
} as const;

export function chartSummaryPdfFilename(payload: ChartPdfPayload, filenameHint?: string): string {
  const safe = (filenameHint ?? payload.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `bursary-ke-chart-${safe || "summary"}.pdf`;
}

export function buildChartSummaryDoc(payload: ChartPdfPayload): jsPDF {
  return renderChartSummary(payload);
}

export function downloadChartSummaryPdf(
  payload: ChartPdfPayload,
  filenameHint?: string,
): void {
  const doc = renderChartSummary(payload);
  doc.save(chartSummaryPdfFilename(payload, filenameHint));
}

function renderChartSummary(payload: ChartPdfPayload): jsPDF {
  const lang: AiSummaryLanguage = payload.language ?? "en";
  const i = I18N[lang];
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageWidth = 595;
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 56;
    }
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 102, 0);
  doc.text(payload.portalName ?? "Bursary-KE", marginX, y);
  y += 22;

  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(payload.title, marginX, y, { maxWidth });
  y += 18;

  if (payload.scopeLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(payload.scopeLabel, marginX, y);
    y += 14;
  }

  if (payload.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    const lines = doc.splitTextToSize(payload.subtitle, maxWidth);
    for (const line of lines) {
      doc.text(line, marginX, y);
      y += 13;
    }
  }

  const generatedStr = new Date().toLocaleString(
    lang === "sw" ? "sw-KE" : "en-KE",
    { dateStyle: "medium", timeStyle: "short" },
  );
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`${i.snapshot} · ${i.generated} ${generatedStr}`, marginX, y);
  y += 10;

  doc.setDrawColor(0, 102, 0);
  doc.setLineWidth(1);
  doc.line(marginX, y, marginX + maxWidth, y);
  y += 18;

  // Sections
  for (const section of payload.sections) {
    ensureSpace(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(section.heading, marginX, y);
    y += 14;

    // Table header
    doc.setFontSize(9);
    doc.setTextColor(255);
    doc.setFillColor(0, 102, 0);
    doc.rect(marginX, y - 10, maxWidth, 16, "F");
    doc.text(i.metric, marginX + 8, y);
    doc.text(i.value, marginX + maxWidth - 8, y, { align: "right" });
    y += 12;

    doc.setTextColor(30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    section.rows.forEach((row, idx) => {
      ensureSpace(18);
      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(marginX, y - 10, maxWidth, 16, "F");
      }
      doc.setTextColor(50);
      doc.text(row.label, marginX + 8, y, { maxWidth: maxWidth * 0.6 });
      doc.setTextColor(20);
      doc.text(String(row.value), marginX + maxWidth - 8, y, { align: "right" });
      y += 16;
    });

    y += 10;
  }

  // Notes
  if (payload.notes?.length) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(i.notes, marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    for (const note of payload.notes) {
      const lines = doc.splitTextToSize(`• ${note}`, maxWidth);
      for (const line of lines) {
        ensureSpace(14);
        doc.text(line, marginX, y);
        y += 13;
      }
    }
  }

  // Footer disclaimer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(0, 102, 0);
    doc.setLineWidth(1);
    doc.line(marginX, 800, marginX + maxWidth, 800);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(i.disclaimer, marginX + maxWidth / 2, 815, { align: "center" });
    doc.text(`${p} / ${pageCount}`, marginX + maxWidth, 815, { align: "right" });
  }

  return doc;
}

