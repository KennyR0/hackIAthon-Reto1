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
}
