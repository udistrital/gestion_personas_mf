/**
 * Modelos del paso 3 del asistente de solicitud (S-02).
 *
 * El paso 3 ("Bienes y servicios a cotizar") admite dos formas de registro
 * —individual y cargue masivo por plantilla— y una vista de resultado tras el
 * cargue. Este módulo reúne los contratos, los catálogos y los cálculos puros
 * que comparten esas tres vistas.
 */

/** Naturaleza de un ítem: bien tangible o servicio. */
export type TipoItem = "bien" | "servicio";

/** Forma de registro elegida por el solicitante (tarjeta 1). */
export type ModoRegistro = "individual" | "masivo";

/** Clasificación automática de la solicitud según los ítems agregados. */
export type TipoNecesidadSolicitud = "bienes" | "servicios" | "mixta";

/** Ítem del pliego de cotización. */
export interface ItemSolicitud {
  /** Identificador interno (para el seguimiento de la tabla). */
  readonly id: string;
  readonly tipo: TipoItem;
  readonly nombre: string;
  /** Descripción y ficha técnica (texto plano). */
  readonly descripcion: string;
  readonly unidad: string;
  readonly cantidad: number;
  /** Código UNSPSC (solo lo aportan los ítems del cargue masivo). */
  readonly codigoUnspsc?: string;
  /**
   * Nota corta de la ficha ("Garantía 36 meses NBD").
   *
   * La rellenan los mockups del detalle (S-03, pestaña "Ítems"); el asistente
   * de creación (S-02) la deja sin usar.
   */
  readonly notaTecnica?: string;
  /** Icono Material de la nota ("format_image_left"); por defecto `verified`. */
  readonly iconoNota?: string;
  /** Etiquetas de especificaciones que se pintan como chips en el detalle. */
  readonly especificaciones?: readonly string[];
}

/** Opción de los selects y del selector segmentado. */
export interface OpcionItem {
  readonly valor: string;
  readonly etiqueta: string;
  /** Icono Material representativo (clásicos, ya disponibles). */
  readonly icono: string;
}

/** Unidades de medida homologadas (mockup: catálogo DANE/UD). */
export const UNIDADES_MEDIDA: readonly OpcionItem[] = [
  { valor: "Unidad", etiqueta: "Unidad (Und.)", icono: "category" },
  { valor: "Caja", etiqueta: "Caja", icono: "category" },
  { valor: "Metro", etiqueta: "Metro", icono: "category" },
  { valor: "Kilogramo", etiqueta: "Kilogramo", icono: "category" },
  { valor: "Servicio", etiqueta: "Servicio", icono: "category" },
  { valor: "Licencia", etiqueta: "Licencia", icono: "category" },
  { valor: "Punto", etiqueta: "Punto", icono: "category" },
  { valor: "Suscripción", etiqueta: "Suscripción", icono: "category" },
];

/** Tipos de ítem del selector segmentado (tarjeta 1). */
export const TIPOS_ITEM: readonly OpcionItem[] = [
  { valor: "bien", etiqueta: "Bien", icono: "devices" },
  { valor: "servicio", etiqueta: "Servicio", icono: "build" },
];

/**
 * Estructura esperada por el parser del cargue masivo.
 *
 * Los mockups documentan dos hojas con distinto número de columnas.
 */
export interface EstructuraPlantilla {
  readonly hoja: string;
  readonly columnas: readonly string[];
  readonly resumenColumnas: string;
  readonly ejemplo: string;
  /** true ⇒ hoja de bienes; false ⇒ hoja de servicios. */
  readonly esBien: boolean;
}

