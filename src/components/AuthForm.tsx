"use client";

import { Activity, CalendarClock, FileText, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { MedicalReport } from "@/types";

export type AuthFormData = Pick<
  MedicalReport,
  "patientId" | "patientName" | "policyId" | "diagnosis" | "procedure" | "urgency"
>;

type AuthFormProps = {
  loading: boolean;
  onSubmit: (data: AuthFormData) => void;
};

export default function AuthForm({ loading, onSubmit }: AuthFormProps) {
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [procedure, setProcedure] = useState("");
  const [urgency, setUrgency] = useState<MedicalReport["urgency"]>("Programada");

  const isReady = [patientId, patientName, policyId, diagnosis, procedure].every(
    (value) => value.trim().length > 0,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isReady || loading) {
      return;
    }

    onSubmit({
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      policyId: policyId.trim(),
      diagnosis: diagnosis.trim(),
      procedure: procedure.trim(),
      urgency,
    });
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
          <h2 className="text-lg font-semibold text-[#12323C]">Datos del caso</h2>
          <p className="mt-1 text-sm leading-6 text-[#5C7379]">
            Registre la solicitud quirurgica para emitir la decision administrativa.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            icon={<UserRound aria-hidden="true" size={16} />}
            label="ID paciente"
            onChange={setPatientId}
            placeholder="0987654321"
            value={patientId}
          />
          <TextField
            icon={<UserRound aria-hidden="true" size={16} />}
            label="Nombre paciente"
            onChange={setPatientName}
            placeholder="Maria Alvarez"
            value={patientName}
          />
        </div>

        <TextField
          icon={<ShieldCheck aria-hidden="true" size={16} />}
          label="ID poliza"
          onChange={setPolicyId}
          placeholder="POL-2024-001"
          value={policyId}
        />

        <TextareaField
          label="Diagnostico medico"
          onChange={setDiagnosis}
          placeholder="Apendicitis cronica con dolor recurrente en fosa iliaca derecha"
          value={diagnosis}
        />

        <TextareaField
          label="Procedimiento solicitado"
          onChange={setProcedure}
          placeholder="Apendicectomia laparoscopica electiva"
          value={procedure}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-[#264B55]">
            Tipo de caso
          </label>
          <div className="grid grid-cols-2 rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-1">
            {(["Programada", "Urgente"] as const).map((option) => (
              <button
                className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors ${
                  urgency === option
                    ? option === "Urgente"
                      ? "bg-[#FDECEC] text-[#B42318] shadow-sm"
                      : "bg-white text-[#0E766E] shadow-sm"
                    : "text-[#5C7379] hover:bg-white/70"
                }`}
                key={option}
                onClick={() => setUrgency(option)}
                type="button"
              >
                {option === "Urgente" ? (
                  <Activity aria-hidden="true" size={16} />
                ) : (
                  <CalendarClock aria-hidden="true" size={16} />
                )}
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-[#0E766E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0B625C] disabled:cursor-not-allowed disabled:bg-[#B7CBC7]"
        disabled={!isReady || loading}
        type="submit"
      >
        {loading ? "Analizando caso..." : "Analizar y emitir decision"}
      </button>
    </form>
  );
}

function TextField({
  icon,
  label,
  onChange,
  placeholder,
  value,
}: {
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#264B55]">{label}</label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-[#D6E5E2] bg-white px-3 text-[#7A9095] focus-within:border-[#0E766E] focus-within:ring-2 focus-within:ring-[#BFE3DD]">
        {icon}
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-[#12323C] outline-none placeholder:text-[#8BA0A5]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </div>
    </div>
  );
}

function TextareaField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#264B55]">{label}</label>
      <textarea
        className="min-h-28 w-full resize-none rounded-lg border border-[#D6E5E2] bg-white px-3 py-3 text-sm leading-6 text-[#12323C] outline-none placeholder:text-[#8BA0A5] focus:border-[#0E766E] focus:ring-2 focus:ring-[#BFE3DD]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
