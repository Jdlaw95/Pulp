import { jsPDF } from "jspdf";
import { autoTable, type CellInput, type Styles } from "jspdf-autotable";
import { SHOP } from "./config";

// The built-in PDF fonts only cover Western European characters; anything else (emoji, other scripts) is left out.
const KEEP = new Set("‘’“”–—•…€");
export function pdfText(v: unknown): string {
  const clean = String(v ?? "")
    .normalize("NFKC")
    .replace(/[\u2212]/g, "-");
  return Array.from(clean)
    .filter((ch) => (ch.codePointAt(0) ?? 0) <= 0xff || KEEP.has(ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const INK: [number, number, number] = [17, 17, 17];
const GREEN: [number, number, number] = [107, 142, 78];

/** A branded table report: title, a line of context, then a table that wraps across pages. */
export function tablePdf(opts: {
  title: string;
  subtitle: string;
  head: string[];
  rows: unknown[][];
  landscape?: boolean;
  columnStyles?: Record<number, Partial<Styles>>;
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const generated = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(pdfText(`${SHOP.name}: ${opts.title}`), 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(pdfText(opts.subtitle), 14, 25);
  doc.text(pdfText(`Generated ${generated}`), width - 14, 25, { align: "right" });

  autoTable(doc, {
    startY: 31,
    head: [opts.head.map(pdfText)],
    body: opts.rows.map((r) => r.map((c) => pdfText(c)) as CellInput[]),
    theme: "striped",
    styles: { font: "helvetica", fontSize: opts.landscape ? 8 : 9, cellPadding: 1.8, overflow: "linebreak", textColor: INK, valign: "top" },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 244, 238] },
    columnStyles: opts.columnStyles,
    margin: { left: 14, right: 14, bottom: 14 },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      const height = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${page}`, width - 14, height - 7, { align: "right" });
      doc.text("Confidential: contains customer details", 14, height - 7);
    },
  });

  if (!opts.rows.length) {
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text("Nothing to show for this selection.", 14, 45);
  }
  return doc.output("arraybuffer");
}

export function pdfResponse(body: ArrayBuffer, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
