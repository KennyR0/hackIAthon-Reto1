import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  GlobalWorkerOptions,
  getDocument,
  VerbosityLevel,
} from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_USEFUL_TEXT_CHARS = 120;
const MAX_TEXT_CHARS_FOR_LLM = 12_000;

let workerConfigured = false;

type PdfTextItem = {
  str: string;
};

type PdfDocumentOptions = Parameters<typeof getDocument>[0] & {
  disableWorker?: boolean;
};

function configurePdfWorker() {
  if (workerConfigured) {
    return;
  }

  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs",
  );
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  workerConfigured = true;
}

/**
 * Extracts normalized text from a digital PDF buffer.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      "El archivo PDF supera el limite de 10 MB. Por favor sube una version reducida.",
    );
  }

  configurePdfWorker();

  const options: PdfDocumentOptions = {
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  };
  const loadingTask = getDocument(options);

  try {
    const document = await loadingTask.promise;
    const pageTexts: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);

        try {
          const content = await page.getTextContent({
            includeMarkedContent: false,
            disableNormalization: false,
          });
          pageTexts.push(extractPageText(content.items));
        } finally {
          page.cleanup();
        }
      }
    } finally {
      await document.destroy();
    }

    const cleanedText = limitTextForLlm(cleanPdfText(pageTexts.join("\n\n")));
    const usefulCharacters = cleanedText.replace(/\s/g, "").length;

    if (usefulCharacters < MIN_USEFUL_TEXT_CHARS) {
      throw new Error(
        "PDF escaneado detectado. Por favor sube una version digital del documento.",
      );
    }

    return cleanedText;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("PDF escaneado detectado")
    ) {
      throw error;
    }

    console.error("PDF text extraction failed:", error);
    throw new Error(
      "No se pudo extraer texto del PDF. Verifica que no este protegido con contrasena y que sea un PDF digital valido.",
    );
  }
}

function extractPageText(items: unknown[]): string {
  return items
    .filter((item): item is PdfTextItem => isTextItem(item))
    .map((item) => item.str)
    .join("\n");
}

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof item.str === "string"
  );
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

function limitTextForLlm(text: string): string {
  if (text.length <= MAX_TEXT_CHARS_FOR_LLM) {
    return text;
  }

  return text.slice(0, MAX_TEXT_CHARS_FOR_LLM).trim();
}
