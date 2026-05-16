import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Shield, Stethoscope } from "lucide-react";
import { testCases, type TestCaseFile } from "@/lib/test-cases";

export const metadata: Metadata = {
  title: "Casos de prueba | Agente de Pre-Autorizacion",
  description:
    "Catalogo de PDFs para probar el agente de pre-autorizacion quirurgica.",
};

export default function TestCasesPage() {
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
                Documentos de simulacion
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[#12323C] sm:text-4xl">
                Casos de prueba
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#5C7379]">
                Descarga un informe medico y una poliza de seguro por caso para
                validar los diferentes resultados del agente.
              </p>
            </div>

            <div className="rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7A9095]">
                Total disponible
              </p>
              <p className="mt-1 text-2xl font-bold text-[#12323C]">
                {testCases.length} casos
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-6 md:grid-cols-2 xl:grid-cols-3 lg:px-8">
        {testCases.map((testCase) => (
          <article
            className="rounded-lg border border-[#D6E5E2] bg-white p-5 shadow-sm"
            key={testCase.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#0E766E]">
                  {testCase.label}
                </p>
                <h2 className="mt-2 text-xl font-bold text-[#12323C]">
                  {testCase.title}
                </h2>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E6F3F1] text-[#0E766E]">
                <FileText aria-hidden="true" size={22} />
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#5C7379]">
              {testCase.description}
            </p>

            <div className="mt-4 rounded-lg border border-[#D6E5E2] bg-[#F6FAF9] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7A9095]">
                Resultado esperado
              </p>
              <p className="mt-1 text-sm font-semibold text-[#12323C]">
                {testCase.expectedResult}
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              {testCase.files.map((file) => (
                <DownloadLink file={file} key={file.href} />
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function DownloadLink({ file }: { file: TestCaseFile }) {
  const isPolicy = file.label.toLowerCase().includes("poliza");
  const Icon = isPolicy ? Shield : FileText;

  return (
    <a
      className="inline-flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#BFE3DD] bg-[#E6F3F1] px-3 py-2 text-sm font-semibold text-[#0E766E] transition-colors hover:border-[#0E766E] hover:bg-[#D6EDEA]"
      download
      href={file.href}
    >
      <span className="inline-flex items-center gap-2">
        <Icon aria-hidden="true" size={18} />
        {file.label}
      </span>
      <Download aria-hidden="true" size={17} />
    </a>
  );
}
