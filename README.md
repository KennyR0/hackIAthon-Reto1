# Agente de Pre-Autorizacion Quirurgica

Interfaz web y agente inteligente para automatizar la pre-autorizacion de
cirugias. El sistema analiza un informe medico y una poliza cargados en PDF,
valida la cobertura y emite una decision administrativa en tiempo real.

## Entregables HackIAthon

**Agente funcional Web UI:**  
Pendiente: agrega aqui la URL publica de Vercel.

**Repositorio de codigo:**  
Pendiente: agrega aqui la URL del repositorio GitHub o GitLab.

## Funcionalidades

- Carga de dos PDFs: informe medico hospitalario y poliza de seguro.
- Endpoint real `POST /api/authorize` conectado al motor de decision.
- Extraccion estructurada de datos desde PDFs mediante LLM.
- Validacion de poliza desde la informacion extraida del PDF.
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
- pdf-parse
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
OPENAI_API_KEY=
LLM_PROVIDER=openai

NOTION_TOKEN=
NOTION_RESULTS_DB_ID=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Variables opcionales:

```bash
LLM_FALLBACK_PROVIDER=
OPENAI_MODEL=
CEREBRAS_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

`NOTION_POLICIES_DB_ID` y `NOTION_REPORTS_DB_ID` ya no son necesarios para el
flujo principal. Notion se usa solo para registrar resultados finales.

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
Informe PDF: Maria Alvarez, CC 0987654321, apendicitis cronica,
apendicectomia laparoscopica electiva, urgencia programada.
Poliza PDF: plan con Cirugia General cubierta, vigencia activa y carencia cumplida.
```

Resultado esperado: tarjeta verde y descarga de PDF de preaprobacion.

### Revision

```text
Informe PDF: apendicitis aguda perforada con peritonitis generalizada,
requiere laparotomia de emergencia inmediata.
Poliza PDF: vigencia activa con carencia para cirugias electivas.
```

Resultado esperado: tarjeta de revision y descarga de PDF de documentos
faltantes si el agente solicita respaldos.

### Rechazado

```text
Informe PDF: lesion ligamentaria de rodilla, reconstruccion artroscopica.
Poliza PDF: plan basico sin cobertura de Ortopedia y Traumatologia.
```

Resultado esperado: tarjeta roja con justificacion administrativa.
