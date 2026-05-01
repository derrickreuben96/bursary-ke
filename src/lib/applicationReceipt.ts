import jsPDF from "jspdf";
import { maskId, maskPhone, maskEmail, maskName, maskStudentId } from "./maskData";
import { getCachedLogoDataUrl } from "./brandLogo";
import type { ApplicationData } from "@/context/ApplicationContext";

export interface ReceiptInput {
  trackingNumber: string;
  studentType: "secondary" | "university";
  data: ApplicationData;
  generatedAt?: Date;
}

/**
 * Builds a masked verification summary used in the downloadable receipt.
 * Exported separately so it can be unit-tested without touching jsPDF.
 */
export function buildReceiptSummary(input: ReceiptInput) {
  const { trackingNumber, studentType, data, generatedAt = new Date() } = input;
  const parent = data.parentGuardian;
  const student = studentType === "university" ? data.universityStudent : data.secondaryStudent;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Tracking Number", value: trackingNumber },
    { label: "Generated", value: generatedAt.toLocaleString() },
    { label: "Student Type", value: studentType === "university" ? "University / College" : "Secondary School" },
  ];

  if (parent) {
    rows.push(
      { label: "Parent / Guardian", value: maskName(parent.fullName || "") },
      { label: "National ID", value: maskId(parent.nationalId || "") },
      { label: "Phone Number", value: maskPhone(parent.phoneNumber || "") },
    );
    if (parent.email) {
      rows.push({ label: "Email", value: maskEmail(parent.email) });
    }
    rows.push(
      { label: "County", value: parent.county || "—" },
      { label: "Ward", value: parent.ward || "—" },
    );
  }

  if (studentType === "university" && data.universityStudent) {
    const u = data.universityStudent;
    rows.push(
      { label: "Student ID", value: maskStudentId(u.studentId || "") },
      { label: "Institution", value: u.institution || "—" },
      { label: "Course", value: u.course || "—" },
      { label: "Year of Study", value: String(u.yearOfStudy ?? "—") },
    );
  } else if (studentType === "secondary" && data.secondaryStudent) {
    const s = data.secondaryStudent;
    rows.push(
      { label: "NEMIS ID", value: maskStudentId(s.nemisId || "") },
      { label: "Student Name", value: maskName(s.studentName || "") },
      { label: "School", value: s.school || "—" },
      { label: "Class / Form", value: (s.classForm || "—").replace("form", "Form ") },
    );
  }

  return rows;
}

/**
 * Generates a downloadable PDF receipt for a submitted bursary application.
 * The PDF contains ONLY masked PII plus the tracking number — never raw IDs.
 */
export function generateApplicationReceiptPdf(input: ReceiptInput): jsPDF {
  const rows = buildReceiptSummary(input);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 48;
  let y = 64;

  // Brand emblem
  const logoDataUrl = getCachedLogoDataUrl();
  let titleX = marginX;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, y - 22, 48, 48);
      titleX = marginX + 60;
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Bursary-KE Application Receipt", titleX, y);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(
    "Keep this receipt for your records. All sensitive details below are masked for your protection.",
    marginX,
    y,
    { maxWidth: 500 },
  );

  // Tracking number callout
  y += 36;
  doc.setDrawColor(0, 102, 0);
  doc.setFillColor(240, 248, 240);
  doc.roundedRect(marginX, y, 500, 56, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 102, 0);
  doc.text("TRACKING NUMBER", marginX + 16, y + 22);
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(input.trackingNumber, marginX + 16, y + 44);

  // Summary rows
  y += 88;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("Verification Summary (Masked)", marginX, y);

  y += 14;
  doc.setDrawColor(220);
  doc.line(marginX, y, marginX + 500, y);

  y += 18;
  doc.setFontSize(11);
  for (const row of rows) {
    if (y > 760) {
      doc.addPage();
      y = 64;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(row.label, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    doc.text(row.value, marginX + 180, y, { maxWidth: 320 });
    y += 22;
  }

  // Footer
  y = Math.max(y + 24, 780);
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "Track your application at /track using the tracking number above.",
    marginX,
    y,
  );

  return doc;
}

export function downloadApplicationReceipt(input: ReceiptInput): void {
  const doc = generateApplicationReceiptPdf(input);
  doc.save(`bursary-receipt-${input.trackingNumber}.pdf`);
}