export const ESTRUCTURAS_PLANTILLA: readonly EstructuraPlantilla[] = [
  {
    hoja: "BIEN",
    columnas: ["Tipo", "Nombre", "Descripción", "Unidad", "Cantidad"],
    resumenColumnas: "5 columnas estrictas",
    ejemplo: "Ej: BIEN | Monitor 27 IPS | Panel UHD 4K HDMI DP | Unidad | 12",
    esBien: true,
  },
  {
    hoja: "SERVICIO",
    columnas: ["Tipo", "Nombre", "Descripción", "Cantidad"],
    resumenColumnas: "4 columnas estrictas",
    ejemplo: "Ej: SERVICIO | Mantenimiento preventivo | Calibración anual redes | 1",
    esBien: false,
  },
];

/** Reglas de validación del paso 3. */
export const MIN_CARACTERES_NOMBRE_ITEM = 3;
export const MIN_CARACTERES_DESCRIPCION_ITEM = 15;
export const CANTIDAD_MINIMA = 1;
export const MAX_ARCHIVO_MB = 5;

/** Nombre canónico de la plantilla institucional del cargue (mockup). */
export const PLANTILLA_MASIVA = "Plantilla Oficial ÁGORA v3.4 (2025)";

/** Rechazo individual del cargue masivo (tabla de inconsistencias). */
export interface RechazoMasivo {
  /** Fila de la plantilla ("Fila 7"). */
  readonly fila: string;
  readonly hoja: "BIEN" | "SERVICIO";
  /** Campo afectado ("Cantidad", "Unidad de medida", …). */
  readonly campo: string;
  /** Valor detectado; vacío ⇒ "[Vacío]". */
  readonly valor: string;
  /** Titular del motivo ("Error de tipo de dato:"). */
  readonly motivo: string;
  /** Explicación del rechazo. */
  readonly detalle: string;
  /** Variante del icono de la fila. */
  readonly icono: "error" | "warning" | "priority_high";
}

/** Balance del cargue masivo (tarjeta del resultado). */
export interface BalanceMasivo {
  /** Lote procesado ("BATCH-UD-2026-0319"). */
  readonly lote: string;
  readonly aceptados: number;
  readonly rechazados: number;
  readonly total: number;
  /** Nombre del archivo procesado. */
  readonly archivo: string;
  /** Tamaño legible del archivo ("148 KB"). */
  readonly tamano: string;
  readonly rechazos: readonly RechazoMasivo[];
}

/** Resumen numérico de los ítems agregados. */
export interface ResumenItems {
  readonly totalItems: number;
  readonly totalCantidad: number;
  readonly bienes: number;
  readonly servicios: number;
  readonly tipo: TipoNecesidadSolicitud;
}

/** Cuenta los ítems por tipo y acumula sus cantidades. */
export function resumirItems(items: readonly ItemSolicitud[]): ResumenItems {
  let bienes = 0;
  let servicios = 0;
  let totalCantidad = 0;

  for (const item of items) {
    if (item.tipo === "bien") {
      bienes += 1;
    } else {
      servicios += 1;
    }
    totalCantidad += item.cantidad;
  }

  return {
    totalItems: items.length,
    totalCantidad,
    bienes,
    servicios,
    tipo: calcularTipoNecesidad(bienes, servicios),
  };
}

/**
 * Clasifica la solicitud según la mezcla de ítems: solo bienes, solo
 * servicios o mixta. Sin ítems se informa como "bienes" por defecto.
 */
export function calcularTipoNecesidad(
  bienes: number,
  servicios: number,
): TipoNecesidadSolicitud {
  if (bienes > 0 && servicios > 0) {
    return "mixta";
  }
  if (servicios > 0) {
    return "servicios";
  }
  return "bienes";
}

/** Etiqueta visible de cada clasificación. */
export const ETIQUETAS_TIPO_NECESIDAD: Record<TipoNecesidadSolicitud, string> = {
  bienes: "Bienes",
  servicios: "Servicios",
  mixta: "Bienes y servicios (Mixta)",
};

/** Formatea una cantidad con dos decimales ("4.00"), como el mockup. */
export function formatoCantidad(valor: number): string {
  return valor.toFixed(2);
}

/** Tamaño legible de un archivo ("148 KB"). */
export function formatoTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${bytes} B`;
}
