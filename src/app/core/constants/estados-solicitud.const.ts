/**
 * ÚNICA matriz de estados y acciones de una solicitud.
 *
 * Todo lo que depende de "qué se puede hacer en
 * cada estado" (menús, botones, guards de acción) debe leerse desde aquí vía
 * `PermisosSolicitudService`; si en el equipo se cambian las reglas, se edita
 * este archivo y no todas las pantallas.
 */

export type EstadoSolicitud =
  | "borrador"
  | "publicada"
  | "abierta"
  | "en-evaluacion"
  | "cerrada";

export type AccionSolicitud =
  | "ver-detalle"
  | "modificar"
  | "foro"
  | "oferentes"
  | "cancelar";

export type TonoChip =
  | "primario"
  | "exito"
  | "advertencia"
  | "info"
  | "neutro";

export interface EstadoSolicitudMeta {
  /** Texto visible del chip. */
  readonly etiqueta: string;
  readonly tono: TonoChip;
  /** Icono fijo (p. ej. `lock` para cerrada); si es null va un punto de color. */
  readonly icono: string | null;
  /** El punto del chip late (estado "en curso"), como en el mockup. */
  readonly pulso: boolean;
}

export interface AccionSolicitudMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta absoluta al destino del MF; null = pantalla aún no implementada. */
  readonly ruta: string | null;
  /** Acción destructiva: se pinta en rojo y exige confirmación. */
  readonly peligro?: boolean;
}

export const ESTADOS_SOLICITUD: Readonly<
  Record<EstadoSolicitud, EstadoSolicitudMeta>
> = {
  borrador: { etiqueta: "Borrador", tono: "advertencia", icono: null, pulso: false },
  publicada: { etiqueta: "Publicada", tono: "info", icono: null, pulso: false },
  abierta: { etiqueta: "Abierta", tono: "exito", icono: null, pulso: true },
  "en-evaluacion": {
    etiqueta: "En evaluación",
    tono: "primario",
    icono: null,
    pulso: false,
  },
  cerrada: { etiqueta: "Cerrada", tono: "neutro", icono: "lock", pulso: false },
};

export const ACCIONES_SOLICITUD: Readonly<
  Record<AccionSolicitud, AccionSolicitudMeta>
> = {
  "ver-detalle": {
    etiqueta: "Ver detalle",
    icono: "visibility",
    ruta: "cotizaciones/solicitudes/:id",
  },
  modificar: {
    etiqueta: "Modificar",
    icono: "edit",
    ruta: null, // S-04
  },
  foro: {
    etiqueta: "Foro de observaciones",
    icono: "forum",
    ruta: null, // S-06
  },
  oferentes: {
    etiqueta: "Tablero de oferentes",
    icono: "group",
    ruta: null, // S-07
  },
  cancelar: {
    etiqueta: "Cancelar solicitud",
    icono: "cancel",
    ruta: null, // S-05
    peligro: true,
  },
};

/**
 * Acciones permitidas por estado.
 * `ver-detalle` siempre está: ver el detalle nunca debería estar bloqueado.
 */
export const MATRIZ_ACCIONES_POR_ESTADO: Readonly<
  Record<EstadoSolicitud, readonly AccionSolicitud[]>
> = {
  borrador: ["ver-detalle", "modificar", "cancelar"],
  publicada: ["ver-detalle", "foro", "oferentes", "cancelar"],
  abierta: ["ver-detalle", "modificar", "foro", "oferentes", "cancelar"],
  "en-evaluacion": ["ver-detalle", "foro", "oferentes"],
  cerrada: ["ver-detalle"],
};

/** Catálogo ordenado para poblar selects de estado. */
export const ESTADOS_SOLICITUD_LISTA: readonly EstadoSolicitud[] = [
  "borrador",
  "publicada",
  "abierta",
  "en-evaluacion",
  "cerrada",
];
