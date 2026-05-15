# 👤 Persona 1 — Fundación y Base de Datos
## HackIAthon · Agente de Pre-Autorización Quirúrgica

> **Rama Git:** `feat/foundation`  
> **Duración estimada:** 1–2 días  
> **Dependencia de otros:** ❌ Ninguna — eres el punto de partida del equipo

---

## 🎯 Tu misión

Eres la base del proyecto. Sin tu trabajo, nadie puede empezar. Tu prioridad número uno es **inicializar el repositorio y publicar `src/types/index.ts` en los primeros 30 minutos**, porque ese archivo desbloquea a Persona 2 y Persona 3. El resto del tiempo lo dedicas a configurar las bases de datos de Notion y el cliente que las conecta.

---

## ✅ Checklist completo

### Día 0 — Init del proyecto (30 min)
- [ ] Instalar pnpm 11.0.0: `npm install -g pnpm@11.0.0`
- [ ] Crear el proyecto Next.js con pnpm
- [ ] Instalar dependencias clave
- [ ] Crear `src/types/index.ts` con los 3 interfaces
- [ ] Crear repositorio en GitHub/GitLab (público)
- [ ] Hacer push del primer commit
- [ ] Compartir la URL del repo con Persona 2 y Persona 3

### Día 1 AM — Bases de datos en Notion
- [ ] Crear integración en notion.so/my-integrations
- [ ] Crear base de datos `Informes Médicos` con 9 propiedades
- [ ] Crear base de datos `Pólizas de Seguro` con 9 propiedades
- [ ] Crear base de datos `Resultados de Autorización` con 10 propiedades
- [ ] Conectar las 3 bases a la integración de Notion
- [ ] Copiar los 3 IDs de las bases de datos

### Día 1 PM — Cliente Notion y datos de prueba
- [ ] Crear `.env.local` con token y los 3 IDs de bases
- [ ] Implementar `src/lib/notion.ts` con las 3 funciones
- [ ] Cargar los 3 registros de póliza de prueba en Notion
- [ ] Probar lectura: `getPolicyById("POL-2024-001")` retorna datos
- [ ] Probar escritura: `createAuthorizationResult(...)` crea un registro
- [ ] Commit: `feat: notion client and databases`
- [ ] **Avisar a Persona 2** que ya puede cambiar el mock por la implementación real

### Día 2 — Variables, QA y soporte de merge
- [ ] Compartir las 5 variables de entorno con Persona 3 para Vercel
- [ ] Verificar que los nombres de propiedades en Notion coinciden exactamente con el código
- [ ] Ejecutar `pnpm build` y verificar que no hay errores de TypeScript
- [ ] Mergear `feat/foundation` → `main` (primero del equipo)
- [ ] Apoyar el merge si hay conflictos en `notion.ts`
- [ ] Confirmar que los datos de prueba están correctos para el test E2E

---

## 🔧 Paso 1 — Init del proyecto

```bash
# Verificar pnpm
pnpm --version   # debe mostrar 11.0.0

# Crear proyecto
pnpm dlx create-next-app@latest hackiathon-preauth \
  --typescript --tailwind --eslint --app --src-dir
cd hackiathon-preauth

# Instalar dependencias - 
pnpm add @notionhq/client zod
pnpm add -D @types/node

```

---

## 🔧 Paso 2 — Tipos compartidos (crear antes de todo lo demás)

Crear `src/types/index.ts` con este contenido exacto. **Este archivo es el contrato entre los 3 módulos.**

```typescript
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
```

```bash
git add src/types/index.ts
git commit -m "feat: shared TypeScript contracts"
git push
```

> ⚠️ Este push desbloquea a Persona 2 y Persona 3. Avísales cuando esté listo.

---

## 🔧 Paso 3 — Bases de datos en Notion

### Crear la integración

