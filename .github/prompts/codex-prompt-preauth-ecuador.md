# Prompt para Codex — Reestructuración del Agente de Pre-Autorización Quirúrgica
## Proyecto: HackIAthon · La Pochita Stone

---

## CONTEXTO DEL PROYECTO

Tienes un agente Next.js (App Router, TypeScript, Tailwind CSS 4, pnpm) ya funcional en
`src/` con la siguiente arquitectura:

```
src/
├── app/
│   ├── page.tsx              # UI principal (formulario manual + resultado)
│   └── api/authorize/route.ts
├── components/
│   ├── AuthForm.tsx          # Formulario manual de 6 campos
│   └── ResultCard.tsx        # Tarjeta de resultado con descarga PDF
├── lib/
│   ├── agent.ts              # Orquestador de los 4 pasos
│   ├── llm.ts                # Cliente LLM multi-proveedor (OpenAI/Cerebras/Groq/Gemini)
│   ├── notion.ts             # Cliente Notion
│   ├── pdf.ts                # Generación de PDFs descargables
│   └── steps/
│       ├── extract-clinical.ts
│       ├── normalize-codes.ts
│       ├── validate-policy.ts
│       └── generate-decision.ts
└── types/index.ts
```

El flujo actual recibe los datos **en forma manual** a través de un formulario web.
El objetivo de esta reestructuración es **reemplazar ese formulario manual** por un flujo
basado en **carga de archivos PDF** (informe médico del hospital + póliza de la aseguradora).

---

## OBJETIVO PRINCIPAL

Reestructurar el agente para que:

1. El usuario suba **dos PDFs**:
   - `informe_medico.pdf` — emitido por el hospital/clínica
   - `poliza.pdf` — emitido por la aseguradora del paciente

2. El sistema **extraiga automáticamente** los datos estructurados de cada PDF usando el LLM.

3. Esos datos se **normalicen a los tipos TypeScript existentes** (`MedicalReport`, `InsurancePolicy`).

4. El agente corra el mismo pipeline de 4 pasos (extracción clínica → normalización CIE-10/CPT →
   validación de póliza → decisión final).

5. La extracción **cumpla con las normativas ecuatorianas** de:
   - Documentos médicos hospitalarios (MSP, IESS, clínicas privadas)
   - Pólizas de aseguradoras privadas (Saludsa, Humana, Ecuasanitas, AIG, Chubb, Liberty,
     Panamericana, BMI, Seguros Sucre, Seguros Bolívar)
   - Pólizas y prestaciones del IESS (seguro de salud público)

---

## TAREA 1 — Dependencias

Instala las siguientes dependencias con pnpm:

```bash
pnpm add pdf-parse
pnpm add -D @types/pdf-parse
```

No instales Tesseract, canvas ni ninguna biblioteca de OCR nativa. La extracción de texto
de PDFs escaneados se hará mediante la API del LLM con el PDF en base64.

---

## TAREA 2 — Módulo de extracción de texto PDF

Crea `src/lib/pdf-reader.ts`.

Este módulo debe exportar:

```typescript
export async function extractPdfText(buffer: Buffer): Promise<string>
```

Lógica interna:
- Usar `pdf-parse` para extraer el texto del PDF.
- Si el texto extraído tiene **menos de 120 caracteres útiles** (sin espacios ni saltos de línea),
  asumir que el PDF es escaneado (imagen) y lanzar el error:
  `"PDF escaneado detectado. Por favor sube una versión digital del documento."`
  (No implementar OCR por ahora; es una limitación documentada.)
- Limpiar el texto resultante: colapsar múltiples espacios/saltos, eliminar caracteres de
  control y preservar la estructura de párrafos.
- Retornar el texto limpio como string.

---

## TAREA 3 — Extracción de datos del informe médico

Crea `src/lib/steps/parse-medical-report.ts`.

Este módulo exporta:

```typescript
export async function parseMedicalReportPdf(pdfText: string): Promise<MedicalReport>
```

### Prompt del sistema (incluir verbatim en el código)

