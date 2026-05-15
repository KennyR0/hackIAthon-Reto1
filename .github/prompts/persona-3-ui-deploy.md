# 👤 Persona 3 — UI Web y Despliegue
## HackIAthon · Agente de Pre-Autorización Quirúrgica

> **Rama Git:** `feat/ui-deploy`  
> **Duración estimada:** 1–2 días  
> **Dependencia de otros:** Necesitas `src/types/index.ts` de Persona 1 (disponible el día 0, ~30 min después de que arranquen)

---

## 🎯 Tu misión

Construir la interfaz web del agente y desplegarlo en Vercel. Trabajas con un **endpoint mock** desde el principio para no depender de que Persona 2 termine el motor de IA. Tu entrega es el enlace público que se envía en el correo al HackIAthon.

---

## ✅ Checklist completo

### Día 0 — Setup independiente
- [ ] Clonar el repo cuando Persona 1 haga el primer push
- [ ] Crear la rama: `git checkout -b feat/ui-deploy`
- [ ] Crear `src/app/api/authorize/mock/route.ts` con respuesta simulada
- [ ] Verificar que los tipos del mock coinciden con `AuthorizationResult` de `types/index.ts`
- [ ] Confirmar que `pnpm dev` corre sin errores

### Día 1 AM — Componente AuthForm
- [ ] Crear `src/components/AuthForm.tsx` con los 5 campos
- [ ] Implementar el toggle de urgencia (Urgente / Programada) con colores
- [ ] Deshabilitar el botón "Analizar" si algún campo obligatorio está vacío
- [ ] Probar que el formulario llama a `onSubmit` con los datos correctos
- [ ] Verificar responsividad en pantalla < 768px

### Día 1 PM — ResultCard y página principal
- [ ] Crear `src/components/ResultCard.tsx` con los 3 estados visuales
- [ ] Mostrar: decisión, CIE-10, CPT, justificación, documentos faltantes, tiempo
- [ ] Crear `src/app/page.tsx` con el layout de 2 columnas
- [ ] Conectar formulario → spinner → resultado usando el endpoint mock
- [ ] Probar el flujo completo: llenar form → ver spinner → ver resultado

### Día 2 — Vercel y entregables finales
- [ ] Crear `vercel.json` con `maxDuration: 30`
- [ ] Ejecutar `pnpm build` sin errores de TypeScript
- [ ] Desplegar en Vercel con las variables de entorno de Persona 1
- [ ] En Settings → General → Install Command: `pnpm install`
- [ ] Cambiar URL de `/api/authorize/mock` → `/api/authorize` antes del merge final
- [ ] Eliminar o desactivar el endpoint mock
- [ ] Mergear `feat/ui-deploy` → `main` después de que Persona 2 haya mergeado
- [ ] Actualizar `README.md` con el enlace de Vercel y el repositorio
- [ ] Enviar correo a **hackiathon@viamatica.com**

---

## 🔧 Paso 0 — Mock del endpoint (para trabajar sin depender de Persona 2)

Crea este archivo antes de empezar cualquier otra cosa. Simula la respuesta del agente con un delay realista.

```typescript
// src/app/api/authorize/mock/route.ts

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationResult } from "@/types";

export async function POST(_req: NextRequest) {
  // Simula latencia real del agente (1.5 segundos)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const mock: AuthorizationResult = {
    decision: "Aprobado",
    cie10Code: "K35.8",
    cptCode: "44950",
    justification:
      "El procedimiento de apendicectomía laparoscópica está cubierto bajo el plan Plus. " +
      "La póliza se encuentra vigente y el período de carencia de 90 días ha sido superado. " +
      "El costo estimado del procedimiento está dentro del tope quirúrgico establecido.",
    missingDocuments: [],
    isUrgent: false,
    processingTimeMs: 1487,
  };

  return NextResponse.json(mock);
}
```

Para ver los 3 estados distintos durante el desarrollo, puedes crear variantes:

```typescript
// Cambia el mock según lo que necesites probar:

// Estado "Revisión"
const mockRevision: AuthorizationResult = {
  decision: "Revisión",
  cie10Code: "M23.6",
  cptCode: "29888",
  justification: "El procedimiento requiere documentación adicional para confirmar la cobertura.",
  missingDocuments: ["Resonancia magnética de rodilla", "Informe del médico ortopedista"],
  isUrgent: false,
  processingTimeMs: 2103,
};

// Estado "Rechazado"
const mockRechazado: AuthorizationResult = {
  decision: "Rechazado",
  cie10Code: "M23.6",
  cptCode: "29888",
  justification: "La especialidad de Ortopedia no está incluida en las coberturas del plan Básico del asegurado.",
  missingDocuments: [],
  isUrgent: false,
  processingTimeMs: 1823,
};
```

> Cuando Persona 2 avise que la API está lista, cambias la URL en `page.tsx`  
> de `/api/authorize/mock` a `/api/authorize` y listo.

---

## 🔧 Paso 1 — Página principal (`src/app/page.tsx`)

```tsx
"use client";

import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import ResultCard from "@/components/ResultCard";
import { AuthorizationResult } from "@/types";

// Durante desarrollo usa el mock; en producción usa el endpoint real
const API_URL =
  process.env.NODE_ENV === "development"
    ? "/api/authorize/mock"
    : "/api/authorize";

export default function HomePage() {
  const [result, setResult] = useState<AuthorizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: {
    patientId: string;
    policyId: string;
    diagnosis: string;
    procedure: string;
    urgency: "Urgente" | "Programada";
  }) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            patientId: formData.patientId,
            patientName: "",
            reportDate: new Date().toISOString(),
            diagnosis: formData.diagnosis,
            procedure: formData.procedure,
            urgency: formData.urgency,
            policyId: formData.policyId,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Error desconocido del servidor");
      }

      const data: AuthorizationResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="max-w-4xl mx-auto mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">
          🏥 Agente de Pre-Autorización Quirúrgica
        </h1>
        <p className="text-slate-500 mt-2">
          Aprobaciones médicas en segundos, no en días.
        </p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <AuthForm onSubmit={handleSubmit} loading={loading} />

        <div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
              ⚠️ {error}
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p>Analizando informe médico y póliza...</p>
            </div>
          )}
          {result && !loading && <ResultCard result={result} />}
        </div>
      </div>
    </main>
  );
}
```

---

## 🔧 Paso 2 — Formulario (`src/components/AuthForm.tsx`)

```tsx
"use client";

import { useState } from "react";

interface AuthFormProps {
  onSubmit: (data: {
    patientId: string;
    policyId: string;
    diagnosis: string;
    procedure: string;
    urgency: "Urgente" | "Programada";
  }) => void;
  loading: boolean;
}

export default function AuthForm({ onSubmit, loading }: AuthFormProps) {
  const [patientId, setPatientId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedure, setProcedure] = useState("");
  const [urgency, setUrgency] = useState<"Urgente" | "Programada">("Programada");

  const isReady = patientId && policyId && diagnosis && procedure;

  function handleSubmit() {
    if (!isReady) return;
    onSubmit({ patientId, policyId, diagnosis, procedure, urgency });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-700">📋 Datos del Caso</h2>

      <div className="space-y-3">
        <Field
          label="ID Paciente"
          value={patientId}
          onChange={setPatientId}
          placeholder="Ej: 1700123456"
        />
        <Field
          label="ID Póliza"
          value={policyId}
          onChange={setPolicyId}
          placeholder="Ej: POL-2024-001"
        />
        <Textarea
          label="Diagnóstico Médico"
          value={diagnosis}
          onChange={setDiagnosis}
          placeholder="Describa el diagnóstico clínico del paciente..."
        />
        <Textarea
          label="Procedimiento Solicitado"
          value={procedure}
          onChange={setProcedure}
          placeholder="Nombre de la cirugía o intervención solicitada..."
        />

        {/* Toggle de urgencia */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Tipo de caso</span>
          <button
            onClick={() =>
              setUrgency(urgency === "Urgente" ? "Programada" : "Urgente")
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              urgency === "Urgente"
                ? "bg-red-100 text-red-700 border border-red-300"
                : "bg-green-100 text-green-700 border border-green-300"
            }`}
          >
            {urgency === "Urgente" ? "🚑 Urgente" : "📅 Programada"}
          </button>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !isReady}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300
                   text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? "Analizando..." : "Analizar y Autorizar →"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
      />
    </div>
  );
}
```

---

## 🔧 Paso 3 — Tarjeta de resultado (`src/components/ResultCard.tsx`)

```tsx
import { AuthorizationResult } from "@/types";