1. Ir a [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Hacer clic en **New integration**
3. Nombre: `HackIAthon PreAuth`
4. Copiar el **Internal Integration Token** → va a `NOTION_TOKEN` en `.env.local`

### Base de datos: `Informes Médicos`

| Propiedad | Tipo | Notas |
|-----------|------|-------|
| `Nombre Paciente` | Title | Identificación del paciente |
| `ID Paciente` | Text | Cédula / historia clínica |
| `Fecha Informe` | Date | Fecha del informe |
| `Diagnóstico` | Text | Texto libre del médico |
| `Procedimiento` | Text | Cirugía solicitada |
| `Urgencia` | Select | Opciones: `Urgente`, `Programada` |
| `PDF Informe` | Files & media | Documento adjunto |
| `Estado` | Select | Opciones: `Pendiente`, `En proceso`, `Procesado` |
| `ID Póliza` | Text | Referencia cruzada con pólizas |

### Base de datos: `Pólizas de Seguro`

| Propiedad | Tipo | Notas |
|-----------|------|-------|
| `ID Póliza` | Title | Número único de póliza |
| `Titular` | Text | Nombre del asegurado |
| `Vigencia Desde` | Date | Inicio de cobertura |
| `Vigencia Hasta` | Date | Fin de cobertura |
| `Periodo Carencia` | Number | Días (ej: 180) |
| `Coberturas` | Multi-select | Ej: Ortopedia, Cirugía General |
| `Exclusiones` | Text | Condiciones excluidas |
| `Tope Quirúrgico` | Number | Monto máximo en USD |
| `Plan` | Select | Opciones: `Básico`, `Plus`, `Premium` |

### Base de datos: `Resultados de Autorización`

| Propiedad | Tipo | Notas |
|-----------|------|-------|
| `Caso` | Title | ID generado automáticamente |
| `ID Paciente` | Text | Referencia al paciente |
| `ID Póliza` | Text | Referencia a la póliza |
| `Decisión` | Select | Opciones: `Aprobado`, `Revisión`, `Rechazado` |
| `Código CIE-10` | Text | Diagnóstico normalizado |
| `Código CPT/CUPS` | Text | Procedimiento normalizado |
| `Justificación` | Text | Explicación de la decisión |
| `Documentos Faltantes` | Text | Lista separada por comas |
| `Fecha Decisión` | Date | Timestamp de la respuesta |
| `Urgente` | Checkbox | Flag de emergencia |

> ⚠️ Los nombres de propiedades deben ser **exactamente iguales** a los de esta tabla, incluyendo tildes y mayúsculas/minúsculas.

### Conectar bases a la integración

Por cada base de datos:
1. Abrir la base → clic en los `...` (tres puntos) en la esquina superior derecha
2. **Connections → Add connections → HackIAthon PreAuth**

### Obtener los IDs de las bases

La URL de cada base tiene este formato:
```
https://www.notion.so/NOMBRE-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
```
El ID es la parte `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (32 caracteres sin guiones).

---

## 🔧 Paso 4 — Variables de entorno (`.env.local`)

```env
# Notion
NOTION_TOKEN=secret_xxxxxxxxxxxx
NOTION_REPORTS_DB_ID=xxxxxxxxxxxx
NOTION_POLICIES_DB_ID=xxxxxxxxxxxx
NOTION_RESULTS_DB_ID=xxxxxxxxxxxx

# Anthropic (recibir de Persona 2 o del equipo)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
echo ".env.local" >> .gitignore
```

---

## 🔧 Paso 5 — Cliente Notion (`src/lib/notion.ts`)

```typescript
import { Client } from "@notionhq/client";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/** Obtiene un informe médico por ID de página Notion */
export async function getMedicalReport(pageId: string) {
  return notion.pages.retrieve({ page_id: pageId });
}

/** Obtiene la póliza por su ID (busca en la base de pólizas) */
export async function getPolicyById(policyId: string) {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_POLICIES_DB_ID!,
    filter: {
      property: "ID Póliza",
      title: { equals: policyId },
    },
  });
  return response.results[0] ?? null;
}

