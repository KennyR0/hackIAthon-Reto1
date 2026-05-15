# 👤 Persona 2 — Motor de Decisión con IA
## HackIAthon · Agente de Pre-Autorización Quirúrgica

> **Rama Git:** `feat/ai-engine`  
> **Duración estimada:** 1–2 días  
> **Dependencia de otros:** Necesitas `src/types/index.ts` de Persona 1 (disponible el día 0, ~30 min después de que arranquen)

---

## 🎯 Tu misión

Construir el cerebro del agente: los 4 pasos de análisis con Openai, el motor de reglas de póliza y la API route que los orquesta. Trabajas con un **mock de Notion** desde el principio para no depender de que Persona 1 termine las bases de datos.

---

## ✅ Checklist completo

### Día 0 — Setup independiente
- [ ] Clonar el repo cuando Persona 1 haga el primer push
- [ ] Crear la rama: `git checkout -b feat/ai-engine`
- [ ] Crear `src/lib/__mocks__/notion.ts` con los datos falsos
- [ ] Verificar que los tipos del mock coinciden con `InsurancePolicy` de `types/index.ts`

### Día 1 AM — Pasos 1 y 2: Extracción y normalización
- [ ] Crear `src/lib/Openai.ts` con la función `callOpenai`
- [ ] Crear `src/lib/steps/extract-clinical.ts` con `extractClinicalData`
- [ ] Probar: "apendicitis aguda perforada" → `urgency: "Urgente"`
- [ ] Crear `src/lib/steps/normalize-codes.ts` con `normalizeMedicalCodes`
- [ ] Probar: "apendicectomía laparoscópica" → código CIE-10 cercano a `K35`

### Día 1 PM — Pasos 3 y 4: Validación y decisión
- [ ] Crear `src/lib/steps/validate-policy.ts` con `validatePolicy` (lógica pura, sin IA)
- [ ] Test carencia: `isUrgent=true` siempre salta la carencia
- [ ] Test cobertura: `Ortopedia` en póliza sin esa cobertura → `failureReasons` no vacío
- [ ] Crear `src/lib/steps/generate-decision.ts` con `generateDecision`
- [ ] Crear `src/lib/agent.ts` que orquesta los 4 pasos
- [ ] Probar flujo completo end-to-end con el mock de Notion

### Día 2 — API route + integración real
- [ ] Crear `src/app/api/authorize/route.ts` con el handler POST
- [ ] Cuando Persona 1 avise: cambiar import `__mocks__/notion` → `lib/notion`
- [ ] Verificar que el mapeo de propiedades Notion coincide con los nombres reales
- [ ] Probar con `curl` el endpoint en local
- [ ] Ejecutar `pnpm build` sin errores
- [ ] Mergear `feat/ai-engine` → `main` después de que Persona 1 haya mergeado

---

## 🔧 Paso 0 — Mock de Notion (para trabajar sin depender de Persona 1)

Crea este archivo antes de empezar cualquier otra cosa. Te da independencia total.

```typescript
// src/lib/__mocks__/notion.ts

export async function getPolicyById(_policyId: string) {
  // Simula una póliza Plus con Cirugía General cubierta
  return {
    properties: {
      Titular: { rich_text: [{ text: { content: "Juan Pérez (MOCK)" } }] },
      "Vigencia Desde": { date: { start: "2024-01-01" } },
      "Vigencia Hasta": { date: { start: "2025-12-31" } },
      "Periodo Carencia": { number: 90 },
      Coberturas: { multi_select: [{ name: "Cirugía General" }] },
      Exclusiones: { rich_text: [{ text: { content: "" } }] },
      "Tope Quirúrgico": { number: 10000 },
      Plan: { select: { name: "Plus" } },
    },
  };
}

export async function createAuthorizationResult(data: any) {
  console.log("[MOCK Notion] Resultado guardado:", JSON.stringify(data, null, 2));
  return { id: `mock-${Date.now()}` };
}

export async function getMedicalReport(_pageId: string) {
  return { id: "mock-page" };
}
```

> Cuando Persona 1 avise que `notion.ts` está listo, cambias el import en `agent.ts`  
> de `"../lib/__mocks__/notion"` a `"../lib/notion"` y listo.

---

