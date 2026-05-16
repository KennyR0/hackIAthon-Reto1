import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const outputDir = join(process.cwd(), "public", "test-pdfs");

const cases = [
  {
    file: "caso-1-informe-aprobado.pdf",
    title: "Informe medico hospitalario - Caso aprobado",
    lines: [
      "Hospital Metropolitano Quito",
      "Informe preoperatorio de especialista",
      "Paciente: Maria Fernanda Alvarez Torres",
      "Cedula: 0987654321",
      "Historia clinica: HC-2026-001",
      "Fecha de emision: 2026-05-10",
      "Poliza: POL-APROBADA-001",
      "Diagnostico principal: Apendicitis cronica con dolor recurrente en fosa iliaca derecha.",
      "Diagnosticos secundarios: dolor abdominal cronico; episodios recurrentes de nausea.",
      "Procedimiento solicitado: Apendicectomia laparoscopica electiva.",
      "Urgencia: Programada. Paciente estable, sin signos de abdomen agudo ni riesgo vital.",
      "Medico tratante: Dra. Andrea Salazar, Cirugia General.",
    ],
  },
  {
    file: "caso-1-poliza-aprobada.pdf",
    title: "Poliza de seguro de salud - Caso aprobado",
    lines: [
      "Aseguradora: Saludsa Ecuador",
      "Numero de poliza: POL-APROBADA-001",
      "Titular: Maria Fernanda Alvarez Torres",
      "Vigencia desde: 2025-01-01",
      "Vigencia hasta: 2026-12-31",
      "Plan: Premium",
      "Periodo de carencia para cirugias electivas: 60 dias.",
      "Coberturas: Cirugia General, Cirugia Laparoscopica, Urologia, Ginecologia y Obstetricia, Oftalmologia.",
      "Tope quirurgico maximo: USD 25000.",
      "Exclusiones: cirugia estetica o cosmetica, tratamientos experimentales no aprobados por ARCSA, condiciones preexistentes no declaradas durante los primeros dos anos.",
    ],
  },
  {
    file: "caso-2-informe-urgente.pdf",
    title: "Informe medico hospitalario - Caso urgente",
    lines: [
      "Hospital General IESS Quito Sur",
      "Epicrisis e informe de emergencia quirurgica",
      "Paciente: Carlos Andres Mendoza Ruiz",
      "Cedula: 1122334455",
      "Fecha de emision: 2026-05-12",
      "Afiliacion / poliza: POL-URGENTE-002",
      "Diagnostico principal: Apendicitis aguda perforada con peritonitis generalizada.",
      "Paciente presenta fiebre, defensa abdominal, sepsis incipiente y riesgo vital.",
      "Procedimiento solicitado: Laparotomia exploratoria de emergencia con apendicectomia y lavado peritoneal.",
      "Urgencia: Urgente. Requiere intervencion inmediata, no puede esperar por riesgo de muerte.",
      "Medico tratante: Dr. Pablo Ortega, Cirugia General.",
    ],
  },
  {
    file: "caso-2-poliza-carencia.pdf",
    title: "Poliza de seguro de salud - Caso urgente",
    lines: [
      "Aseguradora: Ecuasanitas",
      "Numero de poliza: POL-URGENTE-002",
      "Titular: Carlos Andres Mendoza Ruiz",
      "Vigencia desde: 2026-04-01",
      "Vigencia hasta: 2027-03-31",
      "Plan: Basico",
      "Periodo de carencia para cirugias electivas: 180 dias.",
      "Coberturas: Cirugia General, Cirugia Laparoscopica, Urologia, Otorrinolaringologia.",
      "Servicios de emergencia cubiertos desde el inicio de vigencia.",
      "Tope quirurgico maximo: USD 12000.",
      "Exclusiones: cirugia estetica, tratamientos experimentales, complicaciones de procedimientos no autorizados.",
    ],
  },
  {
    file: "caso-3-informe-rechazado.pdf",
    title: "Informe medico hospitalario - Caso rechazado",
    lines: [
      "Clinica San Francisco",
      "Informe preoperatorio de traumatologia",
      "Paciente: Ana Isabel Torres Vega",
      "Cedula: 5566778899",
      "Historia clinica: HC-TRA-7788",
      "Fecha de emision: 2026-05-11",
      "Poliza: POL-RECHAZADA-003",
      "Diagnostico principal: Ruptura de ligamento cruzado anterior de rodilla derecha.",
      "Procedimiento solicitado: Reconstruccion artroscopica de ligamento cruzado anterior con injerto.",
      "Urgencia: Programada. No existe emergencia, trauma reciente grave, shock ni riesgo vital inmediato.",
      "Medico tratante: Dr. Esteban Molina, Ortopedia y Traumatologia.",
    ],
  },
  {
    file: "caso-3-poliza-sin-cobertura.pdf",
    title: "Poliza de seguro de salud - Caso rechazado",
    lines: [
      "Aseguradora: Humana Ecuador",
      "Numero de poliza: POL-RECHAZADA-003",
      "Titular: Ana Isabel Torres Vega",
      "Vigencia desde: 2025-08-01",
      "Vigencia hasta: 2026-07-31",
      "Plan: Basico",
      "Periodo de carencia para cirugias electivas: 180 dias.",
      "Coberturas: Cirugia General, Cirugia Laparoscopica, Medicina Interna, Urologia, Oftalmologia.",
      "No incluye Ortopedia y Traumatologia ni procedimientos artroscopicos de rodilla.",
      "Tope quirurgico maximo: USD 10000.",
      "Exclusiones: procedimientos fuera de cobertura contratada, cirugia estetica, tratamientos experimentales no aprobados.",
    ],
  },
];

function wrapLine(line, maxLength = 88) {
  const words = line.split(" ");
  const output = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }

  if (current) {
    output.push(current);
  }

  return output;
}

async function createPdf({ file, lines, title }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 730;

  page.drawText(title, {
    x: 48,
    y,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.46, 0.43),
  });

  y -= 34;

  for (const line of lines) {
    for (const wrapped of wrapLine(line)) {
      if (y < 60) {
        page = doc.addPage([612, 792]);
        y = 730;
      }

      page.drawText(wrapped, {
        x: 48,
        y,
        size: 11,
        font,
        color: rgb(0.07, 0.2, 0.24),
      });
      y -= 18;
    }
    y -= 6;
  }

  const bytes = await doc.save();
  await writeFile(join(outputDir, file), bytes);
}

await mkdir(outputDir, { recursive: true });
await Promise.all(cases.map(createPdf));

console.log(`PDFs generados en ${outputDir}`);
for (const item of cases) {
  console.log(`- ${item.file}`);
}
