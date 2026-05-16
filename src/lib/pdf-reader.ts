import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_USEFUL_TEXT_CHARS = 120;
const MAX_TEXT_CHARS_FOR_LLM = 12_000;

let workerConfigured = false;
let pdfjsModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;

type PdfTextItem = {
  str: string;
};

class MinimalDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  translate(x = 0, y = 0) {
    this.e += x;
    this.f += y;
    return this;
  }

  scale(scaleX = 1, scaleY = scaleX) {
    this.a *= scaleX;
    this.d *= scaleY;
    return this;
  }
}

class MinimalImageData {
  data: Uint8ClampedArray;
  height: number;
  width: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

class MinimalPath2D {}

function installPdfJsPolyfills() {
  const target = globalThis as Record<string, unknown>;

  target.DOMMatrix ??= MinimalDOMMatrix;
  target.ImageData ??= MinimalImageData;
  target.Path2D ??= MinimalPath2D;
}

async function loadPdfJs() {
  installPdfJsPolyfills();
  pdfjsModulePromise ??= importPdfJsWithoutCanvasWarnings();
  return pdfjsModulePromise;
}

async function importPdfJsWithoutCanvasWarnings() {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = String(args[0] ?? "");
    if (
      message.includes('Cannot load "@napi-rs/canvas"') ||
      message.includes("Cannot polyfill `DOMMatrix`") ||
      message.includes("Cannot polyfill `ImageData`") ||
      message.includes("Cannot polyfill `Path2D`")
    ) {
      return;
    }

    originalWarn(...args);
  };

  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } finally {
    console.warn = originalWarn;
  }
}

function configurePdfWorker(
  pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs"),
) {
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
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
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

  const pdfjs = await loadPdfJs();
  configurePdfWorker(pdfjs);

  const options = {
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker?: boolean };
  const loadingTask = pdfjs.getDocument(options);

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
