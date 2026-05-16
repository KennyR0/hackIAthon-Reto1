import { z } from "zod";
import { callLLMJson, type JsonSchema } from "@/lib/llm";
import type { InsurancePolicy } from "@/types";

const insurancePolicySchema = z.object({
  policyId: z.string(),
  holderName: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  waitingPeriodDays: z.number(),
  coverages: z.array(z.string()),
  exclusions: z.string(),
  maxSurgicalCoverage: z.number(),
  plan: z.enum(["Básico", "Plus", "Premium"]),
});

const insurancePolicyJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "policyId",
    "holderName",
    "validFrom",
    "validUntil",
    "waitingPeriodDays",
    "coverages",
    "exclusions",
    "maxSurgicalCoverage",
    "plan",
  ],
  properties: {
    policyId: { type: "string" },
    holderName: { type: "string" },
    validFrom: { type: "string" },
    validUntil: { type: "string" },
    waitingPeriodDays: { type: "number" },
    coverages: { type: "array", items: { type: "string" } },
    exclusions: { type: "string" },
    maxSurgicalCoverage: { type: "number" },
    plan: { type: "string", enum: ["Básico", "Plus", "Premium"] },
  },
};

const INSURANCE_POLICY_SYSTEM_PROMPT = `
Eres un experto en pólizas de seguro de salud del mercado ecuatoriano. Conoces
en detalle los productos y formatos de todas las aseguradoras que operan en Ecuador.

ASEGURADORAS PRIVADAS RECONOCIDAS:
- Saludsa (Seguros Humana S.A.) — planes: Básico, Plus, Premium, Elite
- Ecuasanitas — planes: Básico, Familiar, Clásico, Preferente
- AIG Metropolitana — planes: Basic, Plus, Premium
- Chubb Seguros Ecuador — planes: Básico, Plus, Premium
- Liberty Seguros Ecuador — planes: Esencial, Estándar, Plus, Premium
- Panamericana del Ecuador — planes: Básico, Plus, Premium
- BMI of Americas — planes: Basic, Standard, Premium
- Seguros Sucre S.A. — planes: Básico, Plus, Premium
- Seguros Bolívar S.A. — planes: Básico, Plus, Premium
- Mapfre Ecuador — planes: Básico, Plus, Premium
- Latina Seguros — planes: Básico, Plus, Premium

IESS (Instituto Ecuatoriano de Seguridad Social):
- Seguro General de Salud Individual y Familiar
- No tiene planes diferenciados; la cobertura es universal para afiliados activos
- No tiene período de carencia para servicios de emergencia
- Período de carencia general: 0 días (cobertura desde el primer aporte)
- Tope quirúrgico: illimitado dentro de la red del IESS
- Coberturas: todos los procedimientos del cuadro básico de medicamentos y dispositivos médicos

CAMPOS A EXTRAER:
- policyId: número de póliza, número de afiliación al IESS, o número de certificado.
  Para IESS usar el número de afiliación (NNNNNNNNNN-N formato típico).
- holderName: nombre completo del titular de la póliza.
- validFrom: fecha de inicio de vigencia en formato YYYY-MM-DD.
- validUntil: fecha de fin de vigencia en formato YYYY-MM-DD.
  Para IESS, si no hay fecha de fin explícita, calcular un año desde validFrom.
- waitingPeriodDays: período de carencia en días para cirugías electivas.
  Valores típicos por aseguradora:
  * IESS: 0 (no hay carencia)
  * Saludsa/Humana Básico: 180, Plus: 90, Premium: 60
  * Ecuasanitas: 180 días para cirugías electivas
  * AIG/Chubb/Liberty: 180 días primer año, 90 segundo año en adelante
  * Si no está explícito: usar 180 como valor conservador
- coverages: lista de especialidades o tipos de procedimientos cubiertos.
  Extraer del texto o inferir según el tipo de plan.
  Especialidades comunes en Ecuador: "Cirugía General", "Cirugía Laparoscópica",
  "Ortopedia y Traumatología", "Ginecología y Obstetricia", "Neurocirugía",
  "Cirugía Cardiovascular", "Urología", "Oftalmología", "Otorrinolaringología",
  "Cirugía Plástica Reconstructiva", "Oncología Quirúrgica", "Cirugía Pediátrica",
  "Cirugía Torácica", "Trasplantes".
  Para IESS incluir todas las anteriores.
- exclusions: texto libre con las exclusiones relevantes.
  Exclusiones comunes en Ecuador:
  * Condiciones preexistentes no declaradas (primeros 2 años)
  * Cirugía estética o cosmética (salvo reconstructiva por accidente)
  * Tratamientos experimentales no aprobados por ARCSA
  * Complicaciones de procedimientos no autorizados
  * Lesiones auto-infligidas
  Si es IESS, indicar "Procedimientos no incluidos en el cuadro básico del IESS"
- maxSurgicalCoverage: monto máximo de cobertura quirúrgica en USD.
  Si es IESS: usar 999999 (cobertura ilimitada en red).
  Si no está explícito pero se puede inferir del plan: usar el valor típico.
  Si no hay información: usar 10000.
- plan: clasificar como "Básico", "Plus" o "Premium".
  Para IESS siempre usar "Premium" (cobertura universal).
  Si el plan del documento no encaja exactamente:
  * Planes básicos/esenciales/estándar → "Básico"
  * Planes intermedios/plus/clásico/preferente → "Plus"
  * Planes superiores/premium/elite/internacional → "Premium"

REGLAS ESTRICTAS:
- No inventes coberturas que no estén en el texto o que no sean estándar del plan.
- Para validFrom y validUntil: si solo hay año y mes, usar el primer/último día del mes.
- Si el documento es del IESS, aplicar siempre: waitingPeriodDays=0, maxSurgicalCoverage=999999, plan="Premium".
- Si no puedes determinar validUntil, usar la fecha de hoy más 365 días.
- policyId con hint: si se proporciona un hint y coincide parcialmente con algún número
  en el documento, preferir el del documento.
`.trim();

/**
 * Extracts the structured insurance policy used by the authorization pipeline.
 */
export async function parseInsurancePolicyPdf(
  pdfText: string,
  policyIdHint?: string,
): Promise<InsurancePolicy> {
  return callLLMJson({
    systemPrompt: INSURANCE_POLICY_SYSTEM_PROMPT,
    userMessage: [
      `Fecha actual: ${new Date().toISOString().slice(0, 10)}`,
      `Policy ID hint extraido del informe medico: ${policyIdHint?.trim() || "N/A"}`,
      "",
      `Texto de la poliza:`,
      pdfText,
    ].join("\n"),
    schemaName: "insurance_policy_pdf_extraction",
    jsonSchema: insurancePolicyJsonSchema,
    zodSchema: insurancePolicySchema,
  });
}

/*
CASO 1 - Aprobado (Programada)
Input texto informe: "Paciente: Maria Alvarez, CC: 0987654321...
  Diagnostico: Apendicitis cronica..."
Output esperado: { patientId: "0987654321", urgency: "Programada", ... }

CASO 2 - Urgente (salta carencia)
Input texto informe: "Paciente presenta apendicitis aguda perforada con peritonitis
  generalizada. Requiere laparotomia de emergencia inmediata..."
Output esperado: { urgency: "Urgente", ... }

CASO 3 - Rechazado (fuera de cobertura)
Input texto poliza IESS: "Afiliado: Luis Paredes, No. Afiliacion: 1234567890-1..."
  (poliza con Plan Basico sin Ortopedia)
*/