const DECISION_CONFIG = {
  Aprobado: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    icon: "✅",
  },
  Revisión: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: "🔍",
  },
  Rechazado: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: "❌",
  },
};

export default function ResultCard({ result }: { result: AuthorizationResult }) {
  const cfg = DECISION_CONFIG[result.decision];

  return (
    <div className={`rounded-2xl border-2 p-6 space-y-4 ${cfg.bg} ${cfg.border}`}>
      {/* Encabezado de decisión */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{cfg.icon}</span>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>
            Decisión
          </span>
          <h2 className={`text-2xl font-bold ${cfg.text}`}>{result.decision}</h2>
        </div>
        {result.isUrgent && (
          <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            🚑 URGENTE
          </span>
        )}
      </div>

      {/* Códigos médicos */}
      <div className="grid grid-cols-2 gap-3">
        <CodeBadge label="CIE-10" value={result.cie10Code} />
        <CodeBadge label="CPT" value={result.cptCode} />
      </div>

      {/* Justificación */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
          Justificación
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          {result.justification}
        </p>
      </div>

      {/* Documentos faltantes (solo en revisión) */}
      {result.missingDocuments && result.missingDocuments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
            Documentos Requeridos
          </p>
          <ul className="space-y-1">
            {result.missingDocuments.map((doc, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tiempo de procesamiento */}
      <p className="text-xs text-slate-400 text-right">
        ⏱ Procesado en {(result.processingTimeMs / 1000).toFixed(1)}s
      </p>
    </div>
  );
}

function CodeBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/60 rounded-lg p-3 border border-white">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className="text-base font-bold text-slate-700">{value}</p>
    </div>
  );
}
```

---

## 🔧 Paso 4 — Configuración de Vercel (`vercel.json`)

Crear en la raíz del proyecto:

```json
{
  "functions": {
    "src/app/api/authorize/route.ts": {
      "maxDuration": 30
    }
  }
}
```

> Las llamadas a Claude pueden tardar hasta 15–20 segundos. Sin este archivo, Vercel  
> corta la ejecución a los 10 segundos por defecto y el agente fallará en producción.

---

## 🔧 Paso 5 — Despliegue en Vercel

### Verificar antes de deployar

```bash
# Asegurarse de que no hay errores de TypeScript
pnpm build

# Verificar que .env.local no está en git
cat .gitignore | grep ".env.local"

# Commit final de la UI
git add .
git commit -m "feat: web UI and deployment config"
git push origin feat/ui-deploy
```

### Desplegar en Vercel

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Importar el repositorio de GitHub/GitLab
3. Framework: **Next.js** (se detecta automáticamente)
4. En **Settings → General → Install Command** escribir: `pnpm install`
5. En **Environment Variables** agregar las 5 variables (pedir a Persona 1):

```
NOTION_TOKEN           = secret_xxxxxxxxxxxx
NOTION_REPORTS_DB_ID   = xxxxxxxxxxxx
NOTION_POLICIES_DB_ID  = xxxxxxxxxxxx
NOTION_RESULTS_DB_ID   = xxxxxxxxxxxx
ANTHROPIC_API_KEY      = sk-ant-xxxxxxxxxxxx
```

6. Hacer clic en **Deploy**
7. Esperar ~2 minutos y copiar la URL pública

---

## 🔧 Paso 6 — Cambio de URL antes del merge final

Cuando Persona 2 avise que la API está lista:

En `src/app/page.tsx`, cambiar:

```typescript
// ANTES (desarrollo con mock)
const API_URL =
  process.env.NODE_ENV === "development"
    ? "/api/authorize/mock"
    : "/api/authorize";

// DESPUÉS (producción real)
const API_URL = "/api/authorize";
```

También puedes eliminar el archivo mock ya que no es necesario en producción:

```bash
rm src/app/api/authorize/mock/route.ts
```

---

## 🔧 Paso 7 — README.md final

Actualizar el `README.md` del repositorio con los enlaces reales:

```markdown
# 🏥 Agente de Pre-Autorización Quirúrgica en Tiempo Real

**"Aprobaciones médicas en segundos, no en días."**

---

## 📋 Entregables HackIAthon

🚀 **Agente Funcional (Web UI):**
https://TU-PROYECTO.vercel.app

💻 **Repositorio de Código:**
https://github.com/TUUSUARIO/hackiathon-preauth
```

---

## 🔧 Paso 8 — Correo de entrega

Enviar a **hackiathon@viamatica.com**:

```
Asunto: HackIAthon — Reto 1: Agente de Pre-Autorización Quirúrgica

Hola,

Adjunto los entregables del Reto 1:

🚀 Agente funcional (Web UI):
https://TU-PROYECTO.vercel.app

💻 Repositorio de código:
https://github.com/TUUSUARIO/hackiathon-preauth

Equipo: La Pochita Stone

Saludos,
[Tu nombre]
```

---

## 📁 Estructura de archivos que debes crear

```
src/
├── app/
│   ├── page.tsx                          ← TU RESPONSABILIDAD
│   └── api/
│       └── authorize/
│           └── mock/
│               └── route.ts             ← TU MOCK (solo durante dev)
└── components/
    ├── AuthForm.tsx                      ← TU RESPONSABILIDAD
    └── ResultCard.tsx                    ← TU RESPONSABILIDAD

# Archivos en la raíz
vercel.json                               ← TU RESPONSABILIDAD
README.md                                 ← ACTUALIZAR con enlaces finales
```

---

## 🧪 Verificación visual antes de entregar

Probar manualmente estos 3 flujos en la UI de Vercel:

| Flujo | Qué llenar | Resultado esperado |
|-------|-----------|-------------------|
| Aprobado | ID: 0987654321 · Póliza: POL-2024-001 · Apendicitis crónica · Apendicectomía laparoscópica · Programada | Tarjeta verde ✅ |
| Urgente aprobado | ID: 1122334455 · Póliza: POL-2024-002 · Apendicitis aguda perforada · Laparotomía de emergencia · **Urgente** | Tarjeta verde ✅ con badge 🚑 URGENTE |
| Rechazado | ID: 5566778899 · Póliza: POL-2024-003 · Ruptura LCA · Reconstrucción artroscópica · Programada | Tarjeta roja ❌ |

---

## 🚨 Errores comunes a evitar

| Error | Solución |
|-------|----------|
| Build falla por TypeScript | Ejecutar `pnpm tsc --noEmit` para ver los errores específicos |
| Vercel timeout en producción | Verificar que `vercel.json` está en la raíz del repo |
| Variables de entorno no cargadas | En Vercel: Settings → Environment Variables → verificar las 5 |
| `pnpm install` falla en Vercel | En Settings → General → Install Command: `pnpm install` |
| CORS error en producción | Verificar que la URL es relativa (`/api/authorize`), no absoluta |
| Mock sigue activo en producción | Verificar que `API_URL` apunta a `/api/authorize`, no al mock |

---

## 📬 Comunicación con el equipo

| Momento | Qué comunicar |
|---------|---------------|
| Al crear el mock | Confirmación de que empezaste y la rama existe |
| Al terminar `AuthForm` | Screenshot o video corto del formulario funcionando |
| Al terminar `ResultCard` | Screenshot de los 3 estados (Aprobado, Revisión, Rechazado) |
| Al tener la URL de Vercel | Compartir el enlace con el equipo para pruebas |
| Cuando P2 avise que la API está lista | Cambiar URL del mock y hacer merge |
| Al mergear | URL final de Vercel para el correo de entrega |
