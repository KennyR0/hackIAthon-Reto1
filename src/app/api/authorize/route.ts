import { NextResponse } from "next/server";
import { z } from "zod";
import { runAuthorizationAgent } from "@/lib/agent";
import { getPolicyById } from "@/lib/notion";
import type { InsurancePolicy } from "@/types";

const reportSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  reportDate: z.string().min(1),
  diagnosis: z.string().min(1),
  procedure: z.string().min(1),
  urgency: z.enum(["Urgente", "Programada"]),
  policyId: z.string().min(1),
});

const authorizationRequestSchema = z.object({
  report: reportSchema,
});

type NotionPropertyMap = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function getTitleOrRichText(props: NotionPropertyMap, propertyName: string) {
  const property = props[propertyName];

  if (!isRecord(property)) {
    return "";
  }

  const textItems = Array.isArray(property.rich_text)
    ? property.rich_text
    : Array.isArray(property.title)
      ? property.title
      : [];

  return textItems
    .map((item) => {
      const text = getNestedRecord(item, "text");
      return typeof text?.content === "string" ? text.content : "";
    })
    .join("");
}

function getDate(props: NotionPropertyMap, propertyName: string) {
  const date = getNestedRecord(props[propertyName], "date");
  return typeof date?.start === "string" ? date.start : "";
}

function getNumber(props: NotionPropertyMap, propertyName: string) {
  const property = props[propertyName];

  if (!isRecord(property)) {
    return 0;
  }

  return typeof property.number === "number" ? property.number : 0;
}

function getSelectName(props: NotionPropertyMap, propertyName: string) {
  const select = getNestedRecord(props[propertyName], "select");
  return typeof select?.name === "string" ? select.name : "";
}

function getMultiSelectNames(props: NotionPropertyMap, propertyName: string) {
  const property = props[propertyName];

  if (!isRecord(property) || !Array.isArray(property.multi_select)) {
    return [];
  }

  return property.multi_select
    .map((item) => (isRecord(item) && typeof item.name === "string" ? item.name : ""))
    .filter(Boolean);
}

function mapPolicyFromNotion(
  policyId: string,
  properties: NotionPropertyMap,
): InsurancePolicy {
  const plan = getSelectName(properties, "Plan");

  return {
    policyId,
    holderName: getTitleOrRichText(properties, "Titular"),
    validFrom: getDate(properties, "Vigencia Desde"),
    validUntil: getDate(properties, "Vigencia Hasta"),
    waitingPeriodDays: getNumber(properties, "Periodo Carencia"),
    coverages: getMultiSelectNames(properties, "Coberturas"),
    exclusions: getTitleOrRichText(properties, "Exclusiones"),
    maxSurgicalCoverage: getNumber(properties, "Tope Quirúrgico"),
    plan: plan === "Plus" || plan === "Premium" ? plan : "Básico",
  };
}

function getNotionProperties(page: unknown): NotionPropertyMap {
  if (!isRecord(page) || !isRecord(page.properties)) {
    throw new Error("La página de póliza no tiene propiedades válidas");
  }

  return page.properties;
}

export async function POST(request: Request) {
  try {
    const body = authorizationRequestSchema.parse(await request.json());
    const policyPage = await getPolicyById(body.report.policyId);

    if (!policyPage) {
      return NextResponse.json(
        { error: `Póliza "${body.report.policyId}" no encontrada` },
        { status: 404 },
      );
    }

    const policy = mapPolicyFromNotion(
      body.report.policyId,
      getNotionProperties(policyPage),
    );
    const result = await runAuthorizationAgent(body.report, policy);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Solicitud inválida", details: error.flatten() },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Error interno del servidor";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
