# 🤖 Plan de Implementación — Fase 2: Motor de Decisión con IA

> **Duración estimada:** 1–2 días  
> **Objetivo:** Construir el núcleo inteligente del agente — extracción clínica con Claude, normalización a CIE-10/CPT y el motor de reglas que valida la póliza para emitir una decisión.

---

## 1. Visión General del Motor

```
Informe Médico (texto)
        │
        ▼
┌───────────────────┐
│  Paso 1: Extracción│  → Claude extrae: diagnóstico, procedimiento, urgencia
│  Clínica con IA   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Paso 2: Normali- │  → Claude mapea a CIE-10 y CPT/CUPS
│  zación Médica    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Paso 3: Validación│ → Motor de reglas puras (sin IA):
│  de Póliza        │   vigencia, carencia, cobertura, exclusiones
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Paso 4: Decisión │  → Claude sintetiza todo y redacta respuesta final
│  Final            │   con justificación médica-contractual
└───────────────────┘
```

---

## 2. Cliente Anthropic (`src/lib/claude.ts`)

```typescript
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await response.json();
  return data.content[0].text;
}

export { callClaude };
```

---

## 3. Paso 1 — Extracción Clínica (`src/lib/steps/extract-clinical.ts`)

### Prompt del sistema

```typescript
const EXTRACTION_SYSTEM_PROMPT = `
Eres un asistente médico especializado en análisis de informes clínicos.
Tu tarea es extraer información estructurada de informes médicos en texto libre.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "primaryDiagnosis": "descripción del diagnóstico principal",
  "secondaryDiagnoses": ["diagnóstico secundario 1"],
  "requestedProcedure": "nombre exacto de la cirugía solicitada",
  "urgency": "Urgente" | "Programada",
  "urgencyJustification": "razón clínica de la urgencia si aplica",
  "treatingPhysician": "nombre del médico si está disponible",
  "clinicalNotes": "observaciones adicionales relevantes"
}

Reglas:
- Si el informe menciona riesgo vital, hemorragia, perforación, obstrucción o trauma: urgency = "Urgente"
- No inventes información que no esté en el texto
- Si un campo no está disponible, usa null
`;
```

### Función de extracción

```typescript
import { callClaude } from "../claude";

export interface ClinicalExtraction {
  primaryDiagnosis: string;
  secondaryDiagnoses: string[];
  requestedProcedure: string;
  urgency: "Urgente" | "Programada";
  urgencyJustification: string | null;
  treatingPhysician: string | null;
  clinicalNotes: string | null;
}

export async function extractClinicalData(
  reportText: string
): Promise<ClinicalExtraction> {
  const raw = await callClaude(EXTRACTION_SYSTEM_PROMPT, reportText);
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ClinicalExtraction;
}
```

---

## 4. Paso 2 — Normalización Médica (`src/lib/steps/normalize-codes.ts`)

### Prompt del sistema

```typescript
const NORMALIZATION_SYSTEM_PROMPT = `
Eres un experto en codificación médica con dominio en CIE-10, CPT y CUPS.
Dado un diagnóstico y procedimiento en texto libre, devuelve los códigos estándar.

Responde ÚNICAMENTE con un JSON válido:
{
  "cie10Code": "X00.0",
  "cie10Description": "Descripción oficial del código",
  "cptCode": "00000",
  "cupsCode": "000000",
  "procedureDescription": "Nombre oficial estandarizado del procedimiento",
  "specialtyCategory": "especialidad médica (ej: Ortopedia, Cirugía General)",
  "confidence": "alta" | "media" | "baja"
}

Si la confianza es baja, igualmente proporciona el código más cercano e indica en procedureDescription que requiere verificación.
`;
```

### Función de normalización

```typescript
export interface MedicalCodes {
  cie10Code: string;
  cie10Description: string;
  cptCode: string;
  cupsCode: string;
  procedureDescription: string;
  specialtyCategory: string;
  confidence: "alta" | "media" | "baja";
}

export async function normalizeMedicalCodes(
  diagnosis: string,
  procedure: string
): Promise<MedicalCodes> {
  const input = `Diagnóstico: ${diagnosis}\nProcedimiento: ${procedure}`;
  const raw = await callClaude(NORMALIZATION_SYSTEM_PROMPT, input);
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as MedicalCodes;
}
```

---

## 5. Paso 3 — Validación de Póliza (`src/lib/steps/validate-policy.ts`)

> Este paso usa **lógica pura** (sin IA) para garantizar precisión contractual.

