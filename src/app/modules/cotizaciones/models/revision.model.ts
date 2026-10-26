/**
 * Modelos del paso 7 del asistente de solicitud (S-02).
 *
 * El paso 7 ("Revisión y procesar") no captura datos nuevos: consolida en
 * modo lectura lo diligenciado en los pasos 1 a 6, verifica la completitud del
 * expediente y ejecuta la radicación formal. Este módulo reúne los contratos
 * de las tarjetas de revisión, los valores de la lista de verificación, el
 * resumen institucional de la radicación y los formateos puros que comparten
 * las tres vistas del mockup aprobado (revisión, modal de confirmación y
 * confirmación de éxito).
 */

/** Tipo de valor de un campo de la revisión (cambia su presentación). */
export type TipoCampoRevision =
  | "texto"
  | "codigo"
  | "destacado"
  | "fecha"
  | "moneda"
  | "cantidad";

/** Un par etiqueta/valor dentro de un acordeón de revisión. */
export interface CampoRevision {
  readonly etiqueta: string;
  readonly valor: string;
  readonly tipo?: TipoCampoRevision;
}

/** Chip de estado que corona un acordeón (p. ej. "Verificado SICAPITAL"). */
export interface ChipRevision {
  readonly texto: string;
  readonly icono: string;
  /** Variante visual del chip. */
  readonly tono?: "vino" | "neutro" | "exito";
}

/**
 * Un acordeón de la columna izquierda: el resumen de un paso ya diligenciado.
 *
 * Cada acordeón enumera los campos que el usuario completó en ese paso, más
 * los bloques especiales que el mockup dibuja aparte (chips, archivos,
 * requisitos del oferente o la distribución de pagos).
 */
export interface AcordeonRevision {
  readonly numero: number;
  readonly icono: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly chip?: ChipRevision;
  readonly campos: readonly CampoRevision[];
  /** Listado secundario de etiquetas simples (chips de "N ítems", etc.). */
  readonly etiquetas?: readonly string[];
  /** Códigos CIIU vinculados, un renglón por código (acordeón del paso 5). */
  readonly codigos?: readonly string[];
  /** Distribución porcentual de pagos (acordeón del paso 4). */
  readonly desembolsos?: readonly string[];
  /** Archivos adjuntos institucionales (acordeón del paso 6). */
  readonly archivos?: readonly ArchivoRevision[];
  /** Requisitos exigidos al proponente (acordeón del paso 6). */
  readonly requisitos?: readonly RequisitoRevision[];
  /** Plantilla de la matriz de ítems validada (acordeón del paso 3). */
  readonly plantilla?: PlantillaRevision;
  /** true cuando el acordeón arranca desplegado. */
  readonly abierto?: boolean;
}

/** Plantilla de la matriz de ítems que el paso 3 cargó y validó. */
export interface PlantillaRevision {
  readonly nombre: string;
  readonly estado: string;
}

/** Archivo adjunto que lista el acordeón del paso 6. */
export interface ArchivoRevision {
  readonly nombre: string;
  readonly peso: string;
  readonly icono: string;
}

/** Requisito exigido al proponente (acordeón del paso 6). */
export interface RequisitoRevision {
  readonly nombre: string;
  readonly clasificacion: string;
  readonly obligatorio: boolean;
}

/** Un criterio de la lista de verificación institucional. */
export interface ItemVerificacion {
  readonly titulo: string;
  readonly detalle: string;
  /** true cuando el criterio se cumple (icono verde). */
  readonly cumple: boolean;
}

/** Resumen que alimenta el modal de confirmación y la pantalla de éxito. */
export interface ResumenRadicacion {
  readonly numeroCotizacion: string;
  readonly vigencia: string;
  readonly objeto: string;
  readonly proveedoresNotificados: number;
  readonly itemsClasificados: string;
  readonly cierreOfertas: string;
  readonly presupuesto: string;
  readonly numeroCdp: string;
  readonly unidadEjecutora: string;
  readonly sede: string;
  /** Plazo de recepción de ofertas ya redactado ("Hasta el 06 de Marzo…"). */
  readonly plazoRecepcion: string;
  /** Días hábiles restantes para recibir ofertas. */
  readonly diasHabilesRestantes: number;
}

// ── Valores de respaldo (mockup aprobado) ───────────────────────────────────

/**
 * Radicado institucional por defecto.
 *
 * El mockup bautiza el proceso como `COT-2026-00412`; se usa como respaldo
 * cuando el cruce con SICAPITAL no trae número de cotización.
 */
export const RADICADO_MOCK = "COT-2026-00412";

/**
 * Cantidad de proveedores objetivo que el padrón de ÁGORA habilita.
 *
 * El banco institucional reporta doce empresas habilitadas; la cifra se
 * anuncia solo cuando la solicitud vinculó al menos un código CIIU.
 */
export const PROVEEDORES_HABILITADOS = 12;

/**
 * Calcula cuántos proveedores se notificarán al procesar la solicitud.
 *
 * Sin actividades CIIU vinculadas no hay segmento objetivo, así que la
 * notificación es cero.
 */
export function contarProveedoresNotificados(cantidadCodigos: number): number {
  return cantidadCodigos > 0 ? PROVEEDORES_HABILITADOS : 0;
}

/** Hash criptográfico simulado con el que se certifica la radicación. */
export const HASH_RADICADO_MOCK =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Tomo y folio del Libro Digital Oficial (mockup). */
export const LIBRO_RADICADO_MOCK = "Tomo 2026 - Folio 0412-A";

/**
 * Devuelve el número de radicado, generando uno estable cuando falta el dato.
 *
 * Si el cruce no trae número de cotización se conserva el radicado del mockup
 * para que la vista muestre siempre un consecutivo institucional coherente.
 */
export function numeroRadicado(numeroCotizacion: string): string {
  const limpio = numeroCotizacion.trim();
  return limpio ? `COT-2026-${limpio.padStart(5, "0")}` : RADICADO_MOCK;
}

/** Recorta un hash largo a su forma abreviada ("e3b0c442...7852b855"). */
export function hashAbreviado(hash: string): string {
  if (hash.length <= 22) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/** Cuenta en singular/plural ("12 proponentes" / "1 proponente"). */
export function pluralizarProveedores(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "proponente" : "proponentes"}`;
}

/** Cuenta en singular/plural con el término oficial ("12 oferentes"). */
export function pluralizarOferentes(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "oferente" : "oferentes"}`;
}

/**
 * Formatea la fecha y hora de radicación ("02 de Marzo de 2026 · 10:45 AM COT").
 *
 * Usa las partes de la fecha local para reproducir el estilo del mockup; la
 * etiqueta horaria se fija a la zona oficial de radicación (COT).
 */
export function formatoFechaHoraRadicacion(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const mes = meses[fecha.getMonth()];
  const hora24 = fecha.getHours();
  const sufijo = hora24 >= 12 ? "PM" : "AM";
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia} de ${mes} de ${fecha.getFullYear()} · ${hora12}:${minutos} ${sufijo} COT`;
}

/** Fecha larga sin hora ("06 de Marzo de 2026"). */
export function formatoFechaLarga(valor: string): string {
  const fecha = new Date(`${valor}T00:00:00`);
  if (isNaN(fecha.getTime())) {
    return valor;
  }
  const dia = String(fecha.getDate()).padStart(2, "0");
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${dia} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}
