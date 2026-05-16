"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AuthorizationResult, MedicalReport } from "@/types";
import {
  downloadMissingDocumentsPdf,
  downloadPreapprovalPdf,
} from "@/lib/pdf";

type ResultCardProps = {
  report: MedicalReport;
  result: AuthorizationResult;
};

const decisionStyles = {
  Aprobado: {
    border: "border-[#A7F3D0]",
    bg: "bg-[#ECFDF5]",
    iconBg: "bg-[#D1FAE5]",
    text: "text-[#047857]",
    icon: CheckCircle2,
  },
  "Revisión": {
    border: "border-[#FED7AA]",
    bg: "bg-[#FFF7ED]",
    iconBg: "bg-[#FFEDD5]",
    text: "text-[#C2410C]",
    icon: FileWarning,
  },
  Rechazado: {
    border: "border-[#FECACA]",
    bg: "bg-[#FEF2F2]",
    iconBg: "bg-[#FEE2E2]",
    text: "text-[#B91C1C]",
    icon: ShieldAlert,
  },
} satisfies Record<
  AuthorizationResult["decision"],
  {
    bg: string;
    border: string;
    icon: typeof CheckCircle2;
    iconBg: string;
    text: string;
  }
>;

export default function ResultCard({ report, result }: ResultCardProps) {
  const style = decisionStyles[result.decision];
  const Icon = style.icon;
  const hasMissingDocuments = (result.missingDocuments?.length ?? 0) > 0;

  return (
    <section className={`rounded-lg border p-5 shadow-sm ${style.border} ${style.bg}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${style.iconBg} ${style.text}`}
          >
            <Icon aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#5C7379]">
              Decision emitida
            </p>
            <h2 className={`mt-1 text-2xl font-bold ${style.text}`}>
              {result.decision}
            </h2>
          </div>
        </div>

        {result.isUrgent ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#FEE2E2] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#B42318]">
            <AlertTriangle aria-hidden="true" size={14} />
            Urgente
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <CodeBadge label="CIE-10" value={result.cie10Code} />
        <CodeBadge label="CPT" value={result.cptCode} />
      </div>

      <div className="mt-5 rounded-lg border border-white/80 bg-white/70 p-4">
        <h3 className="text-sm font-semibold text-[#12323C]">Justificacion</h3>
        <p className="mt-2 text-sm leading-6 text-[#385A62]">{result.justification}</p>
      </div>

      {hasMissingDocuments ? (
        <div className="mt-4 rounded-lg border border-[#FED7AA] bg-white/80 p-4">
          <h3 className="text-sm font-semibold text-[#9A3412]">
            Documentos faltantes
          </h3>
          <ul className="mt-3 space-y-2">
            {result.missingDocuments?.map((document) => (
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
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-white/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5C7379]">
          <Clock3 aria-hidden="true" size={14} />
          Procesado en {(result.processingTimeMs / 1000).toFixed(1)}s
        </span>

        <div className="flex flex-col gap-2 sm:flex-row">
          {result.decision === "Aprobado" ? (
            <PdfButton onClick={() => downloadPreapprovalPdf(report, result)}>
              PDF preaprobacion
            </PdfButton>
          ) : null}
          {hasMissingDocuments ? (
            <PdfButton onClick={() => downloadMissingDocumentsPdf(report, result)}>
              PDF documentos
            </PdfButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CodeBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/90 bg-white/75 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7A9095]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[#12323C]">{value}</p>
    </div>
  );
}

function PdfButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
      onClick={onClick}
      type="button"
    >
      <Download aria-hidden="true" size={16} />
      {children}
    </button>
  );
}
