"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  History,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import ResultCard from "@/components/ResultCard";
import type { AuthorizationResult, MedicalReport } from "@/types";

type ErrorPayload = {
  error?: string;
};

type AuthorizationResponse = AuthorizationResult & {
  report?: MedicalReport;
};

export default function Home() {
  const [result, setResult] = useState<AuthorizationResult | null>(null);
  const [submittedReport, setSubmittedReport] = useState<MedicalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "validada" | "no-validada" | null
  >(null);
  const [validationSaving, setValidationSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setResult(null);
    setSubmittedReport(null);
    setShowValidationModal(false);
    setValidationStatus(null);
    setValidationError(null);

    try {
      const response = await fetch("/api/authorize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
        throw new Error(payload.error ?? "No se pudo procesar la solicitud.");
      }

      const data = (await response.json()) as AuthorizationResponse;
      setResult(data);
      setSubmittedReport(
        data.report ?? {
          patientId: data.patientId ?? "SIN-ID",
          patientName: data.patientName ?? "",
          reportDate: new Date().toISOString(),
          diagnosis: "",
          procedure: "",
          urgency: data.isUrgent ? "Urgente" : "Programada",
          policyId: "",
        },
      );
      setShowValidationModal(data.decision === "Aprobado");
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
              Sube el informe medico y la poliza en PDF para obtener una decision
              administrativa en segundos.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <Metric icon={ShieldCheck} label="Validacion" value="Poliza" />
            <Metric icon={Activity} label="Decision" value="Tiempo real" />
            <Metric icon={FileText} label="PDF" value="Descarga" />
          </div>
        </div>
      </section>

      <section className="border-b border-[#D6E5E2] bg-[#F6FAF9]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold text-[#12323C]">
              Casos de prueba disponibles
            </p>
            <p className="mt-1 text-sm leading-6 text-[#5C7379]">
              Catalogo de distintos casos de pruebas disponible para su descarga.
            </p>
          </div>
          <a
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0E766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C] sm:w-auto"
            href="/casos-prueba"
            rel="noreferrer"
            target="_blank"
          >
            <Download aria-hidden="true" size={17} />
            Ver casos de prueba
            <ExternalLink aria-hidden="true" size={15} />
          </a>
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
                Resultado de Pre-autorizacion
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#5C7379]">
                La decision y los documentos descargables apareceran aqui.
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#12323C]">
                  Bandeja de preautorizaciones
                </p>
                <p className="mt-1 text-sm leading-6 text-[#5C7379]">
                  Abre la gestion de casos anteriores en una vista dedicada.
                </p>
              </div>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#BFE3DD] bg-white px-4 text-sm font-semibold text-[#0E766E] transition-colors hover:border-[#0E766E] hover:bg-[#E6F3F1]"
                href="/preautorizaciones"
                rel="noreferrer"
                target="_blank"
              >
                <History aria-hidden="true" size={16} />
                Abrir preautorizaciones
                <ExternalLink aria-hidden="true" size={14} />
              </a>
            </div>
          </div>

          {error ? <ErrorState message={error} /> : null}
          {loading ? <LoadingState /> : null}
          {!loading && !error && result && submittedReport ? (
            <div className="space-y-4">
              <ResultCard report={submittedReport} result={result} />
              {result.decision === "Aprobado" ? (
                <ValidationPanel
                  onOpen={() => setShowValidationModal(true)}
                  status={validationStatus}
                />
              ) : (
                <CaseFollowUpPanel decision={result.decision} />
              )}
            </div>
          ) : null}
          {!loading && !error && !result ? <EmptyState /> : null}
        </div>
      </section>

      {showValidationModal && result ? (
        <ValidationModal
          error={validationError}
          loading={validationSaving}
          onClose={() => setShowValidationModal(false)}
          result={result}
          onValidate={async (status) => {
            setValidationSaving(true);
            setValidationError(null);
            try {
              if (result.notionResultPageId) {
                const response = await fetch("/api/authorize/validate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    resultPageId: result.notionResultPageId,
                    status,
                  }),
                });

                if (!response.ok) {
                  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
                  throw new Error(
                    payload.error ?? "No se pudo guardar la validacion.",
                  );
                }
              }

              setValidationStatus(status);
              setShowValidationModal(false);
            } catch (caughtError) {
              setValidationError(
                caughtError instanceof Error
                  ? caughtError.message
                  : "No se pudo guardar la validacion.",
              );
            } finally {
              setValidationSaving(false);
            }
          }}
        />
      ) : null}
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

function ValidationPanel({
  onOpen,
  status,
}: {
  onOpen: () => void;
  status: "validada" | "no-validada" | null;
}) {
  const statusText =
    status === "validada"
      ? "Preautorizacion validada"
      : status === "no-validada"
        ? "Preautorizacion no validada"
        : "Pendiente de validacion humana";

  return (
    <div className="rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#12323C]">{statusText}</p>
          <p className="mt-1 text-sm leading-6 text-[#5C7379]">
            Revisa la decision automatica antes de confirmar la preautorizacion.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0E766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C]"
          onClick={onOpen}
          type="button"
        >
          Validar preautorizacion
        </button>
      </div>
    </div>
  );
}

