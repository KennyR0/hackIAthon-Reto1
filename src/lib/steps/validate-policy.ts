import type { InsurancePolicy, PolicyValidation } from "@/types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function coverageMatchesSpecialty(coverage: string, specialty: string): boolean {
  const normalizedCoverage = normalizeText(coverage);

  if (
    normalizedCoverage.includes(specialty) ||
    specialty.includes(normalizedCoverage)
  ) {
    return true;
  }

  const isSpineSpecialty =
    specialty.includes("ortopedia") ||
    specialty.includes("traumatologia") ||
    specialty.includes("neurocirugia");
  const isSpineCoverage =
    normalizedCoverage.includes("columna") ||
    normalizedCoverage.includes("neurocirugia") ||
    normalizedCoverage.includes("ortopedia") ||
    normalizedCoverage.includes("traumatologia");

  return isSpineSpecialty && isSpineCoverage;
}

export function validatePolicy(
  policy: InsurancePolicy,
  specialty: string,
  estimatedCost: number,
  isUrgent: boolean,
  currentDate: Date = new Date(),
): PolicyValidation {
  const validFrom = new Date(policy.validFrom);
  const validUntil = new Date(policy.validUntil);
  const failureReasons: string[] = [];
  const warnings: string[] = [];

  const isPolicyActive = currentDate >= validFrom && currentDate <= validUntil;
  if (!isPolicyActive) {
    failureReasons.push(
      `Póliza vencida o no vigente. Vigencia: ${policy.validFrom} - ${policy.validUntil}.`,
    );
  }

  const daysSinceStart = daysBetween(validFrom, currentDate);
  const waitingPeriodMet =
    isUrgent || daysSinceStart >= policy.waitingPeriodDays;
  if (!waitingPeriodMet) {
    failureReasons.push(
      `Período de carencia no cumplido. Requerido: ${policy.waitingPeriodDays} días. Transcurridos: ${daysSinceStart} días.`,
    );
  }

  const normalizedSpecialty = normalizeText(specialty);
  const isCovered = policy.coverages.some((coverage) =>
    coverageMatchesSpecialty(coverage, normalizedSpecialty),
  );
  if (!isCovered) {
    failureReasons.push(
      `La especialidad "${specialty}" no está incluida en las coberturas del plan ${policy.plan}.`,
    );
  }

  const exclusionList = normalizeText(policy.exclusions);
  const isExcluded =
    exclusionList.includes(normalizedSpecialty) ||
    (exclusionList.includes("cirugia electiva") && !isUrgent);
  if (isExcluded) {
    failureReasons.push(
      "El procedimiento puede estar excluido según las condiciones de la póliza.",
    );
  }

  if (
    exclusionList.includes("requiere") &&
    exclusionList.includes("resonancia")
  ) {
    warnings.push(
      "Documento faltante: resonancia magnetica vigente para auditoria de cirugia de columna.",
    );
  }

  const withinCoverageLimit = estimatedCost <= policy.maxSurgicalCoverage;
  if (!withinCoverageLimit) {
    warnings.push(
      `Costo estimado (${estimatedCost} USD) supera el tope quirúrgico (${policy.maxSurgicalCoverage} USD). Podría requerir copago o revisión administrativa.`,
    );
  }

  return {
    isPolicyActive,
    waitingPeriodMet,
    isCovered,
    isExcluded,
    withinCoverageLimit,
    failureReasons,
    warnings,
  };
}
