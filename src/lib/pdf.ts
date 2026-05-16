import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AuthorizationResult, MedicalReport } from "@/types";

type PdfLine = {
  label?: string;
  value: string;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const BODY_SIZE = 10;
const LINE_HEIGHT = 15;
const TEXT_COLOR = rgb(0.07, 0.2, 0.24);
const MUTED_COLOR = rgb(0.33, 0.45, 0.48);
const PRIMARY_COLOR = rgb(0.05, 0.46, 0.43);
const REVIEW_COLOR = rgb(0.85, 0.47, 0.02);

export async function downloadPreapprovalPdf(
  report: MedicalReport,
  result: AuthorizationResult,
) {
  const bytes = await createCasePdf({
    accentColor: PRIMARY_COLOR,
    report,
    result,
    title: "Preaprobacion Quirurgica",
    lines: [
      { label: "ID paciente", value: report.patientId },
      { label: "Paciente", value: report.patientName },
      { label: "ID poliza", value: report.policyId },
      { label: "Fecha de emision", value: formatDate(new Date()) },
      { label: "Diagnostico", value: report.diagnosis },
      { label: "Procedimiento", value: report.procedure },
      { label: "Tipo de caso", value: report.urgency },
      { label: "CIE-10", value: result.cie10Code },
      { label: "CPT", value: result.cptCode },
      { label: "Justificacion", value: result.justification },
      {
        label: "Tiempo de procesamiento",
        value: `${(result.processingTimeMs / 1000).toFixed(1)} segundos`,
      },
      {
        value:
          "Documento generado automaticamente por el agente de pre-autorizacion.",
      },
    ],
  });

  downloadBytes(bytes, `preaprobacion-${safeName(report.policyId)}.pdf`);
}

export async function downloadMissingDocumentsPdf(
  report: MedicalReport,
  result: AuthorizationResult,
) {
  const missingDocuments = result.missingDocuments ?? [];
  const bytes = await createCasePdf({
    accentColor: REVIEW_COLOR,
    report,
    result,
    title: "Solicitud de Documentos Faltantes",
    lines: [
      { label: "ID paciente", value: report.patientId },
      { label: "Paciente", value: report.patientName },
      { label: "ID poliza", value: report.policyId },
      { label: "Fecha de emision", value: formatDate(new Date()) },
      { label: "Diagnostico", value: report.diagnosis },
      { label: "Procedimiento", value: report.procedure },
      { label: "CIE-10", value: result.cie10Code },
      { label: "CPT", value: result.cptCode },
      { label: "Justificacion", value: result.justification },
      ...missingDocuments.map((document, index) => ({
        label: `Documento ${index + 1}`,
        value: document,
      })),
      {
        value:
          "Adjunte los documentos indicados para continuar la revision administrativa.",
      },
    ],
  });

  downloadBytes(bytes, `documentos-faltantes-${safeName(report.policyId)}.pdf`);
}

async function createCasePdf({
  accentColor,
  lines,
  report,
  result,
  title,
}: {
  accentColor: ReturnType<typeof rgb>;
  lines: PdfLine[];
  report: MedicalReport;
  result: AuthorizationResult;
  title: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 88,
    width: PAGE_WIDTH,
    height: 88,
    color: rgb(0.94, 0.98, 0.97),
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 88,
    width: 8,
    height: 88,
    color: accentColor,
  });
  page.drawText("Agente de Pre-Autorizacion Quirurgica", {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: accentColor,
  });
  y -= 26;
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 22,
    font: bold,
    color: TEXT_COLOR,
  });
  y -= 22;
  page.drawText(`Decision: ${result.decision}`, {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: accentColor,
  });
  y -= 36;

  for (const line of lines) {
    if (y < MARGIN + 72) {
      addFooter(page, regular, report, result);
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    const drawn = drawLabeledText(page, regular, bold, line, y, report, result);
    page = drawn.page;
    y = drawn.y;
    y -= 10;
  }

  addFooter(page, regular, report, result);

  return pdfDoc.save();
}

function drawLabeledText(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  line: PdfLine,
  y: number,
  report: MedicalReport,
  result: AuthorizationResult,
) {
  if (line.label) {
    page.drawText(`${line.label}:`, {
      x: MARGIN,
      y,
      size: BODY_SIZE,
      font: bold,
      color: TEXT_COLOR,
    });
    y -= LINE_HEIGHT;
  }

  const wrapped = wrapText(line.value, regular, PAGE_WIDTH - MARGIN * 2, BODY_SIZE);
  for (const textLine of wrapped) {
    if (y < MARGIN + 32) {
      addFooter(page, regular, report, result);
      page = page.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(textLine, {
      x: MARGIN,
      y,
      size: BODY_SIZE,
      font: regular,
      color: line.label ? MUTED_COLOR : TEXT_COLOR,
    });
    y -= LINE_HEIGHT;
  }

  return { page, y };
}

function addFooter(
  page: PDFPage,
  regular: PDFFont,
  report: MedicalReport,
  result: AuthorizationResult,
) {
  page.drawLine({
    start: { x: MARGIN, y: 44 },
    end: { x: PAGE_WIDTH - MARGIN, y: 44 },
    thickness: 0.5,
    color: rgb(0.82, 0.9, 0.88),
  });
  page.drawText(
    `Caso ${report.policyId} / ${report.patientId} - ${result.isUrgent ? "Urgente" : "Programada"}`,
    {
      x: MARGIN,
      y: 28,
      size: 8,
      font: regular,
      color: MUTED_COLOR,
    },
  );
}

function wrapText(text: string, font: PDFFont, maxWidth: number, fontSize: number) {
  const words = sanitizeText(text).split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function sanitizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function safeName(value: string) {
  return sanitizeText(value).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}
