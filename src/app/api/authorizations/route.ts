import { NextResponse } from "next/server";
import { listAuthorizationResults } from "@/lib/notion";

export const runtime = "nodejs";

export async function GET() {
  try {
    const authorizations = await listAuthorizationResults();

    return NextResponse.json({ authorizations }, { status: 200 });
  } catch (error) {
    console.error("Error consultando historial de preautorizaciones:", error);

    return NextResponse.json(
      { error: "No se pudo consultar el historial de preautorizaciones." },
      { status: 500 },
    );
  }
}