```typescript
import { InsurancePolicy } from "@/types";

export interface PolicyValidation {
  isPolicyActive: boolean;
  waitingPeriodMet: boolean;
  isCovered: boolean;
  isExcluded: boolean;
  withinCoverageLimit: boolean;
  failureReasons: string[];
  warnings: string[];
}

export function validatePolicy(
  policy: InsurancePolicy,
  specialty: string,
  estimatedCost: number,
  isUrgent: boolean
): PolicyValidation {
  const today = new Date();
  const validFrom = new Date(policy.validFrom);
  const validUntil = new Date(policy.validUntil);
  const failureReasons: string[] = [];
  const warnings: string[] = [];

  // 1. Vigencia de la póliza
  const isPolicyActive = today >= validFrom && today <= validUntil;
  if (!isPolicyActive) {
    failureReasons.push(
      `Póliza vencida o no vigente. Vigencia: ${policy.validFrom} - ${policy.validUntil}`
    );
  }

  // 2. Período de carencia (se omite si el caso es urgente)
  const daysSinceStart = Math.floor(
    (today.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24)
  );
  const waitingPeriodMet =
    isUrgent || daysSinceStart >= policy.waitingPeriodDays;
  if (!waitingPeriodMet && !isUrgent) {
    failureReasons.push(
      `Período de carencia no cumplido. Requerido: ${policy.waitingPeriodDays} días. Transcurridos: ${daysSinceStart} días.`
    );
  }

  // 3. Cobertura por especialidad
  const isCovered = policy.coverages.some(
    (c) => c.toLowerCase().includes(specialty.toLowerCase())
  );
  if (!isCovered) {
    failureReasons.push(
      `La especialidad "${specialty}" no está incluida en las coberturas del plan ${policy.plan}.`
    );
  }

  // 4. Exclusiones
  const exclusionList = policy.exclusions.toLowerCase();
  const isExcluded =
    exclusionList.includes(specialty.toLowerCase()) ||
    exclusionList.includes("cirugía electiva") && !isUrgent;
  if (isExcluded) {
    failureReasons.push(
      `El procedimiento puede estar excluido según las condiciones de la póliza.`
    );
  }

  // 5. Tope quirúrgico
  const withinCoverageLimit =
    estimatedCost <= policy.maxSurgicalCoverage;
  if (!withinCoverageLimit) {
    warnings.push(
      `Costo estimado (${estimatedCost} USD) supera el tope quirúrgico (${policy.maxSurgicalCoverage} USD). Podría requerir copago.`
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
```

---

## 6. Paso 4 — Decisión Final (`src/lib/steps/generate-decision.ts`)

```typescript
import { callClaude } from "../claude";
import { ClinicalExtraction } from "./extract-clinical";
import { MedicalCodes } from "./normalize-codes";
import { PolicyValidation } from "./validate-policy";
import { AuthorizationResult } from "@/types";

const DECISION_SYSTEM_PROMPT = `
Eres un agente médico-administrativo especializado en pre-autorización quirúrgica.
Basándote en el análisis clínico y la validación de póliza proporcionados,
debes emitir una decisión formal de pre-autorización.

Responde ÚNICAMENTE con un JSON válido:
{
  "decision": "Aprobado" | "Revisión" | "Rechazado",
  "justification": "Explicación clara en español para el paciente y el médico",
  "missingDocuments": ["documento 1", "documento 2"],
  "recommendations": "instrucciones adicionales si aplica"
}

Reglas de decisión:
- "Aprobado": todos los criterios de póliza se cumplen
- "Revisión": advertencias presentes o confianza baja en códigos médicos
- "Rechazado": al menos un criterio falla (póliza vencida, carencia, exclusión)
- Para casos URGENTES: priorizar "Aprobado" o "Revisión", nunca rechazar por carencia
- La justificación debe ser profesional, empática y comprensible
`;

export async function generateDecision(
  clinical: ClinicalExtraction,
  codes: MedicalCodes,
  policyValidation: PolicyValidation,
  isUrgent: boolean
): Promise<AuthorizationResult> {
  const startTime = Date.now();

  const contextSummary = `
DATOS CLÍNICOS:
- Diagnóstico: ${clinical.primaryDiagnosis}
- Procedimiento: ${clinical.requestedProcedure}
- Urgencia: ${clinical.urgency}
- Justificación de urgencia: ${clinical.urgencyJustification ?? "N/A"}

CODIFICACIÓN MÉDICA:
- CIE-10: ${codes.cie10Code} — ${codes.cie10Description}
- CPT: ${codes.cptCode} / CUPS: ${codes.cupsCode}
- Especialidad: ${codes.specialtyCategory}
- Confianza de codificación: ${codes.confidence}

