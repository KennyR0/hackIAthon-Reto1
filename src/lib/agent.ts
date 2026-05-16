import type { ClinicalExtraction, InsurancePolicy, MedicalReport } from "@/types";
import { createAuthorizationResult } from "@/lib/notion";
import { generateDecision } from "@/lib/steps/generate-decision";
import { normalizeMedicalCodes } from "@/lib/steps/normalize-codes";
import { validatePolicy } from "@/lib/steps/validate-policy";

const ESTIMATED_SURGERY_COST_USD = 5_000;

function clinicalFromReport(report: MedicalReport): ClinicalExtraction {
  return {
    primaryDiagnosis: report.diagnosis,
    secondaryDiagnoses: [],
    requestedProcedure: report.procedure,
    urgency: report.urgency,
    urgencyJustification:
      report.urgency === "Urgente"
        ? "Urgencia extraida del informe medico."
        : null,
    treatingPhysician: null,
    clinicalNotes: `Informe emitido el ${report.reportDate}.`,
  };
}

export async function runAuthorizationAgent(
  report: MedicalReport,
  policy: InsurancePolicy,
) {
  const startedAt = Date.now();
  const clinical = clinicalFromReport(report);
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

  const notionResultPageId = await createAuthorizationResult({
    patientId: report.patientId,
    policyId: report.policyId,
    decision: result.decision,
    cie10: result.cie10Code,
    cpt: result.cptCode,
    justification: result.justification,
    missingDocs: result.missingDocuments?.join(", "),
    isUrgent: result.isUrgent,
  });

  return {
    ...result,
    patientId: report.patientId,
    patientName: report.patientName,
    notionResultPageId,
  };
}
