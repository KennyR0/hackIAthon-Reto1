import type {
  AuthorizationResult,
  ClinicalExtraction,
  MedicalCodes,
  PolicyValidation,
} from "@/types";

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
    return ["Validacion manual de codificacion medica"];
  }

  const documentWarning = policyValidation.warnings.find((warning) =>
    warning.toLowerCase().includes("documento faltante"),
  );
  if (documentWarning) {
    return [documentWarning.replace(/^Documento faltante:\s*/i, "")];
  }

  if (policyValidation.warnings.length > 0) {
    return ["Revision administrativa del tope quirurgico y posible copago"];
  }

  return ["Revision administrativa del caso"];
}

function buildMissingDocuments(
  decision: AuthorizationResult["decision"],
  policyValidation: PolicyValidation,
  codes: MedicalCodes,
): string[] {
  if (decision !== "Revisión") {
    return [];
  }

  const documentWarnings = policyValidation.warnings
    .filter((warning) => warning.toLowerCase().includes("documento faltante"))
    .map((warning) => warning.replace(/^Documento faltante:\s*/i, ""));

  return ensureReviewDocuments(
    decision,
    documentWarnings,
    policyValidation,
    codes,
  );
}

function buildJustification({
  clinical,
  codes,
  decision,
  missingDocuments,
  policyValidation,
}: {
  clinical: ClinicalExtraction;
  codes: MedicalCodes;
  decision: AuthorizationResult["decision"];
  missingDocuments: string[];
  policyValidation: PolicyValidation;
}): string {
  const clinicalSummary = `Diagnostico ${clinical.primaryDiagnosis}; procedimiento ${clinical.requestedProcedure}.`;
  const codingSummary = `Codigos sugeridos: CIE-10 ${codes.cie10Code}, CPT ${codes.cptCode}; especialidad ${codes.specialtyCategory}.`;

  if (decision === "Aprobado") {
    return `${clinicalSummary} ${codingSummary} La poliza esta vigente, cubre la especialidad solicitada y no presenta bloqueos administrativos para la preautorizacion.`;
  }

  if (decision === "Revisión") {
    const pending =
      missingDocuments.length > 0
        ? ` Pendiente: ${missingDocuments.join("; ")}.`
        : "";
    const warnings = policyValidation.warnings.join(" ");

    return `${clinicalSummary} ${codingSummary} El caso requiere revision administrativa antes de emitir aprobacion definitiva. ${warnings}${pending}`.trim();
  }

  const reasons = policyValidation.failureReasons.join(" ");
  return `${clinicalSummary} ${codingSummary} No se puede aprobar la solicitud porque existen bloqueos de poliza: ${reasons}`;
}

export async function generateDecision(
  clinical: ClinicalExtraction,
  codes: MedicalCodes,
  policyValidation: PolicyValidation,
  isUrgent: boolean,
  startedAt: number = Date.now(),
): Promise<AuthorizationResult> {
  const decision = computeDecision(codes, policyValidation);
  const missingDocuments = buildMissingDocuments(
    decision,
    policyValidation,
    codes,
  );

  return {
    decision,
    cie10Code: codes.cie10Code,
    cptCode: codes.cptCode,
    justification: buildJustification({
      clinical,
      codes,
      decision,
      missingDocuments,
      policyValidation,
    }),
    missingDocuments,
    isUrgent,
    processingTimeMs: Date.now() - startedAt,
  };
}
