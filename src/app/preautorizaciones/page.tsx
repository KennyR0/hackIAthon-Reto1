import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, History, Stethoscope } from "lucide-react";
import PreauthorizationsManager from "@/components/PreauthorizationsManager";

export const metadata: Metadata = {
  title: "Preautorizaciones | Agente de Pre-Autorizacion",
  description:
    "Bandeja operativa para revisar preautorizaciones y cargar documentacion faltante.",
};

export default function PreauthorizationsPage() {
  return (
    <main className="min-h-screen bg-[#F6FAF9] text-[#12323C]">
      <section className="border-b border-[#D6E5E2] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0E766E] hover:text-[#0B625C]"
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={17} />
            Volver al agente
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#BFE3DD] bg-[#E6F3F1] px-3 py-2 text-sm font-semibold text-[#0E766E]">
                <Stethoscope aria-hidden="true" size={16} />
                Gestion administrativa
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#12323C] sm:text-4xl">
                Preautorizaciones
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#5C7379]">
                Bandeja profesional para consultar casos emitidos y completar
                documentacion faltante en la base de datos.
              </p>
            </div>

            <div className="rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
              <History aria-hidden="true" className="text-[#0E766E]" size={22} />
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#7A9095]">
                Flujo
              </p>
              <p className="mt-1 text-sm font-semibold text-[#12323C]">
                Seguimiento y subsanacion
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <PreauthorizationsManager />
      </section>
    </main>
  );
}
