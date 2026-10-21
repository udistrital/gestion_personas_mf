/**
 * Modelo del calendario de días festivos (paso 2 del asistente, S-02).
 *
 * El cronograma de una solicitud se mide en **días hábiles** y, en Colombia,
 * un día hábil no es solo un día entre lunes y viernes: los **festivos
 * nacionales** también se descuentan (Ley 51 de 1983 y sus modificaciones,
 * con la regla Emiliani de traslado al lunes siguiente).
 *
 * Los festivos llegan de una API pública con CORS permisivo, de modo que el
 * dato se actualiza solo y el microfrontend no guarda ninguna constante de
 * calendario. Este archivo sólo define la forma de los datos y las funciones
 * puras que los combinan; la consulta vive en
 * `services/calendario.service.ts`.
 */

/**
 * Festivo nacional de un calendario laboral.
 *
 * `fecha` es la fecha efectiva (ya trasladada al lunes cuando la ley lo
 * ordena), no la fecha original de la festividad.
 */
export interface Festivo {
  /** Fecha efectiva en ISO-8601 ("2026-03-23"). */
  readonly fecha: string;
  /** Nombre oficial en español ("Día de San José"). */
  readonly nombre: string;
}

/**
 * Respuesta cruda de la API de festivos.
 *
 * La API entrega el nombre en español (`localName`) y en inglés (`name`); sólo
 * se usa el primero. `types` llega como arreglo y cada festivo puede tener
 * varios ("Public"), por eso el modelo no depende de ese campo.
 */
export interface RespuestaFestivosApi {
  readonly date: string;
  readonly localName: string;
  readonly name: string;
  readonly countryCode: string;
  readonly types?: readonly string[];
}

/** Conjunto de fechas festivas (ISO-8601) para consultas rápidas. */
export type FechasFestivas = ReadonlySet<string>;

/** Convierte una lista de festivos en el conjunto de fechas consultable. */
export function conjuntoFechas(
  festivos: readonly Festivo[],
): FechasFestivas {
  return new Set(festivos.map((festivo) => festivo.fecha));
}

/** true si la fecha (ISO-8601) es festivo. */
export function esFestivo(fecha: string, festivos: FechasFestivas): boolean {
  return festivos.has(fecha);
}

/**
 * Años que abrange un rango de fechas, en orden ascendente.
 *
 * Un proceso puede abrir en diciembre y cerrar en enero: el rango abarca dos
 * años y el calendario debe cubrir ambos. Si alguna fecha no es válida, se
 * devuelve el año de la que sí lo sea.
 */
export function aniosDelRango(
  desde: string,
  hasta: string,
): readonly number[] {
  const anios = new Set<number>();

  for (const fecha of [desde, hasta]) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      anios.add(Number(fecha.slice(0, 4)));
    }
  }

  if (anios.size === 2) {
    const [menor, mayor] = [...anios].sort((a, b) => a - b);
    for (let anio = menor + 1; anio < mayor; anio += 1) {
      anios.add(anio);
    }
  }

  return [...anios].sort((a, b) => a - b);
}

/**
 * Festivos que caen dentro del rango `[desde, hasta]`, ambos inclusive.
 *
 * Se usa en la tarjeta del cronograma para mostrarle al solicitante qué días
 * se le descontaron y por qué el conteo quedó como quedó.
 */
export function festivosDelRango(
  desde: string,
  hasta: string,
  festivos: readonly Festivo[],
): readonly Festivo[] {
  if (!desde || !hasta || desde > hasta) {
    return [];
  }

  return festivos
    .filter((festivo) => festivo.fecha >= desde && festivo.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
