"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileUp,
  History,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthorizationResult, PreauthorizationCase } from "@/types";

type ErrorPayload = {
  error?: string;
};

type AuthorizationsResponse = {
  authorizations?: PreauthorizationCase[];
  error?: string;
};

async function fetchAuthorizations(): Promise<PreauthorizationCase[]> {
  const response = await fetch("/api/authorizations", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as AuthorizationsResponse;

  if (!response.ok) {
    throw new Error(
      payload.error ?? "No se pudo cargar el historial de preautorizaciones.",
    );
  }

  return payload.authorizations ?? [];
}

export default function PreauthorizationsManager() {
  const [authorizations, setAuthorizations] = useState<PreauthorizationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingCaseId, setUploadingCaseId] = useState<string | null>(null);

  async function loadAuthorizations() {
    setLoading(true);
    setError(null);

    try {
      setAuthorizations(await fetchAuthorizations());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo cargar el historial de preautorizaciones.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAuthorizations() {
      try {
        const results = await fetchAuthorizations();

        if (!cancelled) {
          setAuthorizations(results);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "No se pudo cargar el historial de preautorizaciones.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialAuthorizations();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = authorizations.filter(
    (item) => item.decision !== "Aprobado",
  ).length;
  const approvedCount = authorizations.filter(
    (item) => item.decision === "Aprobado",
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Casos registrados" value={authorizations.length.toString()} />
        <Metric label="Pendientes" value={pendingCount.toString()} tone="warning" />
        <Metric label="Aprobados" value={approvedCount.toString()} tone="success" />
      </div>

      <section className="rounded-lg border border-[#D6E5E2] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#D6E5E2] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#12323C]">
              Bandeja de preautorizaciones
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5C7379]">
              Revisa casos emitidos, sube documentacion y reevalua la decision.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#BFE3DD] bg-white px-4 text-sm font-semibold text-[#0E766E] hover:border-[#0E766E]"
            disabled={loading}
            onClick={loadAuthorizations}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
              size={16}
            />
            Actualizar
          </button>
        </div>

        <div className="mt-5">
          {error ? <ErrorState message={error} /> : null}
          {loading ? <HistoryLoadingState /> : null}
          {!loading && authorizations.length === 0 ? <HistoryEmptyState /> : null}

          {!loading && authorizations.length > 0 ? (
            <div className="grid gap-3">
              {authorizations.map((item) => (
                <AuthorizationCaseCard
                  authorization={item}
                  key={item.id}
                  onUpload={async (caseId, file) => {
                    setUploadingCaseId(caseId);
                    setError(null);

                    try {
                      const uploadForm = new FormData();
                      uploadForm.append("document", file);
                      uploadForm.append(
                        "note",
                        "Documento faltante cargado para reevaluacion desde la bandeja de preautorizaciones.",
                      );

                      const response = await fetch(
                        `/api/authorizations/${caseId}/missing-documents`,
                        {
                          method: "POST",
                          body: uploadForm,
                        },
                      );
                      const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

                      if (!response.ok) {
                        throw new Error(
                          payload.error ?? "No se pudo subir el documento faltante.",
                        );
                      }

                      await loadAuthorizations();
                    } catch (caughtError) {
                      setError(
                        caughtError instanceof Error
                          ? caughtError.message
                          : "No se pudo reevaluar el caso.",
                      );
                    } finally {
                      setUploadingCaseId(null);
                    }
                  }}
                  uploading={uploadingCaseId === item.id}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "success" | "warning";
  value: string;
}) {
  const valueColor =
    tone === "success"
      ? "text-[#047857]"
      : tone === "warning"
        ? "text-[#C2410C]"
        : "text-[#12323C]";

  return (
    <div className="rounded-lg border border-[#D6E5E2] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7A9095]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function AuthorizationCaseCard({
  authorization,
  onUpload,
  uploading,
}: {
  authorization: PreauthorizationCase;
  onUpload: (caseId: string, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const canReevaluate = authorization.decision !== "Aprobado";
  const hasMissingDocuments = authorization.missingDocuments.length > 0;

  return (
    <article className="rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#12323C]">
              {authorization.caseCode || "Caso sin codigo"}
            </p>
            <DecisionBadge decision={authorization.decision} />
            {authorization.isUrgent ? (
              <span className="rounded-md bg-[#FEF2F2] px-2 py-1 text-xs font-bold text-[#B91C1C]">
                Urgente
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#5C7379]">
            <span>ID paciente: {authorization.patientId || "N/D"}</span>
            <span>Poliza: {authorization.policyId || "N/D"}</span>
            <span>CIE-10: {authorization.cie10Code || "N/D"}</span>
            <span>CPT: {authorization.cptCode || "N/D"}</span>
          </div>

          <p className="mt-3 text-sm leading-6 text-[#385A62]">
            {authorization.justification}
          </p>
        </div>

        <div className="rounded-lg border border-[#D6E5E2] bg-white p-3">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5C7379]">
            <CalendarDays aria-hidden="true" size={14} />
            {formatDate(authorization.decidedAt)}
          </span>

          {canReevaluate ? (
            <MissingDocumentUpload
              caseId={authorization.id}
              onUpload={onUpload}
              uploading={uploading}
            />
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#ECFDF5] px-3 py-2 text-xs font-bold text-[#047857]">
              <CheckCircle2 aria-hidden="true" size={14} />
              {authorization.supplementalStatus === "cargado"
                ? "Reevaluado"
                : "Sin pendientes"}
            </div>
          )}
        </div>
      </div>

      {hasMissingDocuments ? (
        <div className="mt-4 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] p-3">
          <p className="text-sm font-semibold text-[#9A3412]">
            Pendientes de auditoria
          </p>
          <ul className="mt-2 grid gap-1 md:grid-cols-2">
            {authorization.missingDocuments.map((document) => (
              <li className="text-sm leading-6 text-[#385A62]" key={document}>
                {document}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function MissingDocumentUpload({
  caseId,
  onUpload,
  uploading,
}: {
  caseId: string;
  onUpload: (caseId: string, file: File) => Promise<void>;
  uploading: boolean;
}) {
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0E766E] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <UploadCloud aria-hidden="true" size={17} />
      {uploading ? "Reevaluando..." : "Subir y reevaluar"}
      <FileUp aria-hidden="true" size={17} />
      <input
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (file) {
            void onUpload(caseId, file);
          }
        }}
        type="file"
      />
    </label>
  );
}

function DecisionBadge({
  decision,
}: {
  decision: AuthorizationResult["decision"];
}) {
  const className =
    decision === "Aprobado"
      ? "bg-[#ECFDF5] text-[#047857]"
      : decision === "Rechazado"
        ? "bg-[#FEF2F2] text-[#B91C1C]"
        : "bg-[#FFF7ED] text-[#C2410C]";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-bold ${className}`}>
      {decision}
    </span>
  );
}

function HistoryLoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-[#BFE3DD] bg-[#F6FAF9] p-6">
      <LoaderCircle
        aria-hidden="true"
        className="animate-spin text-[#0E766E]"
        size={30}
      />
    </div>
  );
}

function HistoryEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[#BFE3DD] bg-[#F6FAF9] p-8 text-center">
      <History aria-hidden="true" className="mx-auto text-[#0E766E]" size={32} />
      <h3 className="mt-4 text-base font-semibold text-[#12323C]">
        Aun no hay preautorizaciones
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#5C7379]">
        Los casos analizados apareceran aqui para seguimiento.
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
          <h3 className="font-semibold">No se pudo completar la operacion</h3>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
