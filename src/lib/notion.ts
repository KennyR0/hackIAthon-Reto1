import { Client } from "@notionhq/client";
import type { AuthorizationResult } from "@/types";

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
  return notion.pages.create({
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
}
