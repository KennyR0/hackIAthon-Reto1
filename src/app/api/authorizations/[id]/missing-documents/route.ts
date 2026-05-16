import { NextResponse } from "next/server";
import {
  getAuthorizationResultRecord,
  updateAuthorizationAfterSupplement,
} from "@/lib/notion";
import { extractPdfText } from "@/lib/pdf-reader";
import { reevaluateAuthorizationWithSupplement } from "@/lib/steps/reevaluate-authorization";

export const maxDuration = 30;
export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("document");
    const note = formData.get("note");

    if (!id) {
      return NextResponse.json(
        { error: "No se encontro el caso a actualizar." },
        { status: 400 },
      );
    }

    if (!isPdfFile(file)) {
      return NextResponse.json(
        { error: "Se requiere un documento PDF complementario." },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo se aceptan archivos PDF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El PDF complementario supera el limite de 10 MB." },
        { status: 413 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const [authorization, supplementalText] = await Promise.all([
      getAuthorizationResultRecord(id),
      extractPdfText(fileBuffer),
    ]);
    const reevaluation = await reevaluateAuthorizationWithSupplement(
      authorization,
      supplementalText,
    );

    await updateAuthorizationAfterSupplement({
      resultPageId: id,
      fileBuffer,
      fileName: file.name || "documento_complementario.pdf",
      decision: reevaluation.decision,
      justification: reevaluation.justification,
      missingDocuments: reevaluation.missingDocuments ?? [],
      note: typeof note === "string" ? note : undefined,
    });

    return NextResponse.json({ ok: true, result: reevaluation }, { status: 200 });
  } catch (error) {
    console.error("Error reevaluando documentacion faltante:", error);

    return NextResponse.json(
      { error: "No se pudo reevaluar y actualizar el caso en la base de datos." },
      { status: 500 },
    );
  }
}
