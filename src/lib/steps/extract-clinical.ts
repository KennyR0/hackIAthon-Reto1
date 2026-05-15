import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { ClinicalExtraction } from "@/types";

const clinicalExtractionSchema = z.object({
  primaryDiagnosis: z.string().min(1),
  secondaryDiagnoses: z.array(z.string()),
  requestedProcedure: z.string().min(1),
  urgency: z.enum(["Urgente", "Programada"]),
  urgencyJustification: z.string().nullable(),
  treatingPhysician: z.string().nullable(),
  clinicalNotes: z.string().nullable(),
});

const clinicalExtractionJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "primaryDiagnosis",
    "secondaryDiagnoses",
    "requestedProcedure",
    "urgency",
    "urgencyJustification",
    "treatingPhysician",
    "clinicalNotes",
  ],
  properties: {
    primaryDiagnosis: { type: "string" },
    secondaryDiagnoses: {
      type: "array",
      items: { type: "string" },
    },
    requestedProcedure: { type: "string" },
    urgency: { type: "string", enum: ["Urgente", "Programada"] },
    urgencyJustification: { type: ["string", "null"] },
    treatingPhysician: { type: ["string", "null"] },
    clinicalNotes: { type: ["string", "null"] },
  },
};

const EXTRACTION_SYSTEM_PROMPT = `
Eres un asistente médico especializado en análisis de informes clínicos para pre-autorización quirúrgica.
Extrae únicamente información presente en el informe. No inventes datos.

Reglas de urgencia:
- Si el informe menciona riesgo vital, hemorragia, perforación, obstrucción, sepsis, trauma, peritonitis o intervención inmediata, urgency debe ser "Urgente".
- Si no hay urgencia clínica explícita, urgency debe ser "Programada".
- Si un campo no está disponible, usa null.
`.trim();

export async function extractClinicalData(
  reportText: string,
): Promise<ClinicalExtraction> {
  return callLLMJson({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userMessage: reportText,
    schemaName: "clinical_extraction",
    jsonSchema: clinicalExtractionJsonSchema,
    zodSchema: clinicalExtractionSchema,
  });
}
