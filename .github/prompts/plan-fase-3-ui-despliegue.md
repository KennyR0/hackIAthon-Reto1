# 🚀 Plan de Implementación — Fase 3: Web UI y Despliegue

> **Duración estimada:** 1–2 días  
> **Objetivo:** Construir la interfaz web del agente, conectarla al motor de decisión y desplegar en Vercel con el enlace público listo para el HackIAthon.

---

## 1. Vista General de la UI

La interfaz tiene **una sola pantalla** dividida en tres secciones:

```
┌─────────────────────────────────────────────────────┐
│  🏥 Agente de Pre-Autorización Quirúrgica           │
├──────────────────────┬──────────────────────────────┤
│  📋 FORMULARIO       │  📊 RESULTADO                │
│                      │                              │
│  ID Paciente         │  ┌────────────────────────┐  │
│  ID Póliza           │  │  ✅ APROBADO            │  │
│  Diagnóstico         │  │  CIE-10: K35.8          │  │
│  Procedimiento       │  │  CPT: 44950             │  │
│  Urgencia (toggle)   │  │  Justificación: ...     │  │
│                      │  └────────────────────────┘  │
│  [Analizar →]        │  ⏱ Procesado en 4.2s         │
└──────────────────────┴──────────────────────────────┘
```

---

## 2. Componente Principal (`src/app/page.tsx`)

```tsx
"use client";

import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import ResultCard from "@/components/ResultCard";
import { AuthorizationResult } from "@/types";

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
      const response = await fetch("/api/authorize", {
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
        throw new Error(err.error ?? "Error desconocido");
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

## 3. Componente: Formulario (`src/components/AuthForm.tsx`)

```tsx
"use client";

import { useState } from "react";

interface AuthFormProps {
  onSubmit: (data: any) => void;
  loading: boolean;
}

