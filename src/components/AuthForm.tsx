"use client";

import { FileText, Shield, X } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

export type AuthFormData = {
  medicalReport: File;
  insurancePolicy: File;
};

type AuthFormProps = {
  loading: boolean;
  onSubmit: (formData: FormData) => void;
};

type UploadField = keyof AuthFormData;
type UploadStatus = "idle" | "selected" | "error";

type UploadState = {
  file: File | null;
  status: UploadStatus;
  message: string | null;
};

const initialUploadState: UploadState = {
  file: null,
  status: "idle",
  message: null,
};

export default function AuthForm({ loading, onSubmit }: AuthFormProps) {
  const [medicalReport, setMedicalReport] =
    useState<UploadState>(initialUploadState);
  const [insurancePolicy, setInsurancePolicy] =
    useState<UploadState>(initialUploadState);

  const isReady = Boolean(medicalReport.file && insurancePolicy.file);

  function updateField(field: UploadField, file: File | null) {
    const setter =
      field === "medicalReport" ? setMedicalReport : setInsurancePolicy;

    if (!file) {
      setter(initialUploadState);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setter({
        file: null,
        status: "error",
        message: "Selecciona un archivo con extension .pdf.",
      });
      return;
    }

    setter({
      file,
      status: "selected",
      message: null,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isReady || loading || !medicalReport.file || !insurancePolicy.file) {
      return;
    }

    const formData = new FormData();
    formData.append("medicalReport", medicalReport.file);
    formData.append("insurancePolicy", insurancePolicy.file);
    onSubmit(formData);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#D6E5E2] bg-white p-5 shadow-sm"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E6F3F1] text-[#0E766E]">
          <FileText aria-hidden="true" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#12323C]">Documentos del caso</h2>
          <p className="mt-1 text-sm leading-6 text-[#5C7379]">
            Carga el informe medico y la poliza para emitir la decision administrativa.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <UploadZone
          field="medicalReport"
          icon={<FileText aria-hidden="true" size={22} />}
          loading={loading}
          onChange={updateField}
          state={medicalReport}
          subtitle="Formulario MSP 053, epicrisis, informe preoperatorio"
          title="Informe Medico (PDF)"
        />
        <UploadZone
          field="insurancePolicy"
          icon={<Shield aria-hidden="true" size={22} />}
          loading={loading}
          onChange={updateField}
          state={insurancePolicy}
          subtitle="IESS, Saludsa, Ecuasanitas, Humana, AIG, Liberty, etc."
          title="Poliza de Seguro (PDF)"
        />
      </div>

      <button
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-[#0E766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C] disabled:cursor-not-allowed disabled:bg-[#B7CBC7]"
        disabled={!isReady || loading}
        type="submit"
      >
        {loading ? "Analizando documentos..." : "Analizar"}
      </button>
    </form>
  );
}

function UploadZone({
  field,
  icon,
  loading,
  onChange,
  state,
  subtitle,
  title,
}: {
  field: UploadField;
  icon: ReactNode;
  loading: boolean;
  onChange: (field: UploadField, file: File | null) => void;
  state: UploadState;
  subtitle: string;
  title: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedFile = state.status === "selected" ? state.file : null;
  const hasFile = Boolean(selectedFile);

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(field, event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (loading) {
      return;
    }

    onChange(field, event.dataTransfer.files[0] ?? null);
  }

  return (
    <div>
      <div className="mb-2 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F3F1] text-[#0E766E]">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#12323C]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#5C7379]">{subtitle}</p>
        </div>
      </div>

      <div
        className={`min-h-32 rounded-lg border border-dashed p-4 transition-colors ${
          state.status === "error"
            ? "border-[#FCA5A5] bg-[#FEF2F2]"
            : dragging
              ? "border-[#0E766E] bg-[#E6F3F1]"
              : hasFile
                ? "border-[#8FD5CC] bg-[#F6FAF9]"
                : "border-[#BFE3DD] bg-white hover:border-[#0E766E] hover:bg-[#F6FAF9]"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
      >
        <input
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={loading}
          onChange={handleInputChange}
          ref={inputRef}
          type="file"
        />

        {hasFile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#12323C]">
                {selectedFile?.name}
              </p>
              <p className="mt-1 text-xs text-[#5C7379]">
                {selectedFile ? formatFileSize(selectedFile.size) : ""}
              </p>
            </div>
            <button
              aria-label={`Quitar ${title}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D6E5E2] bg-white text-[#5C7379] transition-colors hover:border-[#0E766E] hover:text-[#0E766E]"
              disabled={loading}
              onClick={(event) => {
                event.stopPropagation();
                onChange(field, null);
              }}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ) : (
          <div className="flex min-h-20 flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-[#12323C]">
              Arrastra el PDF aqui o haz click para seleccionar
            </p>
            <p className="mt-2 text-xs text-[#5C7379]">
              Solo archivos PDF de hasta 10 MB
            </p>
          </div>
        )}
      </div>

      {state.status === "error" && state.message ? (
        <p className="mt-2 text-sm text-[#B42318]">{state.message}</p>
      ) : null}
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
