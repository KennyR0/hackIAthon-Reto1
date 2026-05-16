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
];