function CaseFollowUpPanel({
  decision,
}: {
  decision: AuthorizationResult["decision"];
}) {
  const isRejected = decision === "Rechazado";

  return (
    <div className="rounded-lg border border-[#FED7AA] bg-[#FFF7ED] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#C2410C]">
            <ShieldAlert aria-hidden="true" size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#12323C]">
              {isRejected
                ? "Caso rechazado: requiere gestion"
                : "Caso en revision: requiere subsanacion"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#5C7379]">
              Revisa este caso en la bandeja dedicada para subir documentos y
              ejecutar una reevaluacion.
            </p>
          </div>
        </div>
        <a
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0E766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C]"
          href="/preautorizaciones"
          rel="noreferrer"
          target="_blank"
        >
          <History aria-hidden="true" size={16} />
          Ir a preautorizaciones
        </a>
      </div>
    </div>
  );
}

function ValidationModal({
  error,
  loading,
  onClose,
  onValidate,
  result,
}: {
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onValidate: (status: "validada" | "no-validada") => void;
  result: AuthorizationResult;
}) {
  const missingDocuments = result.missingDocuments ?? [];
  const decisionStyle =
    result.decision === "Aprobado"
      ? {
          bg: "bg-[#ECFDF5]",
          border: "border-[#A7F3D0]",
          iconBg: "bg-[#D1FAE5]",
          text: "text-[#047857]",
        }
      : result.decision === "Rechazado"
        ? {
            bg: "bg-[#FEF2F2]",
            border: "border-[#FECACA]",
            iconBg: "bg-[#FEE2E2]",
            text: "text-[#B91C1C]",
          }
        : {
            bg: "bg-[#FFF7ED]",
            border: "border-[#FED7AA]",
            iconBg: "bg-[#FFEDD5]",
            text: "text-[#C2410C]",
          };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12323C]/50 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#D6E5E2] bg-white shadow-2xl">
        <div className="border-b border-[#D6E5E2] bg-[#F6FAF9] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${decisionStyle.iconBg} ${decisionStyle.text}`}
              >
                <ClipboardCheck aria-hidden="true" size={22} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#0E766E]">
                  Validacion humana
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#12323C]">
                  Revisar preautorizacion
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#5C7379]">
                  Confirma la decision automatica solo si la justificacion y los
                  soportes del caso son consistentes.
                </p>
              </div>
            </div>
            <button
              aria-label="Cerrar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5C7379] transition-colors hover:bg-white hover:text-[#12323C]"
              onClick={onClose}
              type="button"
            >
              <XCircle aria-hidden="true" size={20} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryBadge
              className={`${decisionStyle.bg} ${decisionStyle.border}`}
              label="Decision"
              value={result.decision}
              valueClassName={decisionStyle.text}
            />
            <SummaryBadge label="CIE-10" value={result.cie10Code} />
            <SummaryBadge label="CPT" value={result.cptCode} />
          </div>

          <div className="mt-4 rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#12323C]">Justificacion</h3>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-bold uppercase tracking-wide text-[#7A9095]">
                Auditoria
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[#385A62]">
              {result.justification}
            </p>
          </div>

          {missingDocuments.length > 0 ? (
            <div className="mt-4 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] p-4">
              <h3 className="text-sm font-bold text-[#9A3412]">
                Documentos pendientes
              </h3>
              <ul className="mt-3 space-y-2">
                {missingDocuments.map((document) => (
                  <li
                    className="flex gap-2 text-sm leading-6 text-[#385A62]"
                    key={document}
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97706]" />
                    {document}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-4">
              <div className="flex gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[#047857]"
                  size={18}
                />
                <div>
                  <h3 className="text-sm font-bold text-[#047857]">
                    Sin documentos pendientes
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#385A62]">
                    El caso no reporta soportes faltantes para esta decision.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 border-t border-[#D6E5E2] bg-white px-5 py-4 sm:grid-cols-2">
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#0E766E] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0B625C] disabled:cursor-not-allowed disabled:bg-[#B7CBC7]"
            disabled={loading}
            onClick={() => onValidate("validada")}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={18} />
            {loading ? "Guardando..." : "Validar decision"}
          </button>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 text-sm font-bold text-[#B91C1C] transition-colors hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={() => onValidate("no-validada")}
            type="button"
          >
            <XCircle aria-hidden="true" size={18} />
            Solicitar revision
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({
  className = "border-[#D6E5E2] bg-[#F6FAF9]",
  label,
  value,
  valueClassName = "text-[#12323C]",
}: {
  className?: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#7A9095]">
        {label}
      </p>
      <p className={`mt-2 text-lg font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}
