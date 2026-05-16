# Agente de Pre-Autorizacion Quirurgica

Interfaz web y agente inteligente para automatizar la pre-autorizacion de
cirugias. El sistema analiza un caso medico, valida la poliza asociada y emite
una decision administrativa en tiempo real.

## Entregables HackIAthon

**Agente funcional Web UI:**  
Pendiente: agrega aqui la URL publica de Vercel.

**Repositorio de codigo:**  
Pendiente: agrega aqui la URL del repositorio GitHub o GitLab.

## Funcionalidades

- Formulario clinico para registrar paciente, poliza, diagnostico,
  procedimiento y urgencia.
- Endpoint real `POST /api/authorize` conectado al motor de decision.
- Validacion de poliza desde Notion.
- Normalizacion medica con proveedor LLM configurable.
- Resultado visual para estados `Aprobado`, `Revision` y `Rechazado`.
- Descarga directa de PDF de preaprobacion para casos aprobados.
- Descarga directa de PDF de documentos faltantes cuando el caso requiere
  informacion adicional.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Notion API
- LLM provider configurable
- pdf-lib
- lucide-react

## Ejecutar localmente

```bash
pnpm install
pnpm dev
```

La app queda disponible en:

```text
http://localhost:3000
```

## Variables de entorno

Crea un archivo `.env.local` en la raiz del proyecto:

```bash
NOTION_TOKEN=
NOTION_POLICIES_DB_ID=
NOTION_RESULTS_DB_ID=
OPENAI_API_KEY=
```

Variables opcionales:

```bash
LLM_PROVIDER=openai
LLM_FALLBACK_PROVIDER=
OPENAI_MODEL=
CEREBRAS_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

## Despliegue en Vercel

Configuracion recomendada:

- Framework Preset: Next.js
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Root Directory: raiz del repositorio

Agrega en Vercel las mismas variables de entorno usadas localmente. El endpoint
`src/app/api/authorize/route.ts` exporta `maxDuration = 30` para permitir que
la funcion complete llamadas a Notion y al proveedor LLM.

## Casos de prueba sugeridos

### Aprobado

```text
ID Paciente: 0987654321
Nombre: Maria Alvarez
ID Poliza: POL-2024-001
Diagnostico: Apendicitis cronica con dolor recurrente en fosa iliaca derecha
Procedimiento: Apendicectomia laparoscopica electiva
Urgencia: Programada
```

Resultado esperado: tarjeta verde y descarga de PDF de preaprobacion.

### Revision

```text
ID Paciente: 2233445566
Nombre: Carlos Mendoza
ID Poliza: POL-2024-002
Diagnostico: Dolor persistente de rodilla con sospecha de lesion ligamentaria
Procedimiento: Reconstruccion artroscopica de ligamento cruzado anterior
Urgencia: Programada
```

Resultado esperado: tarjeta de revision y descarga de PDF de documentos
faltantes si el agente solicita respaldos.

### Rechazado

```text
ID Paciente: 5566778899
Nombre: Ana Torres
ID Poliza: POL-2024-003
Diagnostico: Ruptura de ligamento cruzado anterior de rodilla derecha
Procedimiento: Reconstruccion artroscopica de ligamento cruzado anterior
Urgencia: Programada
```

Resultado esperado: tarjeta roja con justificacion administrativa.
