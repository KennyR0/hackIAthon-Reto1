export interface MedicalReport {
  patientId: string;
  patientName: string;
  reportDate: string;
  diagnosis: string;
  procedure: string;
  urgency: "Urgente" | "Programada";
  policyId: string;
}

export interface InsurancePolicy {
  policyId: string;
  holderName: string;
  validFrom: string;
  validUntil: string;
  waitingPeriodDays: number;
  coverages: string[];
  exclusions: string;
  maxSurgicalCoverage: number;
  plan: "Básico" | "Plus" | "Premium";
}

export interface AuthorizationResult {
  decision: "Aprobado" | "Revisión" | "Rechazado";
  cie10Code: string;
  cptCode: string;
  justification: string;
  missingDocuments?: string[];
  isUrgent: boolean;
  processingTimeMs: number;
  patientId?: string;
  patientName?: string;
  notionResultPageId?: string;
  notionReportPageId?: string;
  notionPolicyPageId?: string;
}

export interface PreauthorizationCase {
  id: string;
  caseCode: string;
  patientId: string;
  policyId: string;
  decision: AuthorizationResult["decision"];
  cie10Code: string;
  cptCode: string;
  justification: string;
  missingDocuments: string[];
  isUrgent: boolean;
  decidedAt: string;
  supplementalStatus: "pendiente" | "cargado" | "no-aplica";
  supplementalFiles: string[];
}

export interface ExtractionError {
  field: "medicalReport" | "insurancePolicy";
  message: string;
}

export interface ClinicalExtraction {
  primaryDiagnosis: string;
  secondaryDiagnoses: string[];
  requestedProcedure: string;
  urgency: "Urgente" | "Programada";
  urgencyJustification: string | null;
  treatingPhysician: string | null;
  clinicalNotes: string | null;
}

export interface MedicalCodes {
  cie10Code: string;
  cie10Description: string;
  cptCode: string;
  cupsCode: string;
  procedureDescription: string;
  specialtyCategory: string;
  confidence: "alta" | "media" | "baja";
}

export interface PolicyValidation {
  isPolicyActive: boolean;
  waitingPeriodMet: boolean;
  isCovered: boolean;
  isExcluded: boolean;
  withinCoverageLimit: boolean;
  failureReasons: string[];
  warnings: string[];
}

export interface AuthorizationRequest {
  report: MedicalReport;
}
