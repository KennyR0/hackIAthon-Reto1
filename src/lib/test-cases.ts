export type TestCaseFile = {
  label: string;
  href: string;
};

export type TestCase = {
  id: string;
  label: string;
  title: string;
  description: string;
  expectedResult: string;
  files: TestCaseFile[];
};

export const testCases: TestCase[] = [
  {
    id: "caso-1",
    label: "Caso 1",
    title: "Aprobado",
    description: "Cobertura vigente para cirugia general.",
    expectedResult: "Tarjeta verde y PDF de preaprobacion.",
    files: [
      {
        label: "Informe medico",
        href: "/test-pdfs/caso-1-informe-aprobado.pdf",
      },
      {
        label: "Poliza de seguro",
        href: "/test-pdfs/caso-1-poliza-aprobada.pdf",
      },
    ],
  },
  {
    id: "caso-2",
    label: "Caso 2",
    title: "Urgente con carencia",
    description: "Emergencia clinica con validacion de carencia.",
    expectedResult: "Decision aprobada por urgencia vital.",
    files: [
      {
        label: "Informe medico",
        href: "/test-pdfs/caso-2-informe-urgente.pdf",
      },
      {
        label: "Poliza de seguro",
        href: "/test-pdfs/caso-2-poliza-carencia.pdf",
      },
    ],
  },
  {
    id: "caso-3",
    label: "Caso 3",
    title: "Rechazado",
    description: "Procedimiento fuera de cobertura.",
    expectedResult: "Tarjeta roja con justificacion administrativa.",
    files: [
      {
        label: "Informe medico",
        href: "/test-pdfs/caso-3-informe-rechazado.pdf",
      },
      {
        label: "Poliza de seguro",
        href: "/test-pdfs/caso-3-poliza-sin-cobertura.pdf",
      },
    ],
  },
  {
    id: "caso-4",
    label: "Caso 4",
    title: "Documento faltante",
    description:
      "Cirugia de columna cubierta, pero con soporte diagnostico pendiente para auditoria.",
    expectedResult:
      "Caso con documento faltante para probar la pestaña de preautorizaciones y la carga complementaria.",
    files: [
      {
        label: "Informe medico",
        href: "/test-pdfs/caso-4-informe-documento-faltante.pdf",
      },
      {
        label: "Poliza de seguro",
        href: "/test-pdfs/caso-4-poliza-requiere-resonancia.pdf",
      },
      {
        label: "Documento complementario",
        href: "/test-pdfs/caso-4-resonancia-complementaria.pdf",
      },
    ],
  },
];

export const specialTestCases: TestCase[] = [
  {
    id: "especial-externo-ecuador",
    label: "Especial 1",
    title: "Documentos externos Ecuador",
    description:
      "Informe medico y poliza externos que no coinciden perfectamente con los formatos simulados del sistema.",
    expectedResult:
      "Prueba de robustez: el agente debe extraer la informacion disponible, manejar ambiguedades y emitir una decision trazable.",
    files: [
      {
        label: "Informe medico externo",
        href: "/test-pdfs/especial-informe-medico-ecuador.pdf",
      },
      {
        label: "Poliza externa",
        href: "/test-pdfs/especial-poliza-salud-ecuador.pdf",
      },
    ],
  },
];
