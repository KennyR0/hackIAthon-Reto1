import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { MedicalCodes } from "@/types";

const medicalCodesSchema = z.object({
  cie10Code: z.string(),
  cie10Description: z.string(),
  cptCode: z.string(),
  cupsCode: z.string(),
  procedureDescription: z.string(),
  specialtyCategory: z.string(),
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
Eres un experto en codificacion medica para preautorizaciones quirurgicas.
Mapea diagnostico y procedimiento a codigos CIE-10, CPT y CUPS plausibles.

Reglas:
- Devuelve la especialidad como categoria de cobertura, por ejemplo "Cirugía General", "Ortopedia", "Ginecología" o "Neurocirugía".
- Si no sabes un codigo exacto, usa "N/D" en vez de cadena vacia.
- Si hay ambiguedad clinica o administrativa, usa confidence "media" o "baja".
- No inventes detalles clinicos que no esten en la entrada.
`.trim();

export async function normalizeMedicalCodes(
  diagnosis: string,
  procedure: string,
): Promise<MedicalCodes> {
  const codes = await callLLMJson({
    systemPrompt: NORMALIZATION_SYSTEM_PROMPT,
    userMessage: `Diagnostico: ${diagnosis}\nProcedimiento: ${procedure}`,
    schemaName: "medical_codes",
    jsonSchema: medicalCodesJsonSchema,
    zodSchema: medicalCodesSchema,
  });

  return {
    ...codes,
    cie10Code: codes.cie10Code.trim() || "N/D",
    cie10Description: codes.cie10Description.trim() || diagnosis,
    cptCode: codes.cptCode.trim() || "N/D",
    cupsCode: codes.cupsCode.trim() || "N/D",
    procedureDescription: codes.procedureDescription.trim() || procedure,
    specialtyCategory: codes.specialtyCategory.trim() || "Revision medica",
  };
}
