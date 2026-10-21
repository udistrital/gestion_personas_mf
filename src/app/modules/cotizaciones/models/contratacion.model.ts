/**
 * Modelos del paso 4 del asistente de solicitud (S-02).
 *
 * El paso 4 ("Tipo de contratación e información de pago") define la modalidad
 * jurídica del contrato, el medio y la forma de pago, y el cronograma
 * porcentual de desembolsos. Este módulo reúne los contratos, los catálogos y
 * los cálculos puros que comparten las dos vistas del mockup aprobado.
 */

/** Modalidad jurídica de contratación (tarjeta 1). */
export type TipoContrato =
  | "prestacion"
  | "suministro"
  | "obra"
  | "consultoria";

/** Medio de pago institucional (tarjeta 2). */
export type MedioPago =
  | "tarjeta_credito"
  | "transferencia_sebra"
  | "consignacion_bancaria"
  | "cheque_gerencia";

/** Forma de pago del contrato (tarjeta 2). */
export type TipoFormaPago = "pagos_parciales" | "contraentrega";

/** Opción de los selects del paso. */
export interface OpcionContratacion {
  readonly valor: string;
  readonly etiqueta: string;
  /** Etiqueta abreviada para chips y avisos; si falta se usa `etiqueta`. */
  readonly corta?: string;
}

/** Requisito verificable de un hito de pago (chip de la tabla del detalle). */
export interface EtapaRequisito {
  /** Icono Material del chip ("inventory_2"). */
  readonly icono: string;
  /** Texto corto del requisito ("Entrega en sitio"). */
  readonly etiqueta: string;
}

/** Parámetro de la forma de pago (una fila de la tarjeta 4). */
export interface ParametroPago {
  /** Identificador interno (para el seguimiento de la tabla). */
  readonly id: string;
  /** Hito o entregable que condiciona el desembolso. */
  readonly condicion: string;
  /** Porcentaje del valor pactado que se libera con la condición. */
  readonly porcentaje: number;
  /**
   * Nota explicativa del hito.
   *
   * La rellena el detalle (S-03, pestaña "Contratación y pago"); el asistente
   * de creación (S-02) la deja sin usar.
   */
  readonly nota?: string;
  /** Requisitos verificables que se pintan como chips en el detalle. */
  readonly requisitos?: readonly EtapaRequisito[];
}

/** Resumen porcentual de los parámetros agregados. */
export interface ResumenPagos {
  /** Número de parámetros registrados. */
  readonly cantidad: number;
  /** Suma de los porcentajes asignados. */
  readonly total: number;
  /** Porcentaje pendiente por asignar (100 − total). */
  readonly restante: number;
  /** true cuando la suma alcanza exactamente el 100 %. */
  readonly completo: boolean;
}

/** Tipos de contrato del catálogo institucional (mockup: tarjeta 1). */
export const TIPOS_CONTRATO: readonly OpcionContratacion[] = [
  {
    valor: "prestacion",
    etiqueta: "Prestación de servicios profesionales y de apoyo a la gestión",
  },
  {
    valor: "suministro",
    etiqueta: "Compraventa y suministro de bienes muebles",
  },
  {
    valor: "obra",
    etiqueta: "Contrato de obra o mantenimiento de infraestructura física",
  },
  {
    valor: "consultoria",
    etiqueta: "Consultoría e interventoría técnica institucional",
  },
];

/** Medios de pago admitidos por la Tesorería institucional (tarjeta 2). */
export const MEDIOS_PAGO: readonly OpcionContratacion[] = [
  {
    valor: "tarjeta_credito",
    etiqueta: "Tarjeta de crédito institucional",
    corta: "Tarjeta de crédito",
  },
  {
    valor: "transferencia_sebra",
    etiqueta: "Transferencia electrónica SEBRA / SIIF Nación",
    corta: "Transferencia SEBRA",
  },
  {
    valor: "consignacion_bancaria",
    etiqueta: "Consignación cuenta de ahorros/corriente bancaria",
    corta: "Consignación bancaria",
  },
  {
    valor: "cheque_gerencia",
    etiqueta: "Cheque de gerencia Tesorería Central",
    corta: "Cheque de gerencia",
  },
];

/** Formas de pago según el cronograma de desembolsos (tarjeta 2). */
export const FORMAS_PAGO: readonly OpcionContratacion[] = [
  {
    valor: "pagos_parciales",
    etiqueta: "Pagos parciales (Actas de recibo y entregables)",
    corta: "Pagos parciales",
  },
  {
    valor: "contraentrega",
    etiqueta: "Contraentrega (Pago único 100% al cumplimiento final)",
    corta: "Contraentrega",
  },
];

/** Porcentaje total que debe sumar la distribución de pagos. */
export const PORCENTAJE_TOTAL = 100;

/** Porcentaje mínimo asignable a un parámetro de pago. */
export const PORCENTAJE_MINIMO = 1;

/** Longitud mínima de la condición de pago (texto plano). */
export const MIN_CARACTERES_CONDICION = 20;

/** Referencia normativa del medio de pago (mockup aprobado). */
export const NORMA_MEDIO_PAGO =
  "Resolución 067 del 9 de febrero de 2017 de la Vicerrectoría Administrativa";

/** Regla de desembolso aplicable a cada forma de pago. */
export const REGLAS_DESEMBOLSO: Record<TipoFormaPago, string> = {
  pagos_parciales:
    "Los pagos parciales deben totalizar exactamente el 100% del valor pactado mediante condiciones de entrega verificables por la interventoría.",
  contraentrega:
    "La contraentrega exige un único desembolso del 100% del valor pactado contra el acta de recibo final a satisfacción de la interventoría.",
};

/** Etiqueta abreviada de una opción; recurre a la completa si no hay corta. */
export function etiquetaCorta(
  catalogo: readonly OpcionContratacion[],
  valor: string,
): string {
  const opcion = catalogo.find((item) => item.valor === valor);
  return opcion ? (opcion.corta ?? opcion.etiqueta) : "";
}

/** Regla de desembolso aplicable a la forma de pago elegida. */
export function reglaDesembolso(formaPago: string): string {
  return formaPago === "contraentrega"
    ? REGLAS_DESEMBOLSO.contraentrega
    : REGLAS_DESEMBOLSO.pagos_parciales;
}

/** Suma los porcentajes asignados a los parámetros de pago. */
export function sumarPorcentajes(
  parametros: readonly ParametroPago[],
): number {
  return parametros.reduce(
    (acumulado, parametro) => acumulado + Number(parametro.porcentaje || 0),
    0,
  );
}

/** Calcula el resumen porcentual de los parámetros agregados. */
export function calcularResumenPagos(
  parametros: readonly ParametroPago[],
): ResumenPagos {
  const total = sumarPorcentajes(parametros);
  return {
    cantidad: parametros.length,
    total,
    restante: Math.max(0, PORCENTAJE_TOTAL - total),
    completo: total === PORCENTAJE_TOTAL,
  };
}

/** Formatea un porcentaje sin decimales innecesarios ("50" / "12.5"). */
export function formatoPorcentajePago(valor: number): string {
  const numero = Number(valor) || 0;
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(1);
}
