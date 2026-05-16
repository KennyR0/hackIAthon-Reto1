import { NextResponse } from "next/server";
import { runAuthorizationAgent } from "@/lib/agent";
import {
  createInsurancePolicyRecord,
  createMedicalReportRecord,
  getInsurancePolicyRecord,
  getMedicalReportRecord,
} from "@/lib/notion";
import { extractPdfText } from "@/lib/pdf-reader";
import { parseInsurancePolicyPdf } from "@/lib/steps/parse-insurance-policy";
import { parseMedicalReportPdf } from "@/lib/steps/parse-medical-report";

export const maxDuration = 30;
export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function isScannedPdfError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.includes("PDF escaneado detectado")
  );
}

async function readPdfTextForField(
  buffer: Buffer,
  label: "informe medico" | "poliza",
): Promise<string | NextResponse<{ error: string }>> {
  try {
    return await extractPdfText(buffer);
  } catch (error) {
    console.error(`Error leyendo PDF de ${label}:`, error);

    if (isScannedPdfError(error)) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json(
      {
        error: `No se pudo leer el PDF de ${label}. Verifica que no este protegido con contrasena y que sea un PDF digital valido.`,
      },
      { status: 422 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const medicalReportFile = formData.get("medicalReport");
    const insurancePolicyFile = formData.get("insurancePolicy");

    if (!isPdfFile(medicalReportFile) || !isPdfFile(insurancePolicyFile)) {
      return NextResponse.json(
        { error: "Se requieren dos archivos PDF: informe medico y poliza." },
        { status: 400 },
      );
    }

    if (
      medicalReportFile.type !== "application/pdf" ||
      insurancePolicyFile.type !== "application/pdf"
    ) {
      return NextResponse.json(
        { error: "Solo se aceptan archivos PDF." },
        { status: 400 },
      );
    }

    if (
      medicalReportFile.size > MAX_PDF_SIZE_BYTES ||
      insurancePolicyFile.size > MAX_PDF_SIZE_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "El archivo PDF supera el limite de 10 MB. Por favor sube una version reducida.",
        },
        { status: 413 },
      );
    }

    const medicalReportBuffer = Buffer.from(
      await medicalReportFile.arrayBuffer(),
    );
    const insurancePolicyBuffer = Buffer.from(
      await insurancePolicyFile.arrayBuffer(),
    );

    const reportText = await readPdfTextForField(
      medicalReportBuffer,
      "informe medico",
    );
    if (reportText instanceof NextResponse) {
      return reportText;
    }

    const policyText = await readPdfTextForField(
      insurancePolicyBuffer,
      "poliza",
    );
    if (policyText instanceof NextResponse) {
      return policyText;
    }

    let report;
    try {
      report = await parseMedicalReportPdf(reportText);
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer la informacion del informe. Verifica que el documento sea legible.",
        },
        { status: 422 },
      );
    }

    let policy;
    try {
      policy = await parseInsurancePolicyPdf(policyText, report.policyId);
    } catch {
      return NextResponse.json(
        {
          error:
            "No se pudo extraer la informacion de la poliza. Verifica que el documento sea legible.",
        },
        { status: 422 },
      );
    }

    let notionReportPageId: string;
    let notionPolicyPageId: string;

    try {
      [notionReportPageId, notionPolicyPageId] = await Promise.all([
        createMedicalReportRecord({
          pdfBuffer: medicalReportBuffer,
          pdfFileName: medicalReportFile.name || "informe_medico.pdf",
          report,
        }),
        createInsurancePolicyRecord(policy),
      ]);
    } catch (error) {
      console.error("Error guardando documentos extraidos en Notion:", error);
      return NextResponse.json(
        {
          error:
            "No se pudo guardar la informacion extraida en Notion. Verifica los IDs de las bases y sus encabezados.",
        },
        { status: 500 },
      );
    }

    let savedReport;
    let savedPolicy;

    try {
      [savedReport, savedPolicy] = await Promise.all([
        getMedicalReportRecord(notionReportPageId),
        getInsurancePolicyRecord(notionPolicyPageId),
      ]);
    } catch (error) {
      console.error("Error leyendo documentos guardados en Notion:", error);
      return NextResponse.json(
        {
          error:
            "La informacion fue guardada, pero no se pudo leer desde Notion para ejecutar la preautorizacion.",
        },
        { status: 500 },
      );
    }

    const result = await runAuthorizationAgent(savedReport, savedPolicy);

    return NextResponse.json(
      { ...result, notionReportPageId, notionPolicyPageId, report: savedReport },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
