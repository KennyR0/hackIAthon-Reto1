import type { InsurancePolicy, MedicalReport } from "@/types";
import { createAuthorizationResult } from "@/lib/notion";
import { extractClinicalData } from "@/lib/steps/extract-clinical";
import { generateDecision } from "@/lib/steps/generate-decision";
import { normalizeMedicalCodes } from "@/lib/steps/normalize-codes";
import { validatePolicy } from "@/lib/steps/validate-policy";

const ESTIMATED_SURGERY_COST_USD = 5_000;

export async function runAuthorizationAgent(
  report: MedicalReport,
  policy: InsurancePolicy,
) {
  const startedAt = Date.now();
  const reportText = `
Paciente: ${report.patientName}
Fecha del informe: ${report.reportDate}
Diagnóstico reportado: ${report.diagnosis}
Procedimiento solicitado: ${report.procedure}
Urgencia declarada por el solicitante: ${report.urgency}
  `.trim();

  const clinical = await extractClinicalData(reportText);
  const codes = await normalizeMedicalCodes(
    clinical.primaryDiagnosis,
    clinical.requestedProcedure,
  );
  const isUrgent = clinical.urgency === "Urgente" || report.urgency === "Urgente";
  const policyValidation = validatePolicy(
    policy,
    codes.specialtyCategory,
    ESTIMATED_SURGERY_COST_USD,
    isUrgent,
  );
  const result = await generateDecision(
    clinical,
    codes,
    policyValidation,
    isUrgent,
    startedAt,
  );

  await createAuthorizationResult({
    patientId: report.patientId,
    policyId: report.policyId,
    decision: result.decision,
    cie10: result.cie10Code,
    cpt: result.cptCode,
    justification: result.justification,
    missingDocs: result.missingDocuments?.join(", "),
    isUrgent: result.isUrgent,
  });

  return result;
}