export default function AuthForm({ onSubmit, loading }: AuthFormProps) {
  const [patientId, setPatientId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedure, setProcedure] = useState("");
  const [urgency, setUrgency] = useState<"Urgente" | "Programada">("Programada");

  function handleSubmit() {
    if (!patientId || !policyId || !diagnosis || !procedure) return;
    onSubmit({ patientId, policyId, diagnosis, procedure, urgency });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-700">
        📋 Datos del Caso
      </h2>

      <div className="space-y-3">
        <InputField label="ID Paciente" value={patientId} onChange={setPatientId}
          placeholder="Ej: 1700123456" />
        <InputField label="ID Póliza" value={policyId} onChange={setPolicyId}
          placeholder="Ej: POL-2024-001" />
        <TextareaField label="Diagnóstico Médico" value={diagnosis} onChange={setDiagnosis}
          placeholder="Describa el diagnóstico clínico del paciente..." />
        <TextareaField label="Procedimiento Solicitado" value={procedure} onChange={setProcedure}
          placeholder="Nombre de la cirugía o intervención solicitada..." />

        {/* Toggle de urgencia */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Tipo de caso</span>
          <button
            onClick={() => setUrgency(urgency === "Urgente" ? "Programada" : "Urgente")}
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
        disabled={loading || !patientId || !policyId || !diagnosis || !procedure}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300
                   text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? "Analizando..." : "Analizar y Autorizar →"}
      </button>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
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

function TextareaField({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
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

## 4. Componente: Resultado (`src/components/ResultCard.tsx`)

```tsx
import { AuthorizationResult } from "@/types";

const DECISION_CONFIG = {
  Aprobado: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    text: "text-emerald-800",
    icon: "✅",
    badge: "bg-emerald-500",
  },
  Revisión: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: "🔍",
    badge: "bg-amber-500",
  },
  Rechazado: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: "❌",
    badge: "bg-red-500",
  },
};

export default function ResultCard({ result }: { result: AuthorizationResult }) {
  const cfg = DECISION_CONFIG[result.decision];

  return (
    <div className={`rounded-2xl border-2 p-6 space-y-4 ${cfg.bg} ${cfg.border}`}>
      {/* Header */}
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

      {/* Documentos faltantes */}
      {result.missingDocuments && result.missingDocuments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
            Documentos Requeridos
          </p>
          <ul className="space-y-1">
            {result.missingDocuments.map((doc, i) => (
              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span> {doc}
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

## 5. Despliegue en Vercel

### 5.1 Preparar para producción

```bash
# Verificar build sin errores
npm run build

# Asegurarse de que .env.local NO está en git
echo ".env.local" >> .gitignore

# Commit final
git add .
git commit -m "feat: agente de pre-autorización completo"
git push origin main
```

### 5.2 Desplegar en Vercel

1. Ir a [vercel.com/new](https://vercel.com/new) e importar el repositorio
2. En **Environment Variables**, agregar todas las variables de `.env.local`:
   - `NOTION_TOKEN`
   - `NOTION_REPORTS_DB_ID`
   - `NOTION_POLICIES_DB_ID`
   - `NOTION_RESULTS_DB_ID`
   - `ANTHROPIC_API_KEY`
3. Seleccionar **Framework Preset: Next.js**
4. Hacer clic en **Deploy**

### 5.3 Configuración de timeout en Vercel

Crear `vercel.json` en la raíz (las llamadas a Claude pueden tardar hasta 30s):

```json
{
  "functions": {
    "src/app/api/authorize/route.ts": {
      "maxDuration": 30
    }
  }
}
```

---

## 6. Datos de Prueba

### Caso 1 — Aprobado (Programada)

```
ID Paciente:   0987654321
ID Póliza:     POL-2024-001   ← debe existir en Notion con Cirugía General cubierta
Diagnóstico:   Apendicitis crónica con dolor recurrente en fosa ilíaca derecha
Procedimiento: Apendicectomía laparoscópica electiva
Urgencia:      Programada
```

### Caso 2 — Aprobado Urgente (saltea carencia)

```
ID Paciente:   1122334455
ID Póliza:     POL-2024-002   ← póliza reciente con carencia activa
Diagnóstico:   Apendicitis aguda perforada con peritonitis generalizada
Procedimiento: Laparotomía exploratoria de emergencia
Urgencia:      Urgente
```

### Caso 3 — Rechazado (fuera de cobertura)

```
ID Paciente:   5566778899
ID Póliza:     POL-2024-003   ← póliza Plan Básico sin Ortopedia
Diagnóstico:   Ruptura de ligamento cruzado anterior de rodilla derecha
Procedimiento: Reconstrucción artroscópica de ligamento cruzado anterior
Urgencia:      Programada
```

---

## 7. Completar el README para Entrega

Actualizar estos campos en el `README.md` del repositorio:

```markdown
🚀 **Agente Funcional (Web UI):**
https://tu-proyecto.vercel.app

💻 **Repositorio de Código:**
https://github.com/tuusuario/hackiathon-preauth
```

---

## 8. Checklist Final de Entrega

### Funcionalidad
- [ ] Formulario acepta ID paciente, ID póliza, diagnóstico, procedimiento y urgencia
- [ ] El agente devuelve decisión en < 15 segundos
- [ ] Los 3 casos de prueba retornan decisiones coherentes
- [ ] El resultado aparece en la DB de Notion en tiempo real
- [ ] El caso urgente omite correctamente la validación de carencia

### Despliegue
- [ ] La app está desplegada en Vercel y accesible públicamente
- [ ] No hay errores de CORS ni de variables de entorno en producción
- [ ] El repositorio en GitHub/GitLab es público

### Entregables HackIAthon
- [ ] README.md tiene enlace a Vercel funcional
- [ ] README.md tiene enlace al repositorio
- [ ] Correo enviado a **hackiathon@viamatica.com** con:
  - Enlace público del agente funcional
  - Enlace del repositorio en GitHub o GitLab

---

> ✅ **¡Proyecto completo y listo para el HackIAthon!**
