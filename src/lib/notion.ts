import { Client } from "@notionhq/client";
import type { AuthorizationResult, InsurancePolicy, MedicalReport } from "@/types";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function getPrimaryDataSourceId(databaseId: string): Promise<string> {
  const database = await notion.databases.retrieve({ database_id: databaseId });

  if ("data_sources" in database && database.data_sources[0]) {
    return database.data_sources[0].id;
  }

  throw new Error(`No data source found for Notion database: ${databaseId}`);
}

export async function getMedicalReport(pageId: string) {
  return notion.pages.retrieve({ page_id: pageId });
}

export async function getPolicyById(policyId: string) {
  const dataSourceId = await getPrimaryDataSourceId(
    requireEnv("NOTION_POLICIES_DB_ID"),
  );

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: {
      property: "ID Póliza",
      title: { equals: policyId },
    },
  });

  return response.results[0] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProperties(page: unknown): Record<string, unknown> {
  if (!isRecord(page) || !isRecord(page.properties)) {
    throw new Error("La pagina de Notion no tiene propiedades validas.");
  }

  return page.properties;
}

function getPlainText(items: unknown): string {
  if (!Array.isArray(items)) {
    return "";
  }

  return items
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }

      if (typeof item.plain_text === "string") {
        return item.plain_text;
      }

      if (isRecord(item.text) && typeof item.text.content === "string") {
        return item.text.content;
      }

      return "";
    })
    .join("");
}

function getTextProperty(
  properties: Record<string, unknown>,
  propertyName: string,
): string {
  const property = properties[propertyName];

  if (!isRecord(property)) {
    return "";
  }

  return getPlainText(property.title ?? property.rich_text);
}

function getDateProperty(
  properties: Record<string, unknown>,
  propertyName: string,
): string {
  const property = properties[propertyName];
  if (!isRecord(property) || !isRecord(property.date)) {
    return "";
  }

  return typeof property.date.start === "string" ? property.date.start : "";
}

function getNumberProperty(
  properties: Record<string, unknown>,
  propertyName: string,
): number {
  const property = properties[propertyName];
  if (!isRecord(property)) {
    return 0;
  }

  return typeof property.number === "number" ? property.number : 0;
}

function getSelectProperty(
  properties: Record<string, unknown>,
  propertyName: string,
): string {
  const property = properties[propertyName];
  if (!isRecord(property) || !isRecord(property.select)) {
    return "";
  }

  return typeof property.select.name === "string" ? property.select.name : "";
}

function getMultiSelectProperty(
  properties: Record<string, unknown>,
  propertyName: string,
): string[] {
  const property = properties[propertyName];
  if (!isRecord(property) || !Array.isArray(property.multi_select)) {
    return [];
  }

  return property.multi_select
    .map((item) =>
      isRecord(item) && typeof item.name === "string" ? item.name : "",
    )
    .filter(Boolean);
}

function normalizePlan(plan: string): InsurancePolicy["plan"] {
  if (plan === "Plus" || plan === "Premium") {
    return plan;
  }

  return "Básico";
}

function normalizeUrgency(urgency: string): MedicalReport["urgency"] {
  return urgency === "Urgente" ? "Urgente" : "Programada";
}

export async function getMedicalReportRecord(
  pageId: string,
): Promise<MedicalReport> {
  const page = await getMedicalReport(pageId);
  const properties = getProperties(page);

  return {
    patientName: getTextProperty(properties, "Nombre Paciente"),
    patientId: getTextProperty(properties, "ID Paciente"),
    reportDate: getDateProperty(properties, "Fecha Informe"),
    diagnosis: getTextProperty(properties, "Diagnóstico"),
    procedure: getTextProperty(properties, "Procedimiento"),
    urgency: normalizeUrgency(getSelectProperty(properties, "Urgencia")),
    policyId: getTextProperty(properties, "ID Póliza"),
  };
}

export async function getInsurancePolicyRecord(
  pageId: string,
): Promise<InsurancePolicy> {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const properties = getProperties(page);

  return {
    policyId: getTextProperty(properties, "ID Póliza"),
    holderName: getTextProperty(properties, "Titular"),
    validFrom: getDateProperty(properties, "Vigencia Desde"),
    validUntil: getDateProperty(properties, "Vigencia Hasta"),
    waitingPeriodDays: getNumberProperty(properties, "Periodo Carencia"),
    coverages: getMultiSelectProperty(properties, "Coberturas"),
    exclusions: getTextProperty(properties, "Exclusiones"),
    maxSurgicalCoverage: getNumberProperty(properties, "Tope Quirúrgico"),
    plan: normalizePlan(getSelectProperty(properties, "Plan")),
  };
}