## 🔧 Paso 1 — Cliente Openai (`src/lib/Openai.ts`)

```typescript
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function callOpenai(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "Openai-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Openai API error: ${error.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
```

> Necesitas `ANTHROPIC_API_KEY` en tu `.env.local`. Pedirla al equipo.

---

## 🔧 Paso 2 — Extracción clínica (`src/lib/steps/extract-clinical.ts`)

```typescript
import { callOpenai } from "../Openai";

const EXTRACTION_SYSTEM_PROMPT = `
Eres un asistente médico especializado en análisis de informes clínicos.
Tu tarea es extraer información estructurada de informes médicos en texto libre.

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "primaryDiagnosis": "descripción del diagnóstico principal",
  "secondaryDiagnoses": ["diagnóstico secundario 1"],
  "requestedProcedure": "nombre exacto de la cirugía solicitada",
  "urgency": "Urgente",
  "urgencyJustification": "razón clínica de la urgencia o null",
  "treatingPhysician": "nombre del médico si está disponible o null",
  "clinicalNotes": "observaciones adicionales relevantes o null"
}

Reglas estrictas:
- Si el informe menciona: riesgo vital, hemorragia, perforación, obstrucción o trauma → urgency = "Urgente"
- Si no hay urgencia clínica → urgency = "Programada"
- No inventes información que no esté en el texto
- Si un campo no está disponible, usa null
- Responde SOLO con el JSON, sin texto adicional ni backticks
`;

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
  const raw = await callOpenai(EXTRACTION_SYSTEM_PROMPT, reportText);
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as ClinicalExtraction;
}
```

**Prueba rápida:**
```typescript
const result = await extractClinicalData(
  "Paciente con apendicitis aguda perforada con peritonitis generalizada. Requiere intervención inmediata."
);
console.log(result.urgency); // debe imprimir "Urgente"
```

---

## 🔧 Paso 3 — Normalización médica (`src/lib/steps/normalize-codes.ts`)

```typescript
import { callOpenai } from "../Openai";

const NORMALIZATION_SYSTEM_PROMPT = `
Eres un experto en codificación médica con dominio en CIE-10, CPT y CUPS.
Dado un diagnóstico y procedimiento en texto libre, devuelve los códigos estándar.

Responde ÚNICAMENTE con un JSON válido sin backticks:
{
  "cie10Code": "X00.0",
  "cie10Description": "Descripción oficial del código",
  "cptCode": "00000",
  "cupsCode": "000000",
  "procedureDescription": "Nombre oficial estandarizado del procedimiento",
  "specialtyCategory": "especialidad médica (ej: Ortopedia, Cirugía General)",
  "confidence": "alta"
}

El campo confidence debe ser: "alta" | "media" | "baja"
Si la confianza es baja, indica en procedureDescription que requiere verificación.
Responde SOLO con el JSON.
`;

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
  const raw = await callOpenai(NORMALIZATION_SYSTEM_PROMPT, input);
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as MedicalCodes;
}
```

---

