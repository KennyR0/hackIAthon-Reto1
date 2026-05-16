import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { MedicalReport } from "@/types";

const medicalReportSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  reportDate: z.string(),
  diagnosis: z.string(),
  procedure: z.string(),
  urgency: z.enum(["Urgente", "Programada"]),
  policyId: z.string(),
});

const medicalReportJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "patientId",
    "patientName",
    "reportDate",
    "diagnosis",
    "procedure",
    "urgency",
    "policyId",
  ],
  properties: {
    patientId: { type: "string" },
    patientName: { type: "string" },
    reportDate: { type: "string" },
    diagnosis: { type: "string" },
    procedure: { type: "string" },
    urgency: { type: "string", enum: ["Urgente", "Programada"] },
    policyId: { type: "string" },
  },
};

const MEDICAL_REPORT_SYSTEM_PROMPT = `
Extrae datos de un informe medico ecuatoriano para preautorizacion quirurgica.
Devuelve solo JSON valido con el schema solicitado.

Campos:
- patientId: cedula de 10 digitos o historia clinica. Si no existe, "SIN-ID".
- patientName: nombre completo del paciente; normaliza si el texto esta en orden APELLIDOS NOMBRES.
- reportDate: fecha de emision en YYYY-MM-DD. Si no hay fecha clara, usa la fecha actual recibida.
- diagnosis: diagnostico principal y secundarios relevantes.
- procedure: procedimiento quirurgico solicitado.
- urgency: "Urgente" solo si hay emergencia, riesgo vital, perforacion, sepsis, trauma, shock, peritonitis, hemorragia, obstruccion o cirugia inmediata; si no, "Programada".
- policyId: numero de poliza, afiliacion o carnet si aparece; si no, "".

No inventes datos fuera del texto.
`.trim();

/**
 * Extracts the structured medical report used by the authorization pipeline.
 */
export async function parseMedicalReportPdf(
  pdfText: string,
): Promise<MedicalReport> {
  return callLLMJson({
    systemPrompt: MEDICAL_REPORT_SYSTEM_PROMPT,
    userMessage: `Fecha actual: ${new Date().toISOString().slice(0, 10)}\n\nTexto del informe medico:\n${pdfText}`,
    schemaName: "medical_report_pdf_extraction",
    jsonSchema: medicalReportJsonSchema,
    zodSchema: medicalReportSchema,
  });
}