function richText(content: string) {
  return [{ text: { content: content.slice(0, 2_000) } }];
}

async function uploadFileToNotion({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<string> {
  const upload = await notion.fileUploads.create({
    filename: fileName,
    content_type: contentType,
  });

  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  await notion.fileUploads.send({
    file_upload_id: upload.id,
    file: {
      filename: fileName,
      data: blob,
    },
  });

  return upload.id;
}

export async function createInsurancePolicyRecord(
  policy: InsurancePolicy,
): Promise<string> {
  const response = await notion.pages.create({
    parent: { database_id: requireEnv("NOTION_POLICIES_DB_ID") },
    properties: {
      "ID Póliza": { title: richText(policy.policyId || "SIN-POLIZA") },
      Titular: { rich_text: richText(policy.holderName) },
      "Vigencia Desde": { date: { start: policy.validFrom } },
      "Vigencia Hasta": { date: { start: policy.validUntil } },
      "Periodo Carencia": { number: policy.waitingPeriodDays },
      Coberturas: {
        multi_select: policy.coverages.map((coverage) => ({ name: coverage })),
      },
      Exclusiones: { rich_text: richText(policy.exclusions) },
      "Tope Quirúrgico": { number: policy.maxSurgicalCoverage },
      Plan: { select: { name: policy.plan } },
    },
  });

  return response.id;
}

export async function createMedicalReportRecord({
  pdfBuffer,
  pdfFileName,
  report,
}: {
  pdfBuffer: Buffer;
  pdfFileName: string;
  report: MedicalReport;
}): Promise<string> {
  const fileUploadId = await uploadFileToNotion({
    buffer: pdfBuffer,
    contentType: "application/pdf",
    fileName: pdfFileName,
  });

  const response = await notion.pages.create({
    parent: { database_id: requireEnv("NOTION_REPORTS_DB_ID") },
    properties: {
      "Nombre Paciente": { title: richText(report.patientName || "SIN-NOMBRE") },
      "ID Paciente": { rich_text: richText(report.patientId) },
      "Fecha Informe": { date: { start: report.reportDate } },
      Diagnóstico: { rich_text: richText(report.diagnosis) },
      Procedimiento: { rich_text: richText(report.procedure) },
      Urgencia: { select: { name: report.urgency } },
      "PDF Informe": {
        files: [
          {
            type: "file_upload",
            file_upload: { id: fileUploadId },
            name: pdfFileName,
          },
        ],
      },
      Estado: { select: { name: "Procesado" } },
      "ID Póliza": { rich_text: richText(report.policyId) },
    },
  });

  return response.id;
}

export async function createAuthorizationResult(data: {
  patientId: string;
  policyId: string;
  decision: AuthorizationResult["decision"];
  cie10: string;
  cpt: string;
  justification: string;
  missingDocs?: string;
  isUrgent: boolean;
}) {
  const response = await notion.pages.create({
    parent: { database_id: requireEnv("NOTION_RESULTS_DB_ID") },
    properties: {
      Caso: { title: [{ text: { content: `CASO-${Date.now()}` } }] },
      "ID Paciente": { rich_text: [{ text: { content: data.patientId } }] },
      "ID Póliza": { rich_text: [{ text: { content: data.policyId } }] },
      Decisión: { select: { name: data.decision } },
      "Código CIE-10": { rich_text: [{ text: { content: data.cie10 } }] },
      "Código CPT/CUPS": { rich_text: [{ text: { content: data.cpt } }] },
      Justificación: {
        rich_text: [{ text: { content: data.justification } }],
      },
      "Documentos Faltantes": {
        rich_text: [{ text: { content: data.missingDocs ?? "" } }],
      },
      "Fecha Decisión": { date: { start: new Date().toISOString() } },
      Urgente: { checkbox: data.isUrgent },
    },
  });

  return response.id;
}

export async function appendAuthorizationValidation(data: {
  resultPageId: string;
  status: "Validada" | "No validada";
}) {
  return notion.blocks.children.append({
    block_id: data.resultPageId,
    children: [
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: richText(
            `Validacion humana: ${data.status} - ${new Date().toISOString()}`,
          ),
          color: data.status === "Validada" ? "green_background" : "red_background",
        },
      },
    ],
  });
}
