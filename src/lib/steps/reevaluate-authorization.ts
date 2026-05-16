import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { AuthorizationResult, PreauthorizationCase } from "@/types";

const reevaluationSchema = z.object({
  decision: z.enum(["Aprobado", "Revisión", "Rechazado"]),
  justification: z.string().min(1),
  missingDocuments: z.array(z.string()),
});

const reevaluationJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decision", "justification", "missingDocuments"],
  properties: {
    decision: {
      type: "string",
      enum: ["Aprobado", "Revisión", "Rechazado"],
    },
    justification: { type: "string" },
    missingDocuments: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const REEVALUATION_SYSTEM_PROMPT = `
Eres un auditor medico-administrativo de preautorizaciones quirurgicas.
Reevalua un caso ya emitido usando el documento complementario cargado.

Reglas:
- No apruebes un caso si el documento complementario no corrige la causa real del rechazo.
- Si la causa era falta de documento y el PDF complementario la satisface, cambia la decision a "Aprobado" cuando no queden otros bloqueos.
- Si el PDF solo resuelve parte del problema, usa "Revisión" y lista los documentos o validaciones restantes.
- Si sigue existiendo falta de cobertura, poliza no vigente, carencia no resuelta o exclusion contractual, conserva "Rechazado".
- Redacta una justificacion nueva, clara y breve.
- Si la decision final es "Aprobado", missingDocuments debe ser [].
`.trim();

export async function reevaluateAuthorizationWithSupplement(
  authorization: PreauthorizationCase,
  supplementalText: string,
): Promise<Pick<
  AuthorizationResult,
  "decision" | "justification" | "missingDocuments"
>> {
  const userMessage = `
CASO ORIGINAL:
- Codigo: ${authorization.caseCode}
- ID paciente: ${authorization.patientId}
- ID poliza: ${authorization.policyId}
- Decision anterior: ${authorization.decision}
- CIE-10: ${authorization.cie10Code}
- CPT/CUPS: ${authorization.cptCode}
- Justificacion anterior: ${authorization.justification}
- Documentos faltantes anteriores: ${
    authorization.missingDocuments.join("; ") || "Ninguno"
  }

DOCUMENTO COMPLEMENTARIO CARGADO:
${supplementalText.slice(0, 8_000)}
  `.trim();

  return callLLMJson({
    systemPrompt: REEVALUATION_SYSTEM_PROMPT,
    userMessage,
    schemaName: "authorization_reevaluation",
    jsonSchema: reevaluationJsonSchema,
    zodSchema: reevaluationSchema,
  });
}