/** Crea un registro de resultado en la base de Resultados */
export async function createAuthorizationResult(data: {
  patientId: string;
  policyId: string;
  decision: "Aprobado" | "Revisión" | "Rechazado";
  cie10: string;
  cpt: string;
  justification: string;
  missingDocs?: string;
  isUrgent: boolean;
}) {
  return notion.pages.create({
    parent: { database_id: process.env.NOTION_RESULTS_DB_ID! },
    properties: {
      Caso: { title: [{ text: { content: `CASO-${Date.now()}` } }] },
      "ID Paciente": { rich_text: [{ text: { content: data.patientId } }] },
      "ID Póliza": { rich_text: [{ text: { content: data.policyId } }] },
      Decisión: { select: { name: data.decision } },
      "Código CIE-10": { rich_text: [{ text: { content: data.cie10 } }] },
      "Código CPT/CUPS": { rich_text: [{ text: { content: data.cpt } }] },
      Justificación: { rich_text: [{ text: { content: data.justification } }] },
      "Documentos Faltantes": {
        rich_text: [{ text: { content: data.missingDocs ?? "" } }],
      },
      "Fecha Decisión": { date: { start: new Date().toISOString() } },
      Urgente: { checkbox: data.isUrgent },
    },
  });
}
```

---

## 🔧 Paso 6 — Datos de prueba en Notion

Cargar manualmente estos 3 registros en la base **Pólizas de Seguro**:

### Póliza 1 — POL-2024-001 (Aprobación esperada)
```
ID Póliza:       POL-2024-001
Titular:         Carlos Mendoza
Vigencia Desde:  2024-01-01
Vigencia Hasta:  2025-12-31
Periodo Carencia: 90
Coberturas:      Cirugía General
Exclusiones:     (dejar vacío)
Tope Quirúrgico: 10000
Plan:            Plus
```

### Póliza 2 — POL-2024-002 (Urgente, salta carencia)
```
ID Póliza:       POL-2024-002
Titular:         Ana Torres
Vigencia Desde:  2024-11-01   ← reciente, carencia no cumplida
Vigencia Hasta:  2025-12-31
Periodo Carencia: 180
Coberturas:      Cirugía General
Exclusiones:     (dejar vacío)
Tope Quirúrgico: 20000
Plan:            Premium
```

### Póliza 3 — POL-2024-003 (Rechazo esperado)
```
ID Póliza:       POL-2024-003
Titular:         Luis Paredes
Vigencia Desde:  2024-01-01
Vigencia Hasta:  2025-12-31
Periodo Carencia: 90
Coberturas:      Medicina General
Exclusiones:     Ortopedia
Tope Quirúrgico: 5000
Plan:            Básico
```

---

## 🔧 Paso 7 — Verificación manual

```typescript
// Puedes probar esto en un script temporal o en un test manual
// src/scripts/test-notion.ts

import { getPolicyById, createAuthorizationResult } from "../lib/notion";

async function test() {
  // Probar lectura
  const policy = await getPolicyById("POL-2024-001");
  console.log("Póliza encontrada:", policy ? "✅" : "❌");

  // Probar escritura
  await createAuthorizationResult({
    patientId: "TEST-001",
    policyId: "POL-2024-001",
    decision: "Aprobado",
    cie10: "K35.8",
    cpt: "44950",
    justification: "Test de integración con Notion",
    isUrgent: false,
  });
  console.log("Resultado guardado: ✅");
}

test().catch(console.error);
```

```bash
# Ejecutar el test
pnpm tsx src/scripts/test-notion.ts
```

---

## 📁 Estructura de archivos que debes crear

```
hackiathon-preauth/
├── .env.local                    ← tus variables (NO commitear)
├── .gitignore                    ← incluir .env.local
├── vercel.json                   ← lo crea Persona 3
├── pnpm-lock.yaml               ← generado automáticamente
├── src/
│   ├── types/
│   │   └── index.ts             ← TU RESPONSABILIDAD PRINCIPAL
│   ├── lib/
│   │   └── notion.ts            ← TU RESPONSABILIDAD
│   └── constants/
│       └── medical-codes.ts     ← referencia opcional
```

---

## 🚨 Errores comunes a evitar

| Error | Solución |
|-------|----------|
| Nombre de propiedad Notion con typo | Copiar exactamente de la tabla, tildes incluidas |
| Base de datos no conectada a la integración | Ir a la DB → `...` → Connections → agregar la integración |
| ID de base de datos incorrecto | Tomar solo los 32 caracteres hexadecimales de la URL |
| `pnpm` no encontrado | `npm install -g pnpm@11.0.0` |
| Error de TypeScript en `notion.ts` | Verificar que `@notionhq/client` está instalado con `pnpm add` |

---

## 📬 Comunicación con el equipo

| Momento | Qué comunicar |
|---------|---------------|
| Al hacer el primer push | URL del repositorio para que clonen |
| Al commitear `types/index.ts` | "Tipos listos, pueden clonar y empezar" |
| Al terminar `notion.ts` | "Notion listo, Persona 2 puede cambiar el mock" |
| Al cargar datos de prueba | Los 3 IDs de póliza exactos para los tests |
| Al mergear | "Foundation mergeada, Persona 2 puede mergear" |