```
Eres un experto en documentación médica hospitalaria del sistema de salud ecuatoriano.
Tu tarea es extraer datos estructurados de informes médicos emitidos por hospitales,
clínicas privadas o centros de salud del IESS.

FORMATOS RECONOCIDOS EN ECUADOR:
- Formulario 053 del MSP (Referencia y Contrarreferencia)
- Formulario 033 del MSP (Historia Clínica Única)
- Formulario 008 del IESS (Solicitud de Atención Especializada)
- Epicrisis hospitalaria (formato libre de clínicas privadas)
- Certificado médico con membrete institucional
- Informe preoperatorio de especialista

CAMPOS A EXTRAER:
- patientId: número de cédula ecuatoriana (10 dígitos) o número de historia clínica.
  Si encuentras ambos, preferir la cédula.
- patientName: nombre completo del paciente tal como figura en el documento.
- reportDate: fecha del informe en formato ISO 8601 (YYYY-MM-DD). Si hay varias fechas,
  usar la de emisión/firma.
- diagnosis: diagnóstico principal completo, tal como lo redactó el médico. Incluir
  diagnósticos secundarios relevantes separados por punto y coma.
- procedure: nombre completo del procedimiento quirúrgico o intervención solicitada.
  Usar la denominación técnica que usa el médico.
- urgency: clasificar como "Urgente" si el documento contiene cualquiera de estas
  palabras o conceptos: urgente, emergencia, riesgo vital, hemorragia, perforación,
  obstrucción, sepsis, peritonitis, trauma, shock, intervención inmediata, cirugía de
  emergencia, no puede esperar, riesgo de muerte.
  En cualquier otro caso, clasificar como "Programada".
- policyId: número de póliza, afiliación o carnet del seguro si figura en el documento.
  Si no figura, retornar cadena vacía "".

REGLAS ESTRICTAS:
- No inventes datos. Si un campo no está en el texto, usa "" o null según corresponda.
- Para patientId, si no hay cédula ni historia clínica clara, devuelve "SIN-ID".
- Para reportDate, si no hay fecha clara, devuelve la fecha actual en ISO 8601.
- Los nombres de pacientes en Ecuador suelen ser: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2.
  Normaliza a "Nombre1 Nombre2 Apellido1 Apellido2" si puedes identificar la estructura.
```

### Schema JSON estricto (usar con `callLLMJson`):

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["patientId", "patientName", "reportDate", "diagnosis", "procedure", "urgency", "policyId"],
  "properties": {
    "patientId":    { "type": "string" },
    "patientName":  { "type": "string" },
    "reportDate":   { "type": "string" },
    "diagnosis":    { "type": "string" },
    "procedure":    { "type": "string" },
    "urgency":      { "type": "string", "enum": ["Urgente", "Programada"] },
    "policyId":     { "type": "string" }
  }
}
```

---

## TAREA 4 — Extracción de datos de la póliza de seguro

Crea `src/lib/steps/parse-insurance-policy.ts`.

Este módulo exporta:

```typescript
export async function parseInsurancePolicyPdf(
  pdfText: string,
  policyIdHint?: string
): Promise<InsurancePolicy>
```

El parámetro `policyIdHint` es el `policyId` extraído del informe médico (puede estar vacío).
Usarlo como contexto adicional para el LLM si el PDF de la póliza tiene múltiples números.

### Prompt del sistema (incluir verbatim en el código)

```
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
```

### Schema JSON estricto:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["policyId","holderName","validFrom","validUntil","waitingPeriodDays","coverages","exclusions","maxSurgicalCoverage","plan"],
  "properties": {
    "policyId":             { "type": "string" },
    "holderName":           { "type": "string" },
    "validFrom":            { "type": "string" },
    "validUntil":           { "type": "string" },
    "waitingPeriodDays":    { "type": "number" },
    "coverages":            { "type": "array", "items": { "type": "string" } },
    "exclusions":           { "type": "string" },
    "maxSurgicalCoverage":  { "type": "number" },
    "plan":                 { "type": "string", "enum": ["Básico","Plus","Premium"] }
  }
}
```

---

## TAREA 5 — API Route para carga de PDFs

Reemplaza `src/app/api/authorize/route.ts` completamente.

El nuevo handler debe:

1. Aceptar `multipart/form-data` con dos campos:
   - `medicalReport`: archivo PDF del informe médico
   - `insurancePolicy`: archivo PDF de la póliza

2. Leer ambos archivos como `Buffer` usando `request.formData()` y `arrayBuffer()`.

3. Llamar a `extractPdfText()` para cada buffer.

4. Llamar a `parseMedicalReportPdf(reportText)`.

5. Llamar a `parseInsurancePolicyPdf(policyText, parsedReport.policyId)`.

6. Llamar a `runAuthorizationAgent(report, policy)` (sin cambios en `agent.ts`).

7. Retornar el `AuthorizationResult` como JSON con status 200.

8. Manejar errores específicos:
   - Si falta algún archivo: 400 `"Se requieren dos archivos PDF: informe médico y póliza."`
   - Si el tipo MIME no es `application/pdf`: 400 `"Solo se aceptan archivos PDF."`
   - Si pdf-parse falla: 422 `"No se pudo leer el PDF. Verifica que no esté protegido con contraseña."`
   - Si el LLM falla en la extracción: 422 `"No se pudo extraer la información del [informe/póliza]. Verifica que el documento sea legible."`
   - Errores generales: 500

