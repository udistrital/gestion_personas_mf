/** Persona que radica una observación en el foro. */
export interface AutorObservacion {
  readonly nombre: string;
  readonly tipo: "persona-natural" | "persona-juridica";
  readonly identificacion: string;
}

/**
 * Respuesta institucional del solicitante a una observación.
 *
 * El hilo es privado: solo lo ven el proveedor que formuló la observación y
 * el solicitante que la atiende. Ningún otro proveedor invitado puede leerlo.
 */
export interface RespuestaObservacion {
  readonly contenidoHtml: string;
  readonly autor: string;
  readonly rol: string;
  readonly fechaIso: string;
  readonly fecha: string;
  readonly visibilidad: "privada";
}

/** Observación vinculada a una solicitud; sin respuesta equivale a pendiente. */
export interface Observacion {
  readonly id: string;
  readonly solicitudId: string;
  readonly radicado: string;
  readonly autor: AutorObservacion;
  readonly fechaIso: string;
  readonly fecha: string;
  readonly contenidoHtml: string;
  readonly respuesta?: RespuestaObservacion;
}

/** Contenido mínimo que envía el modo proveedor al crear una observación. */
export interface NuevaObservacion {
  readonly contenidoHtml: string;
}

/** Contenido que envía el solicitante al responder una observación. */
export interface RespuestaObservacionEntrada {
  readonly observacionId: string;
  readonly contenidoHtml: string;
  readonly editar: boolean;
}

/** Estado de trabajo para los filtros del foro; no representa lectura. */
export type EstadoObservacion = "pendiente" | "respondida";

export function estadoObservacion(observacion: Observacion): EstadoObservacion {
  return observacion.respuesta ? "respondida" : "pendiente";
}
