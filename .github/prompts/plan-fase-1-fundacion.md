# 🏗️ Plan de Implementación — Fase 1: Fundación y Arquitectura de Datos

> **Duración estimada:** 1–2 días  
> **Objetivo:** Tener el proyecto inicializado, la base de datos en Notion configurada y la comunicación básica con la API funcionando.

---

## 1. Configuración del Proyecto

### 1.1 Inicializar repositorio Next.js

```bash
npx create-next-app@latest hackiathon-preauth \
  --typescript --tailwind --eslint --app --src-dir
cd hackiathon-preauth
```

### 1.2 Instalar dependencias clave

```bash
npm install @notionhq/client axios zod dotenv
npm install -D @types/node
```

### 1.3 Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx                  # UI principal
│   └── api/
│       ├── authorize/route.ts    # Endpoint central del agente
│       └── notion/route.ts       # Webhook / polling desde Notion
├── lib/
│   ├── notion.ts                 # Cliente Notion configurado
│   ├── claude.ts                 # Cliente Anthropic API
│   └── validators.ts             # Schemas Zod para entradas
├── types/
│   └── index.ts                  # Tipos TypeScript del dominio
└── constants/
    └── medical-codes.ts          # CIE-10 / CPT / CUPS de referencia
```

### 1.4 Variables de entorno

Crear `.env.local`:

```env
# Notion
NOTION_TOKEN=secret_xxxxxxxxxxxx
NOTION_REPORTS_DB_ID=xxxxxxxxxxxx    # Base de informes médicos
NOTION_POLICIES_DB_ID=xxxxxxxxxxxx   # Base de pólizas de seguro
NOTION_RESULTS_DB_ID=xxxxxxxxxxxx    # Base de resultados/autorizaciones

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_SECRET=un_secreto_seguro
```

---

## 2. Diseño de la Base de Datos en Notion

### 2.1 Base de Datos: `Informes Médicos` (Hospital)

| Propiedad           | Tipo         | Descripción                              |
|---------------------|--------------|------------------------------------------|
| `Nombre Paciente`   | Title        | Identificación del paciente              |
| `ID Paciente`       | Text         | Cédula / número de historia              |
| `Fecha Informe`     | Date         | Fecha del informe médico                 |
| `Diagnóstico`       | Text         | Texto libre del médico tratante          |
| `Procedimiento`     | Text         | Nombre de la cirugía solicitada          |
| `Urgencia`          | Select       | `Urgente` / `Programada`                 |
| `PDF Informe`       | Files        | Documento adjunto del informe            |
| `Estado`            | Select       | `Pendiente` / `En proceso` / `Procesado` |
| `ID Póliza`         | Text         | Referencia cruzada con la póliza         |

### 2.2 Base de Datos: `Pólizas de Seguro` (Aseguradora)

| Propiedad             | Tipo     | Descripción                              |
|-----------------------|----------|------------------------------------------|
| `ID Póliza`           | Title    | Número único de póliza                   |
| `Titular`             | Text     | Nombre del asegurado                     |
| `Vigencia Desde`      | Date     | Inicio de cobertura                      |
| `Vigencia Hasta`      | Date     | Fin de cobertura                         |
| `Periodo Carencia`    | Number   | Días de carencia (ej: 180)               |
| `Coberturas`          | Multi-select | Categorías cubiertas (ej: Ortopedia) |
| `Exclusiones`         | Text     | Condiciones preexistentes o exclusiones  |
| `Tope Quirúrgico`     | Number   | Monto máximo cubierto (USD)              |
| `Plan`                | Select   | `Básico` / `Plus` / `Premium`            |

### 2.3 Base de Datos: `Resultados de Autorización`

| Propiedad            | Tipo     | Descripción                              |
|----------------------|----------|------------------------------------------|
| `Caso`               | Title    | ID único generado automáticamente        |
| `ID Paciente`        | Text     | Referencia al paciente                   |
| `ID Póliza`          | Text     | Referencia a la póliza                   |
| `Decisión`           | Select   | `Aprobado` / `Revisión` / `Rechazado`    |
| `Código CIE-10`      | Text     | Diagnóstico normalizado                  |
| `Código CPT/CUPS`    | Text     | Procedimiento normalizado                |
| `Justificación`      | Text     | Explicación de la decisión del agente    |
| `Documentos Faltantes` | Text   | Lista si aplica revisión                 |
| `Fecha Decisión`     | Date     | Timestamp de la respuesta                |
| `Urgente`            | Checkbox | Flag para casos de emergencia            |

---

## 3. Cliente Notion (`src/lib/notion.ts`)

```typescript
import { Client } from "@notionhq/client";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

/** Obtiene un informe médico por ID de página Notion */
export async function getMedicalReport(pageId: string) {
  return notion.pages.retrieve({ page_id: pageId });
}

/** Obtiene la póliza asociada a un paciente */
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

/** Crea un registro de resultado en Notion */
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

## 4. Tipos TypeScript (`src/types/index.ts`)

```typescript
export interface MedicalReport {
  patientId: string;
  patientName: string;
  reportDate: string;
  diagnosis: string;        // Texto libre del médico
  procedure: string;        // Cirugía solicitada
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

---

## 5. Checklist de Cierre — Fase 1

- [ ] Repositorio en GitHub/GitLab creado y con `.gitignore` correcto
- [ ] Proyecto Next.js corriendo en `localhost:3000`
- [ ] Las 3 bases de datos en Notion creadas con propiedades correctas
- [ ] Variables de entorno configuradas y funcionando
- [ ] `notion.ts` puede leer y escribir en las 3 DBs (test manual)
- [ ] Tipos TypeScript definidos y sin errores de compilación

---

> ➡️ **Siguiente fase:** [Plan Fase 2 — Motor de Decisión con IA](./plan-fase-2-motor-ia.md)