## 🔧 Paso 4 — Validación de póliza (`src/lib/steps/validate-policy.ts`)

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
      `Póliza vencida o no vigente. Vigencia: ${policy.validFrom} — ${policy.validUntil}`
    );
  }

  // 2. Período de carencia (se omite completamente si el caso es URGENTE)
  const daysSinceStart = Math.floor(
    (today.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24)
  );
  const waitingPeriodMet = isUrgent || daysSinceStart >= policy.waitingPeriodDays;
  if (!waitingPeriodMet) {
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
    (exclusionList.includes("cirugía electiva") && !isUrgent);
  if (isExcluded) {
    failureReasons.push(
      `El procedimiento puede estar excluido según las condiciones de la póliza.`
    );
  }

  // 5. Tope quirúrgico (es advertencia, no rechazo automático)
  const withinCoverageLimit = estimatedCost <= policy.maxSurgicalCoverage;
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

**Tests críticos a verificar manualmente:**

```typescript
// Test 1: caso urgente salta carencia
const result1 = validatePolicy(policy, "Cirugía General", 3000, true);
console.log(result1.waitingPeriodMet); // debe ser true aunque no cumplió carencia

// Test 2: especialidad no cubierta genera error
const result2 = validatePolicy(basicPolicy, "Ortopedia", 3000, false);
console.log(result2.isCovered); // debe ser false
console.log(result2.failureReasons.length > 0); // debe ser true
```

---

## 🔧 Paso 5 — Decisión final (`src/lib/steps/generate-decision.ts`)

```typescript
import { callOpenai } from "../Openai";
import { ClinicalExtraction } from "./extract-clinical";
import { MedicalCodes } from "./normalize-codes";
import { PolicyValidation } from "./validate-policy";
import { AuthorizationResult } from "@/types";

const DECISION_SYSTEM_PROMPT = `
Eres un agente médico-administrativo especializado en pre-autorización quirúrgica.
Basándote en el análisis clínico y la validación de póliza proporcionados,
debes emitir una decisión formal de pre-autorización.

Responde ÚNICAMENTE con un JSON válido sin backticks:
{
  "decision": "Aprobado",
  "justification": "Explicación clara y empática en español para el paciente y el médico",
  "missingDocuments": ["documento 1 si aplica"],
  "recommendations": "instrucciones adicionales o null"
}

Reglas de decisión:
- "Aprobado": todos los criterios de póliza se cumplen
- "Revisión": advertencias presentes o confianza baja en códigos médicos
- "Rechazado": al menos un criterio falla (póliza vencida, carencia no cumplida, exclusión)
- Para casos URGENTES: priorizar "Aprobado" o "Revisión", NUNCA rechazar solo por carencia
- La justificación debe ser profesional, empática y comprensible para el paciente
- Si decision es "Revisión", missingDocuments debe tener al menos un elemento
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
- Diagnóstico principal: ${clinical.primaryDiagnosis}
- Procedimiento solicitado: ${clinical.requestedProcedure}
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

  const raw = await callOpenai(DECISION_SYSTEM_PROMPT, contextSummary);
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

## 🔧 Paso 6 — Orquestador (`src/lib/agent.ts`)

```typescript
import { MedicalReport, InsurancePolicy } from "@/types";
import { extractClinicalData } from "./steps/extract-clinical";
import { normalizeMedicalCodes } from "./steps/normalize-codes";
import { validatePolicy } from "./steps/validate-policy";
import { generateDecision } from "./steps/generate-decision";

// DURANTE DESARROLLO: usa el mock
// import { createAuthorizationResult } from "./__mocks__/notion";
// CUANDO PERSONA 1 AVISE: cambia a la línea de abajo
import { createAuthorizationResult } from "./notion";

const ESTIMATED_SURGERY_COST_USD = 5000;

export async function runAuthorizationAgent(
  report: MedicalReport,
  policy: InsurancePolicy
) {
  console.log(`[AGENT] Iniciando análisis para paciente: ${report.patientId}`);
  const t0 = Date.now();

  // Paso 1: Extracción clínica con IA
  const clinical = await extractClinicalData(
    `${report.diagnosis}\n\nProcedimiento solicitado: ${report.procedure}`
  );
  console.log(`[AGENT] Paso 1 OK — urgencia detectada: ${clinical.urgency}`);

  // Paso 2: Normalización a CIE-10 / CPT
  const codes = await normalizeMedicalCodes(
    clinical.primaryDiagnosis,
    clinical.requestedProcedure
  );
  console.log(`[AGENT] Paso 2 OK — CIE-10: ${codes.cie10Code}`);

  // Paso 3: Validación de póliza (lógica pura)
  const policyValidation = validatePolicy(
    policy,
    codes.specialtyCategory,
    ESTIMATED_SURGERY_COST_USD,
    clinical.urgency === "Urgente"
  );
  console.log(`[AGENT] Paso 3 OK — fallos: ${policyValidation.failureReasons.length}`);

  // Paso 4: Decisión final con IA
  const result = await generateDecision(
    clinical,
    codes,
    policyValidation,
    clinical.urgency === "Urgente"
  );
  console.log(`[AGENT] Paso 4 OK — decisión: ${result.decision}`);

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

  console.log(`[AGENT] Completado en ${Date.now() - t0}ms`);
  return result;
}
```

---

## 🔧 Paso 7 — API Route (`src/app/api/authorize/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { runAuthorizationAgent } from "@/lib/agent";
import { getPolicyById } from "@/lib/notion";
import { MedicalReport } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report: MedicalReport = body.report;

    if (!report?.patientId || !report?.policyId) {
      return NextResponse.json(
        { error: "patientId y policyId son requeridos" },
        { status: 400 }
      );
    }

    // Obtener póliza desde Notion
    const policyPage = await getPolicyById(report.policyId);
    if (!policyPage) {
      return NextResponse.json(
        { error: `Póliza "${report.policyId}" no encontrada` },
        { status: 404 }
      );
    }

    // Mapear propiedades de Notion al tipo InsurancePolicy
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
    return NextResponse.json(
      { error: err.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

---

## 📁 Estructura de archivos que debes crear

```
src/
├── lib/
│   ├── Openai.ts                       ← TU RESPONSABILIDAD
│   ├── agent.ts                        ← TU RESPONSABILIDAD
│   ├── __mocks__/
│   │   └── notion.ts                   ← TU MOCK (no se commitea al final)
│   └── steps/
│       ├── extract-clinical.ts         ← TU RESPONSABILIDAD
│       ├── normalize-codes.ts          ← TU RESPONSABILIDAD
│       ├── validate-policy.ts          ← TU RESPONSABILIDAD
│       └── generate-decision.ts        ← TU RESPONSABILIDAD
└── app/
    └── api/
        └── authorize/
            └── route.ts               ← TU RESPONSABILIDAD
```

---

## 🧪 Prueba E2E antes de mergear

```bash
# Iniciar servidor
pnpm dev

# Caso 1: Programada, debe aprobar
curl -X POST http://localhost:3000/api/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "report": {
      "patientId": "0987654321",
      "patientName": "Carlos Mendoza",
      "reportDate": "2025-05-14T00:00:00Z",
      "diagnosis": "Apendicitis crónica con dolor recurrente en fosa ilíaca derecha",
      "procedure": "Apendicectomía laparoscópica electiva",
      "urgency": "Programada",
      "policyId": "POL-2024-001"
    }
  }'

# Caso 2: Urgente, debe aprobar aunque tenga carencia
curl -X POST http://localhost:3000/api/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "report": {
      "patientId": "1122334455",
      "patientName": "Ana Torres",
      "reportDate": "2025-05-14T00:00:00Z",
      "diagnosis": "Apendicitis aguda perforada con peritonitis generalizada",
      "procedure": "Laparotomía exploratoria de emergencia",
      "urgency": "Urgente",
      "policyId": "POL-2024-002"
    }
  }'

# Caso 3: Ortopedia excluida, debe rechazar
curl -X POST http://localhost:3000/api/authorize \
  -H "Content-Type: application/json" \
  -d '{
    "report": {
      "patientId": "5566778899",
      "patientName": "Luis Paredes",
      "reportDate": "2025-05-14T00:00:00Z",
      "diagnosis": "Ruptura de ligamento cruzado anterior de rodilla derecha",
      "procedure": "Reconstrucción artroscópica de ligamento cruzado anterior",
      "urgency": "Programada",
      "policyId": "POL-2024-003"
    }
  }'
```

---

## 🚨 Errores comunes a evitar

| Error | Solución |
|-------|----------|
| Openai devuelve JSON con backticks | Ya está manejado con `.replace(/\`\`\`json|\`\`\`/g, "")` |
| `ANTHROPIC_API_KEY` no definida | Agregar al `.env.local` y reiniciar `pnpm dev` |
| `JSON.parse` falla | Hacer `console.log(raw)` antes del parse para ver qué devuelve Openai |
| La urgencia no se detecta bien | Revisar el system prompt de extracción, mencionar keywords explícitamente |
| Import de `@/types` no resuelve | Verificar `tsconfig.json` tiene `"paths": { "@/*": ["./src/*"] }` |

---

## 📬 Comunicación con el equipo

| Momento | Qué comunicar |
|---------|---------------|
| Al crear el mock | Confirmación de que empezaste y la rama existe |
| Al terminar `validate-policy.ts` | Resultados de los tests de carencia y cobertura |
| Al terminar el agente con mock | "Motor funciona end-to-end, esperando `notion.ts` de P1" |
| Cuando P1 avise que `notion.ts` está listo | Cambiar import y probar con datos reales |
| Al terminar los 3 tests de curl | Compartir los resultados con el equipo |
