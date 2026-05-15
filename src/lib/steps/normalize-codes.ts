import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { MedicalCodes } from "@/types";

const medicalCodesSchema = z.object({
  cie10Code: z.string().min(1),
  cie10Description: z.string().min(1),
  cptCode: z.string().min(1),
  cupsCode: z.string().min(1),
  procedureDescription: z.string().min(1),
  specialtyCategory: z.string().min(1),
  confidence: z.enum(["alta", "media", "baja"]),
});

const medicalCodesJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "cie10Code",
    "cie10Description",
    "cptCode",
    "cupsCode",
    "procedureDescription",
    "specialtyCategory",
    "confidence",
  ],
  properties: {
    cie10Code: { type: "string" },
    cie10Description: { type: "string" },
    cptCode: { type: "string" },
    cupsCode: { type: "string" },
    procedureDescription: { type: "string" },
    specialtyCategory: { type: "string" },
    confidence: { type: "string", enum: ["alta", "media", "baja"] },
  },
};

const NORMALIZATION_SYSTEM_PROMPT = `
Eres un experto en codificación médica para pre-autorizaciones quirúrgicas.
Mapea el diagnóstico y procedimiento a códigos CIE-10, CPT y CUPS plausibles.

Reglas:
- Devuelve la especialidad médica como categoría de cobertura, por ejemplo "Cirugía General", "Ortopedia", "Ginecología".
- Si hay ambigüedad clínica o administrativa, usa confidence "media" o "baja".
- Si la confianza es baja, indica en procedureDescription que requiere verificación.
- No inventes detalles clínicos que no estén en la entrada.
`.trim();

export async function normalizeMedicalCodes(
  diagnosis: string,
  procedure: string,
): Promise<MedicalCodes> {
  return callLLMJson({
    systemPrompt: NORMALIZATION_SYSTEM_PROMPT,
    userMessage: `Diagnóstico: ${diagnosis}\nProcedimiento: ${procedure}`,
    schemaName: "medical_codes",
    jsonSchema: medicalCodesJsonSchema,
    zodSchema: medicalCodesSchema,
  });
}
