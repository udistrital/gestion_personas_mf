import { PasoStepperVisual } from "src/app/shared/components/stepper-visual/stepper-visual.component";

/**
 * Pasos canónicos del asistente de solicitud de cotización (S-02).
 *
 * Los nombres provienen de `docs/propuesta.md`; los subtítulos replican el
 * mockup aprobado del paso 1. Los pasos 1 a 5 ya replican sus mockups.
 */
export const PASOS_SOLICITUD: PasoStepperVisual[] = [
  {
    numero: 1,
    nombre: "Necesidad y presupuesto",
    subtitulo: "Cruce SICAPITAL",
  },
  { numero: 2, nombre: "Datos generales", subtitulo: "Cronograma y plan" },
  { numero: 3, nombre: "Ítems", subtitulo: "Ficha técnica" },
  {
    numero: 4,
    nombre: "Contratación y pago",
    subtitulo: "Plazos y desembolso",
  },
  { numero: 5, nombre: "Proveedores objetivo", subtitulo: "Segmento objetivo" },
  { numero: 6, nombre: "Documentos", subtitulo: "Estudios previos" },
  { numero: 7, nombre: "Revisión y procesar", subtitulo: "Finalizar y publicar" },
];
