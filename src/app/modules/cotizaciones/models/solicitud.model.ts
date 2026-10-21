import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";
import {
  ContadoresPestanas,
  GeneralDetalle,
} from "./detalle-solicitud.model";

export type TipoCotizacion = "BIEN" | "SERVICIO" | "BIEN_Y_SERVICIO";

/** Modelo mínimo de una solicitud para el listado S-01 (y futuras pantallas). */
export interface Solicitud {
  /** Identificador en URL; se usa también como número visible (SOL-2026-0042). */
  readonly id: string;
  readonly vigencia: number;
  /** Valor corto (`'1'`); la etiqueta se resuelve con `UNIDADES_EJECUTORAS`. */
  readonly unidadEjecutora: string;
  readonly titulo: string;
  /** Formato dd/MM/yyyy; null en borradores (la tabla muestra "-"). */
  readonly apertura: string | null;
  readonly cierre: string | null;
  readonly dependencia: string;
  readonly tipoCotizacion: TipoCotizacion;
  readonly estado: EstadoSolicitud;
}

/** Criterios del formulario de filtros de S-01. */
export interface FiltroSolicitudes {
  /** '2026' | '2025' | '2024' | 'historico' */
  vigencia: string;
  /** '' = todas */
  unidadEjecutora: string;
  /** '' = todos; valor = EstadoSolicitud */
  estado: string;
  /** '' = todos | 'bienes' | 'servicios' | 'mixto' */
  tipoCotizacion: string;
  /** Texto libre (número, palabra clave o título). */
  busqueda: string;
}

export interface ResultadoListado {
  readonly solicitudes: readonly Solicitud[];
  /** Total de filas que coinciden con el filtro (antes de paginar). */
  readonly total: number;
}

/**
 * Solicitud con la información ampliada que consume el detalle (S-03).
 *
 * Extiende la fila del listado con los datos de cabecera que sólo necesita el
 * detalle, el contenido de la pestaña "General" y los contadores de la barra
 * de pestañas. Las seis pestañas pendientes de implementar leerán de aquí
 * cuando se desarrollen.
 */
export interface SolicitudDetalle extends Solicitud {
  /** Número de cotizaciones recibidas (tarjeta métrica de la cabecera). */
  readonly cotizacionesRecibidas: number;
  readonly general: GeneralDetalle;
  readonly contadores: ContadoresPestanas;
}

export interface UnidadEjecutora {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Catálogo de unidades ejecutoras (valores del mockup de S-01). */
export const UNIDADES_EJECUTORAS: readonly UnidadEjecutora[] = [
  { valor: "1", etiqueta: "1 - Rectoría" },
  { valor: "2", etiqueta: "2 - IDEXUD" },
  { valor: "3", etiqueta: "3 - Facultad de Ingeniería" },
  { valor: "4", etiqueta: "4 - Facultad de Ciencias y Educación" },
];

export const VIGENCIAS: readonly { valor: string; etiqueta: string }[] = [
  { valor: "2026", etiqueta: "2026 (Predeterminada)" },
  { valor: "2025", etiqueta: "2025" },
  { valor: "2024", etiqueta: "2024" },
  { valor: "historico", etiqueta: "Histórico consolidado" },
];

export const TIPOS_COTIZACION_FILTRO: readonly {
  valor: string;
  etiqueta: string;
}[] = [
  { valor: "", etiqueta: "Todos los tipos" },
  { valor: "bienes", etiqueta: "Bien" },
  { valor: "servicios", etiqueta: "Servicio" },
  { valor: "mixto", etiqueta: "Bien y servicio" },
];

/** Etiqueta legible del tipo de cotización (badge de la tabla). */
export function etiquetaTipoCotizacion(tipo: TipoCotizacion): string {
  switch (tipo) {
    case "BIEN":
      return "BIEN";
    case "SERVICIO":
      return "SERVICIO";
    case "BIEN_Y_SERVICIO":
      return "BIEN Y SERVICIO";
  }
}

/** Etiqueta legible de la unidad ejecutora. */
export function etiquetaUnidadEjecutora(valor: string): string {
  return (
    UNIDADES_EJECUTORAS.find((unidad) => unidad.valor === valor)?.etiqueta ??
    valor
  );
}
