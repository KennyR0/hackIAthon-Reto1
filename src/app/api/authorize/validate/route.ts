import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAuthorizationValidation } from "@/lib/notion";

const validationSchema = z.object({
  resultPageId: z.string().min(1),
  status: z.enum(["validada", "no-validada"]),
});

export async function POST(request: Request) {
  try {
    const body = validationSchema.parse(await request.json());

    await appendAuthorizationValidation({
      resultPageId: body.resultPageId,
      status: body.status === "validada" ? "Validada" : "No validada",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Solicitud de validacion invalida." },
        { status: 400 },
      );
    }

    console.error("Error guardando validacion de preautorizacion:", error);
    return NextResponse.json(
      { error: "No se pudo guardar la validacion en Notion." },
      { status: 500 },
    );
  }
}
