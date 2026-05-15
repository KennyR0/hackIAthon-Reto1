import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type {
  AuthorizationResult,
  ClinicalExtraction,
  MedicalCodes,
  PolicyValidation,
} from "@/types";

const decisionPayloadSchema = z.object({
  justification: z.string().min(1),
  missingDocuments: z.array(z.string()),
  recommendations: z.string().nullable(),
});

const decisionPayloadJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["justification", "missingDocuments", "recommendations"],
  properties: {
    justification: { type: "string" },
    missingDocuments: {
      type: "array",
      items: { type: "string" },
    },
    recommendations: { type: ["string", "null"] },
  },
};

const DECISION_SYSTEM_PROMPT = `
Eres un agente médico-administrativo especializado en pre-autorización quirúrgica.
Redacta una explicación profesional, empática y comprensible para el paciente y el médico.

Reglas:
- No cambies la decisión indicada por el sistema.
- Si la decisión es "Revisión", missingDocuments debe incluir al menos un documento, validación o acción administrativa necesaria.
- Si no faltan documentos, devuelve missingDocuments como [].
- No inventes coberturas, fechas ni condiciones de póliza.
`.trim();

function computeDecision(
  codes: MedicalCodes,
  policyValidation: PolicyValidation,
): AuthorizationResult["decision"] {
  if (policyValidation.failureReasons.length > 0) {
    return "Rechazado";
  }

  if (policyValidation.warnings.length > 0 || codes.confidence === "baja") {
    return "Revisión";
  }

  return "Aprobado";
}

function ensureReviewDocuments(
  decision: AuthorizationResult["decision"],
  missingDocuments: string[],
  policyValidation: PolicyValidation,
  codes: MedicalCodes,
): string[] {
  if (decision !== "Revisión" || missingDocuments.length > 0) {
    return missingDocuments;
  }

  if (codes.confidence === "baja") {
    return ["Validación manual de codificación médica"];
  }

  if (policyValidation.warnings.length > 0) {
    return ["Revisión administrativa del tope quirúrgico y posible copago"];
  }

  return ["Revisión administrativa del caso"];
}

export async function generateDecision(
  clinical: ClinicalExtraction,
  codes: MedicalCodes,
  policyValidation: PolicyValidation,
  isUrgent: boolean,
  startedAt: number = Date.now(),
): Promise<AuthorizationResult> {
  const decision = computeDecision(codes, policyValidation);
  const contextSummary = `
DECISIÓN DETERMINÍSTICA: ${decision}

DATOS CLÍNICOS:
- Diagnóstico principal: ${clinical.primaryDiagnosis}
- Procedimiento solicitado: ${clinical.requestedProcedure}
- Urgencia: ${clinical.urgency}
- Justificación de urgencia: ${clinical.urgencyJustification ?? "N/A"}

CODIFICACIÓN MÉDICA:
- CIE-10: ${codes.cie10Code} - ${codes.cie10Description}
- CPT: ${codes.cptCode}
- CUPS: ${codes.cupsCode}
- Procedimiento normalizado: ${codes.procedureDescription}
- Especialidad: ${codes.specialtyCategory}
- Confianza: ${codes.confidence}

VALIDACIÓN DE PÓLIZA:
- Póliza activa: ${policyValidation.isPolicyActive}
- Carencia cumplida: ${policyValidation.waitingPeriodMet}
- Procedimiento cubierto: ${policyValidation.isCovered}
- Excluido: ${policyValidation.isExcluded}
- Dentro del tope: ${policyValidation.withinCoverageLimit}
- Razones de rechazo: ${policyValidation.failureReasons.join("; ") || "Ninguna"}
- Advertencias: ${policyValidation.warnings.join("; ") || "Ninguna"}
  `.trim();

  const payload = await callLLMJson({
    systemPrompt: DECISION_SYSTEM_PROMPT,
    userMessage: contextSummary,
    schemaName: "authorization_decision_payload",
    jsonSchema: decisionPayloadJsonSchema,
    zodSchema: decisionPayloadSchema,
  });

  return {
    decision,
    cie10Code: codes.cie10Code,
    cptCode: codes.cptCode,
    justification: payload.justification,
    missingDocuments: ensureReviewDocuments(
      decision,
      payload.missingDocuments,
      policyValidation,
      codes,
    ),
    isUrgent,
    processingTimeMs: Date.now() - startedAt,
  };
}
