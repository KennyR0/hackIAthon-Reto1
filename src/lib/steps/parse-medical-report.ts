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
Eres un experto en documentación médica hospitalaria del sistema de salud ecuatoriano.
Tu tarea es extraer datos estructurados de informes médicos emitidos por hospitales,
clínicas privadas o centros de salud del IESS.

FORMATOS RECONOCIDOS EN ECUADOR:
- Formulario 053 del MSP (Referencia y Contrarreferencia)
- Formulario 033 del MSP (Historia Clínica Única)
- Formulario 008 del IESS (Solicitud de Atención Especializada)
- Epicrisis hospitalaria (formato libre de clínicas privadas)
- Certificado médico con membrete institucional
- Informe preoperatorio de especialista

CAMPOS A EXTRAER:
- patientId: número de cédula ecuatoriana (10 dígitos) o número de historia clínica.
  Si encuentras ambos, preferir la cédula.
- patientName: nombre completo del paciente tal como figura en el documento.
- reportDate: fecha del informe en formato ISO 8601 (YYYY-MM-DD). Si hay varias fechas,
  usar la de emisión/firma.
- diagnosis: diagnóstico principal completo, tal como lo redactó el médico. Incluir
  diagnósticos secundarios relevantes separados por punto y coma.
- procedure: nombre completo del procedimiento quirúrgico o intervención solicitada.
  Usar la denominación técnica que usa el médico.
- urgency: clasificar como "Urgente" si el documento contiene cualquiera de estas
  palabras o conceptos: urgente, emergencia, riesgo vital, hemorragia, perforación,
  obstrucción, sepsis, peritonitis, trauma, shock, intervención inmediata, cirugía de
  emergencia, no puede esperar, riesgo de muerte.
  En cualquier otro caso, clasificar como "Programada".
- policyId: número de póliza, afiliación o carnet del seguro si figura en el documento.
  Si no figura, retornar cadena vacía "".

REGLAS ESTRICTAS:
- No inventes datos. Si un campo no está en el texto, usa "" o null según corresponda.
- Para patientId, si no hay cédula ni historia clínica clara, devuelve "SIN-ID".
- Para reportDate, si no hay fecha clara, devuelve la fecha actual en ISO 8601.
- Los nombres de pacientes en Ecuador suelen ser: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2.
  Normaliza a "Nombre1 Nombre2 Apellido1 Apellido2" si puedes identificar la estructura.
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

/*
CASO 1 - Aprobado (Programada)
Input texto informe: "Paciente: Maria Alvarez, CC: 0987654321...
  Diagnostico: Apendicitis cronica..."
Output esperado: { patientId: "0987654321", urgency: "Programada", ... }

CASO 2 - Urgente (salta carencia)
Input texto informe: "Paciente presenta apendicitis aguda perforada con peritonitis
  generalizada. Requiere laparotomia de emergencia inmediata..."
Output esperado: { urgency: "Urgente", ... }

CASO 3 - Rechazado (fuera de cobertura)
Input texto poliza IESS: "Afiliado: Luis Paredes, No. Afiliacion: 1234567890-1..."
  (poliza con Plan Basico sin Ortopedia)
*/