VALIDACIÓN DE PÓLIZA:
- Póliza activa: ${policyValidation.isPolicyActive}
- Carencia cumplida: ${policyValidation.waitingPeriodMet}
- Procedimiento cubierto: ${policyValidation.isCovered}
- Excluido: ${policyValidation.isExcluded}
- Dentro del tope: ${policyValidation.withinCoverageLimit}
- Razones de fallo: ${policyValidation.failureReasons.join("; ") || "Ninguna"}
- Advertencias: ${policyValidation.warnings.join("; ") || "Ninguna"}
  `.trim();

  const raw = await callClaude(DECISION_SYSTEM_PROMPT, contextSummary);
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  return {
    decision: parsed.decision,
    cie10Code: codes.cie10Code,
    cptCode: codes.cptCode,
    justification: parsed.justification,
    missingDocuments: parsed.missingDocuments ?? [],
    isUrgent,
    processingTimeMs: Date.now() - startTime,
  };
}
```

---

## 7. Orquestador Principal (`src/lib/agent.ts`)

```typescript
import { MedicalReport, InsurancePolicy } from "@/types";
import { extractClinicalData } from "./steps/extract-clinical";
import { normalizeMedicalCodes } from "./steps/normalize-codes";
import { validatePolicy } from "./steps/validate-policy";
import { generateDecision } from "./steps/generate-decision";
import { createAuthorizationResult } from "./notion";

const ESTIMATED_SURGERY_COST_USD = 5000; // Puede venir del informe futuro

export async function runAuthorizationAgent(
  report: MedicalReport,
  policy: InsurancePolicy
) {
  console.log(`[AGENT] Iniciando análisis para paciente: ${report.patientId}`);

  // Paso 1: Extracción clínica
  const clinical = await extractClinicalData(
    `${report.diagnosis}\n${report.procedure}`
  );

  // Paso 2: Normalización de códigos
  const codes = await normalizeMedicalCodes(
    clinical.primaryDiagnosis,
    clinical.requestedProcedure
  );

  // Paso 3: Validación de póliza
  const policyValidation = validatePolicy(
    policy,
    codes.specialtyCategory,
    ESTIMATED_SURGERY_COST_USD,
    clinical.urgency === "Urgente"
  );

  // Paso 4: Decisión final
  const result = await generateDecision(
    clinical,
    codes,
    policyValidation,
    clinical.urgency === "Urgente"
  );

  // Guardar en Notion
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

  console.log(`[AGENT] Decisión emitida: ${result.decision} en ${result.processingTimeMs}ms`);
  return result;
}
```

---

## 8. API Route (`src/app/api/authorize/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { runAuthorizationAgent } from "@/lib/agent";
import { getPolicyById } from "@/lib/notion";
import { MedicalReport } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report: MedicalReport = body.report;

    // Obtener póliza desde Notion
    const policyPage = await getPolicyById(report.policyId);
    if (!policyPage) {
      return NextResponse.json(
        { error: "Póliza no encontrada" },
        { status: 404 }
      );
    }

    // Extraer propiedades de Notion (mapeo simplificado)
    const props = (policyPage as any).properties;
    const policy = {
      policyId: report.policyId,
      holderName: props["Titular"]?.rich_text[0]?.text?.content ?? "",
      validFrom: props["Vigencia Desde"]?.date?.start ?? "",
      validUntil: props["Vigencia Hasta"]?.date?.start ?? "",
      waitingPeriodDays: props["Periodo Carencia"]?.number ?? 0,
      coverages: props["Coberturas"]?.multi_select?.map((s: any) => s.name) ?? [],
      exclusions: props["Exclusiones"]?.rich_text[0]?.text?.content ?? "",
      maxSurgicalCoverage: props["Tope Quirúrgico"]?.number ?? 0,
      plan: props["Plan"]?.select?.name ?? "Básico",
    };

    const result = await runAuthorizationAgent(report, policy);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[API ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## 9. Checklist de Cierre — Fase 2

- [ ] `extractClinicalData()` retorna JSON limpio con diagnóstico y urgencia
- [ ] `normalizeMedicalCodes()` retorna códigos CIE-10 y CPT plausibles
- [ ] `validatePolicy()` detecta correctamente carencia, exclusiones y vigencia
- [ ] `generateDecision()` emite `Aprobado` / `Revisión` / `Rechazado` con justificación
- [ ] El orquestador `runAuthorizationAgent()` completa el flujo de extremo a extremo
- [ ] La API Route responde en < 10 segundos en casos normales
- [ ] Prueba manual con caso `Urgente` omite validación de carencia correctamente
- [ ] Resultado guardado en la DB de Notion correctamente

---

> ➡️ **Siguiente fase:** [Plan Fase 3 — Web UI y Despliegue](./plan-fase-3-ui-despliegue.md)