9. Mantener `export const maxDuration = 30`.

10. Eliminar completamente el código anterior de `authorizationRequestSchema` y el mapeo
    manual de Notion. La póliza ahora viene del PDF, no de Notion.

NOTA IMPORTANTE: Mantener la llamada a `createAuthorizationResult()` de Notion al final
del pipeline (ya está en `agent.ts`). Notion solo se usa para registrar resultados,
no como fuente de datos de entrada.

---

## TAREA 6 — Nuevo componente de carga de archivos

Reemplaza `src/components/AuthForm.tsx` completamente con un nuevo componente.

El componente debe:

### Estado y lógica
- Manejar dos zonas de carga (drag-and-drop + click), una para cada PDF.
- Para cada zona, el estado puede ser: `idle` | `selected` | `error`.
- Validar que el archivo tenga extensión `.pdf` antes de aceptarlo.
- Mostrar el nombre del archivo seleccionado y su tamaño en KB/MB.
- Permitir quitar el archivo seleccionado para cargar otro.
- El botón "Analizar" solo se activa cuando ambos archivos están seleccionados.
- Al hacer submit, crear un `FormData` con los campos `medicalReport` e `insurancePolicy`
  y llamar a `POST /api/authorize` con ese FormData (sin `Content-Type` header manual,
  dejar que el browser lo asigne con el boundary correcto).
- Exportar el tipo `AuthFormData` como `{ medicalReport: File; insurancePolicy: File }`.

### UI de cada zona de carga
- Ícono representativo (Lucide: `FileText` para informe médico, `Shield` para póliza).
- Título descriptivo: "Informe Médico (PDF)" y "Póliza de Seguro (PDF)".
- Subtítulo con ejemplos: 
  - Informe: "Formulario MSP 053, epicrisis, informe preoperatorio"
  - Póliza: "IESS, Saludsa, Ecuasanitas, Humana, AIG, Liberty, etc."
- Área de drop con borde punteado que cambia de color al hacer hover/drag.
- Al tener archivo seleccionado: mostrar nombre, tamaño y botón X para quitar.
- Mantener la paleta de colores del proyecto: `#0E766E` como acento principal.

### Props del componente
```typescript
type AuthFormProps = {
  loading: boolean;
  onSubmit: (formData: FormData) => void;
}
```

---

## TAREA 7 — Actualizar la página principal

Modifica `src/app/page.tsx`:

1. Cambiar `handleSubmit` para recibir `FormData` en lugar de `AuthFormData` plano.

2. El fetch debe enviar el `FormData` directamente (sin `JSON.stringify`, sin header
   `Content-Type: application/json`):
   ```typescript
   const response = await fetch("/api/authorize", {
     method: "POST",
     body: formData,  // FormData directamente, sin stringify
   });
   ```

3. Actualizar el estado `submittedReport` para que sea `null` inicialmente y se llene
   con los datos que retorne la API en la respuesta. Agrega al `AuthorizationResult`
   los campos `patientName` y `patientId` en la respuesta de la API para que `ResultCard`
   pueda generar el PDF correctamente. Esto requiere modificar `AuthorizationResult` en
   `src/types/index.ts` para agregar:
   ```typescript
   patientId?: string;
   patientName?: string;
   ```
   Y modificar `agent.ts` para incluir esos campos en el resultado retornado.

4. Actualizar el texto del subtítulo del header:
   - Antes: "Analiza informes medicos y polizas en tiempo real..."
   - Después: "Sube el informe médico y la póliza en PDF para obtener una decisión
     administrativa en segundos."

5. Mantener sin cambios: `ResultCard`, `ErrorState`, `LoadingState`, `EmptyState`,
   los tres `Metric` cards, y todo el layout visual.

---

## TAREA 8 — Actualizar tipos

Modifica `src/types/index.ts`:

1. Agregar campos opcionales a `AuthorizationResult`:
   ```typescript
   patientId?: string;
   patientName?: string;
   ```

2. Agregar nuevo tipo de error de extracción:
   ```typescript
   export interface ExtractionError {
     field: "medicalReport" | "insurancePolicy";
     message: string;
   }
   ```

No cambiar ningún otro tipo existente.

---

## TAREA 9 — Actualizar agent.ts

Modifica `src/lib/agent.ts`:

Agrega `report.patientId` y `report.patientName` al objeto retornado:

```typescript
return {
  ...result,
  patientId: report.patientId,
  patientName: report.patientName,
};
```

Mantener todo lo demás sin cambios.

---

## TAREA 10 — Variables de entorno

