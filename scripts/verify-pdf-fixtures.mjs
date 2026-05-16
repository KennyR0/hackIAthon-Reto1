import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const fixturesDir = path.join(rootDir, "public", "test-pdfs");

const minUsefulChars = 120;
const maxTextCharsForLlm = 12_000;

function cleanPdfText(text) {
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

async function extractPdfText(filePath) {
  const buffer = await readFile(filePath);
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  const document = await loadingTask.promise;
  const pageTexts = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);

      try {
        const content = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        pageTexts.push(
          content.items
            .filter((item) => typeof item.str === "string")
            .map((item) => item.str)
            .join("\n"),
        );
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await document.destroy();
  }

  return cleanPdfText(pageTexts.join("\n\n")).slice(0, maxTextCharsForLlm);
}

const files = (await readdir(fixturesDir))
  .filter((file) => file.endsWith(".pdf"))
  .sort();

let failed = false;

for (const file of files) {
  const filePath = path.join(fixturesDir, file);

  try {
    const text = await extractPdfText(filePath);
    const usefulChars = text.replace(/\s/g, "").length;
    const roughTokens = Math.ceil(text.length / 4);

    if (usefulChars < minUsefulChars) {
      failed = true;
      console.error(
        `FAIL ${file}: only ${usefulChars} useful chars extracted.`,
      );
      continue;
    }

    console.log(
      `OK ${file}: ${text.length} chars, ~${roughTokens} tokens for LLM.`,
    );
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${file}: ${message}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
