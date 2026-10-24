/**
 * Modelo de la bitácora de eventos de una solicitud (Pestaña 7 de S-03).
 *
 * La bitácora registra lo que le pasó al expediente: creación, vinculación
 * presupuestal, radicación, notificaciones y modificaciones. Es de solo
 * lectura y sus datos salen del mismo servicio simulado que el resto del
 * detalle.
 *
 * Los estados que muestra cada evento son los del catálogo institucional
 * (`core/constants/estados-solicitud.const.ts`); esta capa no inventa estados
 * nuevos.
 */

import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";

/** Naturaleza del evento dentro del trámite. */
export type TipoEventoHistorial =
  | "creacion"
  | "modificacion"
  | "notificacion"
  | "estado";

/** Catálogo de tipos de evento con sus etiquetas de filtro y de ficha. */
export interface TipoEventoHistorialMeta {
  readonly valor: TipoEventoHistorial;
  /** Etiqueta del filtro de la barra de herramientas. */
  readonly etiqueta: string;
  /** Etiqueta de la ficha del evento (más descriptiva). */
  readonly etiquetaDetalle: string;
}

/** Tipos de evento, en el orden en que los muestra el filtro. */
export const TIPOS_EVENTO_HISTORIAL: readonly TipoEventoHistorialMeta[] = [
  { valor: "creacion", etiqueta: "Creación", etiquetaDetalle: "Creación" },
  {
    valor: "modificacion",
    etiqueta: "Modificaciones",
    etiquetaDetalle: "Modificaciones",
  },
  {
    valor: "notificacion",
    etiqueta: "Notificaciones",
    etiquetaDetalle: "Notificaciones y Despacho",
  },
  {
    valor: "estado",
    etiqueta: "Estados de proceso",
    etiquetaDetalle: "Estados de proceso",
  },
];

/** Etiqueta legible de un tipo de evento. */
export function etiquetaTipoEvento(valor: TipoEventoHistorial): string {
  return (
    TIPOS_EVENTO_HISTORIAL.find((tipo) => tipo.valor === valor)?.etiquetaDetalle ??
    valor
  );
}

/** Evidencia técnica de un evento (transacción, hash, origen…). */
export interface EvidenciaHistorial {
  /** Icono Material de la evidencia. */
  readonly icono: string;
  /** Texto de la evidencia ("ID Transacción: TXN-894102-DIRTEI"). */
  readonly texto: string;
}

/**
 * Tono del nodo del evento en la línea de tiempo.
 *
 * Coincide con los tonos del componente genérico `linea-tiempo`:
 * `primario` (vinotinto institucional), `destacado` (vinotinto profundo) y
 * `neutro` (gris de hito inactivo).
 */
export type TonoNodoHistorial = "primario" | "destacado" | "neutro";

/** Tono del chip de resultado de un evento. */
export type TonoResultadoHistorial =
  | "neutro"
  | "exito"
  | "advertencia"
  | "primario";

/**
 * Evento de la bitácora.
 *
 * `fecha` viene ya formateada con la zona horaria de Colombia (COT) y
 * `fechaIso` es la misma instante en ISO-8601, para el atributo `datetime` de
 * `<time>`.
 */
export interface EventoHistorial {
  readonly id: string;
  /** Naturaleza del evento. */
  readonly tipo: TipoEventoHistorial;
  /** Título del evento. */
  readonly titulo: string;
  /** Fecha y hora legible ("02 de Marzo de 2026 - 11:30 COT"). */
  readonly fecha: string;
  /** Fecha en ISO-8601 con desfase de Colombia ("2026-03-02T11:30:00-05:00"). */
  readonly fechaIso: string;
  /** Detalle funcional; puede traer HTML del editor enriquecido. */
  readonly detalle?: string;
  /** Usuario que ejecutó la acción ("raquimbayap"). */
  readonly usuario: string;
  /** Nombre real de la persona ("Raúl Quimbaya"). */
  readonly nombreUsuario?: string;
  /** Rol dentro del proceso ("Solicitante / Contratista Registrado"). */
  readonly rol: string;
  /** Estado del proceso antes del evento. */
  readonly estadoAnterior: EstadoSolicitud;
  /** Estado del proceso después del evento. */
  readonly estadoNuevo: EstadoSolicitud;
  /** Evidencia técnica de la acción. */
  readonly evidencia?: EvidenciaHistorial;
  /** Icono Material del nodo en la línea de tiempo. */
  readonly icono: string;
  /** Tono del nodo en la línea de tiempo. */
  readonly tono: TonoNodoHistorial;
  /** Resultado de la acción ("Despacho Conforme"). */
  readonly resultado?: string;
  /** Tono del chip de resultado. */
  readonly tonoResultado?: TonoResultadoHistorial;
  /** Chip adicional del detalle ("SICAPITAL OK"). */
  readonly sello?: string;
}

/**
 * Días calendario entre el primer y el último evento.
 *
 * Es la fuente única del "tiempo en trámite" que muestra el pie de la
 * bitácora: se calcula sobre los eventos ya ordenados.
 */
export function diasEnTramite(eventos: readonly EventoHistorial[]): number {
  if (eventos.length < 2) {
    return 0;
  }

  const marcas = eventos
    .map((evento) => Date.parse(evento.fechaIso))
    .filter((marca) => !isNaN(marca));

  if (marcas.length < 2) {
    return 0;
  }

  const dias = Math.round((Math.max(...marcas) - Math.min(...marcas)) / 86_400_000);
  return dias < 0 ? 0 : dias;
}
