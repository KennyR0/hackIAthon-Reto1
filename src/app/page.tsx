"use client";

import {
  Activity,
  AlertCircle,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import AuthForm, { type AuthFormData } from "@/components/AuthForm";
import ResultCard from "@/components/ResultCard";
import type { AuthorizationResult, MedicalReport } from "@/types";

type ErrorPayload = {
  error?: string;
};

export default function Home() {
  const [result, setResult] = useState<AuthorizationResult | null>(null);
  const [submittedReport, setSubmittedReport] = useState<MedicalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: AuthFormData) {
    const report: MedicalReport = {
      ...formData,
      reportDate: new Date().toISOString(),
    };

    setLoading(true);
    setError(null);
    setResult(null);
    setSubmittedReport(report);

    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(payload.error ?? "No se pudo procesar la solicitud.");
      }

      const data = (await response.json()) as AuthorizationResult;
      setResult(data);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Error inesperado al analizar el caso.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F6FAF9] text-[#12323C]">
      <section className="border-b border-[#D6E5E2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#BFE3DD] bg-[#E6F3F1] px-3 py-2 text-sm font-semibold text-[#0E766E]">
              <Stethoscope aria-hidden="true" size={16} />
              Auditoria medica asistida por IA
            </div>
            <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-[#12323C] sm:text-4xl">
              Agente de Pre-Autorizacion Quirurgica
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#5C7379]">
              Analiza informes medicos y polizas en tiempo real para emitir una
              decision administrativa clara, con comprobantes PDF listos para
              entregar.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <Metric icon={ShieldCheck} label="Validacion" value="Poliza" />
            <Metric icon={Activity} label="Decision" value="Tiempo real" />
            <Metric icon={FileText} label="PDF" value="Descarga" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:px-8">
        <AuthForm loading={loading} onSubmit={handleSubmit} />

        <div className="min-h-[520px] rounded-lg border border-[#D6E5E2] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF0FF] text-[#2563EB]">
              <ClipboardCheck aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#12323C]">
                Resultado de autorizacion
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#5C7379]">
                La decision y los documentos descargables apareceran aqui.
              </p>
            </div>
          </div>

          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState /> : null}
          {!loading && !error && result && submittedReport ? (
            <ResultCard report={submittedReport} result={result} />
          ) : null}
          {!loading && !error && !result ? <EmptyState /> : null}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
      <Icon aria-hidden="true" className="text-[#0E766E]" size={20} />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#7A9095]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#12323C]">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center rounded-lg border border-dashed border-[#BFE3DD] bg-[#F6FAF9] p-8 text-center">
      <LoaderCircle
        aria-hidden="true"
        className="animate-spin text-[#0E766E]"
        size={36}
      />
      <h3 className="mt-5 text-lg font-semibold text-[#12323C]">
        Analizando informe y poliza
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#5C7379]">
        Estamos normalizando codigos medicos, validando cobertura y preparando la
        respuesta administrativa.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center rounded-lg border border-dashed border-[#BFE3DD] bg-[#F6FAF9] p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[#0E766E] shadow-sm">
        <ClipboardCheck aria-hidden="true" size={28} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-[#12323C]">
        Caso listo para evaluacion
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#5C7379]">
        Complete el formulario para emitir una decision y descargar el PDF
        correspondiente.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-[#991B1B]">
      <div className="flex gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
        <div>
          <h3 className="font-semibold">No se pudo completar el analisis</h3>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}
