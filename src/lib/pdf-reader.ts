import { PDFParse } from "pdf-parse";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_USEFUL_TEXT_CHARS = 120;

/**
 * Extracts normalized text from a digital PDF buffer.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      "El archivo PDF supera el limite de 10 MB. Por favor sube una version reducida.",
    );
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    const cleanedText = cleanPdfText(result.text);
    const usefulCharacters = cleanedText.replace(/\s/g, "").length;

    if (usefulCharacters < MIN_USEFUL_TEXT_CHARS) {
      throw new Error(
        "PDF escaneado detectado. Por favor sube una version digital del documento.",
      );
    }

    return cleanedText;
  } finally {
    await parser.destroy();
  }
}

function cleanPdfText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
