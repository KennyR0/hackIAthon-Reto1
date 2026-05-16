import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { InsurancePolicy } from "@/types";

const insurancePolicySchema = z.object({
  policyId: z.string(),
  holderName: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  waitingPeriodDays: z.number(),
  coverages: z.array(z.string()),
  exclusions: z.string(),
  maxSurgicalCoverage: z.number(),
  plan: z.enum(["Básico", "Plus", "Premium"]),
});

const insurancePolicyJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "policyId",
    "holderName",
    "validFrom",
    "validUntil",
    "waitingPeriodDays",
    "coverages",
    "exclusions",
    "maxSurgicalCoverage",
    "plan",
  ],
  properties: {
    policyId: { type: "string" },
    holderName: { type: "string" },
    validFrom: { type: "string" },
    validUntil: { type: "string" },
    waitingPeriodDays: { type: "number" },
    coverages: { type: "array", items: { type: "string" } },
    exclusions: { type: "string" },
    maxSurgicalCoverage: { type: "number" },
    plan: { type: "string", enum: ["Básico", "Plus", "Premium"] },
  },
};

const INSURANCE_POLICY_SYSTEM_PROMPT = `
Extrae datos de una poliza o afiliacion de salud ecuatoriana para preautorizacion quirurgica.
Devuelve solo JSON valido con el schema solicitado.

Campos:
- policyId: numero de poliza, certificado o afiliacion. Usa el valor del documento; si coincide con el hint, preferirlo.
- holderName: titular o afiliado.
- validFrom / validUntil: fechas YYYY-MM-DD. Si no hay fin explicito, usa un ano desde validFrom.
- waitingPeriodDays: carencia para cirugias electivas. Si no esta explicita, usa 180. Para IESS usa 0.
- coverages: especialidades/procedimientos cubiertos. Usa nombres como "Cirugía General", "Ortopedia y Traumatología", "Neurocirugía", "Ginecología y Obstetricia". Para IESS incluye cobertura amplia.
- exclusions: exclusiones, requisitos administrativos y documentos faltantes detectados. Conserva requisitos como resonancia magnetica, orden quirurgica, biopsia, laboratorios o autorizacion previa.
- maxSurgicalCoverage: monto USD. Para IESS usa 999999; si no hay dato usa 10000.
- plan: clasifica en "Básico", "Plus" o "Premium". Para IESS usa "Premium". Planes esenciales/basicos => "Básico"; intermedios/plus/preferente => "Plus"; superiores/premium/elite => "Premium".

No inventes coberturas especificas que contradigan el texto.
`.trim();

/**
 * Extracts the structured insurance policy used by the authorization pipeline.
 */
export async function parseInsurancePolicyPdf(
  pdfText: string,
  policyIdHint?: string,
): Promise<InsurancePolicy> {
  return callLLMJson({
    systemPrompt: INSURANCE_POLICY_SYSTEM_PROMPT,
    userMessage: [
      `Fecha actual: ${new Date().toISOString().slice(0, 10)}`,
      `Policy ID hint extraido del informe medico: ${policyIdHint?.trim() || "N/A"}`,
      "",
      "Texto de la poliza:",
      pdfText,
    ].join("\n"),
    schemaName: "insurance_policy_pdf_extraction",
    jsonSchema: insurancePolicyJsonSchema,
    zodSchema: insurancePolicySchema,
  });
}
