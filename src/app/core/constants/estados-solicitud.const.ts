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
  | "enviada-proveedores"
  | "en-aprobacion"
  | "enviada-con-modificaciones"
  | "en-evaluacion"
  | "adjudicada"
  | "desierta"
  | "cancelada";

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
  /**
   * Etiqueta que reemplaza a `etiqueta` en ciertos estados.
   *
   * S-04 usa "Modificar" en borradores y "Solicitar modificación" cuando la
   * solicitud ya fue enviada a proveedores.
   */
  readonly etiquetaPorEstado?: Partial<Record<EstadoSolicitud, string>>;
  /**
   * Ruta que reemplaza a `ruta` en ciertos estados.
   *
   * En borradores la edición es completa (`/editar`); en solicitudes enviadas
   * solo se solicita una modificación restringida (`/solicitar-modificacion`).
   */
  readonly rutaPorEstado?: Partial<Record<EstadoSolicitud, string>>;
}

export const ESTADOS_SOLICITUD: Readonly<
  Record<EstadoSolicitud, EstadoSolicitudMeta>
> = {
  borrador: {
    etiqueta: "Borrador",
    tono: "advertencia",
    icono: null,
    pulso: false,
  },
  "enviada-proveedores": {
    etiqueta: "Enviada a proveedores",
    tono: "info",
    icono: null,
    pulso: true,
  },
  "en-aprobacion": {
    etiqueta: "En aprobación",
    tono: "advertencia",
    icono: "hourglass_top",
    pulso: true,
  },
  "enviada-con-modificaciones": {
    etiqueta: "Enviada con modificaciones",
    tono: "info",
    icono: null,
    pulso: true,
  },
  "en-evaluacion": {
    etiqueta: "En evaluación",
    tono: "primario",
    icono: null,
    pulso: false,
  },
  adjudicada: {
    etiqueta: "Adjudicada",
    tono: "exito",
    icono: "verified",
    pulso: false,
  },
  desierta: {
    etiqueta: "Desierta",
    tono: "neutro",
    icono: "block",
    pulso: false,
  },
  cancelada: {
    etiqueta: "Cancelada",
    tono: "neutro",
    icono: "cancel",
    pulso: false,
  },
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
    ruta: "cotizaciones/solicitudes/:id/editar",
    etiquetaPorEstado: {
      "enviada-proveedores": "Solicitar modificación",
      "enviada-con-modificaciones": "Solicitar modificación",
    },
    rutaPorEstado: {
      "enviada-proveedores": "cotizaciones/solicitudes/:id/solicitar-modificacion",
      "enviada-con-modificaciones":
        "cotizaciones/solicitudes/:id/solicitar-modificacion",
    },
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
  "enviada-proveedores": [
    "ver-detalle",
    "modificar",
    "foro",
    "oferentes",
    "cancelar",
  ],
  "en-aprobacion": ["ver-detalle", "foro", "oferentes"],
  "enviada-con-modificaciones": [
    "ver-detalle",
    "modificar",
    "foro",
    "oferentes",
    "cancelar",
  ],
  "en-evaluacion": ["ver-detalle", "foro", "oferentes"],
  adjudicada: ["ver-detalle", "foro", "oferentes"],
  desierta: ["ver-detalle"],
  cancelada: ["ver-detalle"],
};

/** Catálogo ordenado para poblar selects de estado. */
export const ESTADOS_SOLICITUD_LISTA: readonly EstadoSolicitud[] = [
  "borrador",
  "enviada-proveedores",
  "en-aprobacion",
  "enviada-con-modificaciones",
  "en-evaluacion",
  "adjudicada",
  "desierta",
  "cancelada",
];