Actualiza el archivo `.env.local` (o su documentación en README) para reflejar que
`NOTION_POLICIES_DB_ID` y `NOTION_REPORTS_DB_ID` ya **no son necesarias** para el flujo
principal. Solo se necesitan:

```env
# LLM provider (al menos uno)
OPENAI_API_KEY=
# CEREBRAS_API_KEY=
# GROQ_API_KEY=
# GEMINI_API_KEY=
LLM_PROVIDER=openai

# Notion (solo para registro de resultados)
NOTION_TOKEN=
NOTION_RESULTS_DB_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Actualiza el README para reflejar esto.

---

## TAREA 11 — Manejo de PDFs grandes

En `src/lib/pdf-reader.ts`, agregar límite de tamaño:

- Si el buffer tiene más de **10 MB**, lanzar:
  `"El archivo PDF supera el límite de 10 MB. Por favor sube una versión reducida."`

En la API route (`src/app/api/authorize/route.ts`), antes de procesar:

- Verificar que cada archivo no supere 10 MB.
- Si supera: retornar 413 con mensaje descriptivo.

---

## TAREA 12 — Pruebas manuales documentadas

Al final de `src/lib/steps/parse-medical-report.ts` y `parse-insurance-policy.ts`,
agregar un bloque de comentario (no código ejecutable) con ejemplos de texto de entrada
y salida esperada para los 3 casos de prueba del hackathon:

```typescript
/*
CASO 1 — Aprobado (Programada)
Input texto informe: "Paciente: Maria Alvarez, CC: 0987654321...
  Diagnóstico: Apendicitis crónica..."
Output esperado: { patientId: "0987654321", urgency: "Programada", ... }

CASO 2 — Urgente (salta carencia)
Input texto informe: "Paciente presenta apendicitis aguda perforada con peritonitis
  generalizada. Requiere laparotomía de emergencia inmediata..."
Output esperado: { urgency: "Urgente", ... }

CASO 3 — Rechazado (fuera de cobertura)
Input texto poliza IESS: "Afiliado: Luis Paredes, No. Afiliación: 1234567890-1..."
  (póliza con Plan Básico sin Ortopedia)
*/
```

---

## RESTRICCIONES GENERALES

1. **No cambiar** `src/lib/llm.ts` — el cliente LLM existente ya es correcto.
2. **No cambiar** `src/lib/steps/extract-clinical.ts`, `normalize-codes.ts`,
   `validate-policy.ts`, `generate-decision.ts` — el pipeline de 4 pasos no cambia.
3. **No cambiar** `src/components/ResultCard.tsx` ni `src/lib/pdf.ts` — la generación
   de PDFs descargables no cambia.
4. **No cambiar** `src/lib/notion.ts` — solo se usa para guardar resultados.
5. **No usar** `any` en TypeScript. Usar tipos explícitos en todo momento.
6. **No usar** `eslint-disable` salvo que sea absolutamente necesario con comentario explicativo.
7. **Usar** el cliente LLM existente `callLLMJson` de `src/lib/llm.ts` para todas las
   llamadas al modelo.
8. Todo el código nuevo debe pasar `pnpm build` sin errores de TypeScript.
9. Mantener los comentarios JSDoc en funciones públicas exportadas.
10. El proyecto usa Next.js App Router con `"use client"` explícito en componentes cliente.
    Las API routes son Server Components por defecto.

---

## ORDEN DE EJECUCIÓN RECOMENDADO

1. Instalar dependencias (Tarea 1)
2. Crear `src/lib/pdf-reader.ts` (Tarea 2)
3. Crear `src/lib/steps/parse-medical-report.ts` (Tarea 3)
4. Crear `src/lib/steps/parse-insurance-policy.ts` (Tarea 4)
5. Modificar `src/types/index.ts` (Tarea 8)
6. Modificar `src/lib/agent.ts` (Tarea 9)
7. Reemplazar `src/app/api/authorize/route.ts` (Tarea 5)
8. Reemplazar `src/components/AuthForm.tsx` (Tarea 6)
9. Modificar `src/app/page.tsx` (Tarea 7)
10. Actualizar variables de entorno y README (Tarea 10)
11. Ejecutar `pnpm build` y corregir errores

---

## CRITERIO DE ÉXITO

El proyecto está correctamente reestructurado cuando:

- `pnpm build` termina sin errores de TypeScript ni ESLint.
- La UI muestra dos zonas de carga de PDF en lugar del formulario manual.
- Subir un PDF de informe médico y uno de póliza produce una decisión en < 30 segundos.
- Los 3 casos de prueba del hackathon producen las decisiones correctas
  (Aprobado / Urgente-Aprobado / Rechazado).
- El resultado se registra en la base de datos de Notion de resultados.
- Los botones de descarga PDF siguen funcionando correctamente.
