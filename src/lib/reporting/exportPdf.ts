// PDF export — household-grouped allocation report.
// Uses jsPDF + autoTable. Preserves hierarchy: household header row followed by
// beneficiary rows, then a household total, then the next household.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Household } from "@/lib/household/types";
import type { GeneratedReportMeta, ReportMetrics } from "./types";
import { toBeneficiaryRows, educationLevelOf } from "./metricsEngine";

const KES = (n: number | null | undefined) =>
  n == null ? "—" : `KES ${Number(n).toLocaleString()}`;

export function exportHouseholdReportPdf(
  households: Household[],
  metrics: ReportMetrics,
  meta: GeneratedReportMeta,
  filename = `bursary-report-${Date.now()}.pdf`,
): void {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Bursary-KE — Allocation Report", 14, 15);
  doc.setFontSize(9);
  doc.text(
    `Generated: ${meta.generatedAt} · By: ${meta.generatedBy} · v${meta.version}`,
    14,
    22,
  );

  // Summary tiles
  autoTable(doc, {
    startY: 28,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Households", String(metrics.households), "Beneficiaries", String(metrics.beneficiaries)],
      ["Secondary", String(metrics.secondaryBeneficiaries), "Higher Ed", String(metrics.higherEdBeneficiaries)],
      ["Avg per Household", String(metrics.avgBeneficiariesPerHousehold), "Disabled", String(metrics.disabledBeneficiaries)],
      ["Budget Recommended", KES(metrics.budgetRecommended), "Budget Allocated", KES(metrics.budgetAllocated)],
      ["Approved", String(metrics.approvedHouseholds), "Pending / Rejected", `${metrics.pendingHouseholds} / ${metrics.rejectedHouseholds}`],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 102, 0] },
  });

  // Filters used (auditability)
  const filters = Object.entries(meta.filters)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("  ·  ");
  if (filters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(8);
    doc.text(`Filters: ${filters}`, 14, y);
  }

  // Household-grouped body
  const body: (string | number)[][] = [];
  for (const h of households) {
    body.push([
      { content: `${h.tracking_number} — ${h.parent_name_masked} (${h.parent_ward ?? ""}, ${h.parent_county})`, colSpan: 6, styles: { fillColor: [230, 240, 230], fontStyle: "bold" } } as never,
    ]);
    let hhRecommended = 0;
    let hhAllocated = 0;
    for (const s of h.students) {
      const rec = s.cohort === "secondary" ? 20000 : 35000;
      hhRecommended += rec;
      hhAllocated += s.allocated_amount ?? 0;
      body.push([
        s.name_masked,
        educationLevelOf(s),
        s.institution_name ?? "—",
        s.status,
        KES(rec),
        KES(s.allocated_amount),
      ]);
    }
    body.push([
      { content: "Household Total", colSpan: 4, styles: { fontStyle: "bold" } } as never,
      { content: KES(hhRecommended), styles: { fontStyle: "bold" } } as never,
      { content: KES(hhAllocated), styles: { fontStyle: "bold" } } as never,
    ]);
  }

  autoTable(doc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Beneficiary", "Level", "Institution", "Status", "Recommended", "Allocated"]],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [210, 16, 52] },
  });

  doc.save(filename);
}
