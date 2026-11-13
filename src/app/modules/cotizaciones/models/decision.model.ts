/**
 * Modelo de la decisión de la cotización (S-11).
 *
 * S-11 registra el **envío a validación** del proveedor seleccionado y su
 * oferta. La aprobación o rechazo final corresponde a las vistas exclusivas del
 * Ordenador del Gasto (O-01 a O-04), que todavía no existen; por eso el modelo
 * deja preparada la fase de validación (`validacion`) pero S-11 no la produce.
 *
 * La justificación se guarda en texto plano (para RN-24 y la bitácora) y en
 * HTML sanitizado (para la vista de lectura). El valor y el nombre del
 * proveedor se copian en la decisión para conservar la trazabilidad aunque la
 * oferta cambie de presentación.
 */

import type { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";

/** Fase del trámite de decisión. */
export type FaseDecision = "enviada" | "aprobada" | "rechazada";

/** Resultado de la validación del Ordenador del Gasto. */
export type ResultadoValidacion = "aprobada" | "rechazada";

/** Registro de una notificación (RF-13). Provisional hasta conectar el backend. */
export interface NotificacionDecision {
  readonly destinatario: string;
  readonly correo: string;
  readonly fecha: string;
  readonly fechaIso: string;
  readonly tipo: "validacion" | "adjudicacion" | "rechazo";
  readonly estadoEntrega: "programada" | "simulada" | "pendiente";
}

/** Datos del envío a validación (RN-24, RN-08). */
export interface EnvioDecision {
  /** Texto plano normalizado (sin etiquetas HTML). */
  readonly justificacion: string;
  /** HTML del editor para la vista de lectura (se pinta con `htmlSeguro`). */
  readonly justificacionHtml: string;
  readonly usuario: string;
  readonly autor: string;
  readonly rol: string;
  /** Fecha visible `dd/MM/yyyy HH:mm COT`. */
  readonly fecha: string;
  readonly fechaIso: string;
  /** true si el usuario pidió registrar la notificación simulada al proveedor. */
  readonly notificar: boolean;
}

/** Datos de la validación final (la producen las vistas futuras del OG). */
export interface ValidacionDecision {
  readonly resultado: ResultadoValidacion;
  readonly justificacion: string;
  readonly justificacionHtml: string;
  readonly usuario: string;
  readonly autor: string;
  readonly rol: string;
  readonly fecha: string;
  readonly fechaIso: string;
}

/** Decisión de una solicitud: envío a validación y, si existe, validación final. */
export interface DecisionSolicitud {
  readonly id: string;
  readonly solicitudId: string;
  readonly fase: FaseDecision;
  /** Invitación del proveedor seleccionado. */
  readonly invitacionId: string;
  readonly proveedorId: string;
  readonly proveedorNombre: string;
  readonly valor: number;
  readonly envio: EnvioDecision;
  /** Solo existe cuando las vistas del OG ya registraron el resultado. */
  readonly validacion?: ValidacionDecision;
  readonly notificaciones: readonly NotificacionDecision[];
  /** Código de verificación simulado (provisional). */
  readonly codigoVerificacion: string;
}

/** Datos que S-11 envía al servicio para registrar la remisión a validación. */
export interface RegistroEnvioDecision {
  readonly invitacionId: string;
  readonly proveedorId: string;
  readonly proveedorNombre: string;
  readonly valor: number;
  readonly justificacionHtml: string;
  readonly notificar: boolean;
  /** Correo del proveedor para el registro simulado de la notificación. */
  readonly correoProveedor?: string;
}

/** Contrato mínimo para derivar el resultado de una solicitud. */
export interface SolicitudConDecision {
  readonly estado: EstadoSolicitud;
  readonly decision?: DecisionSolicitud;
  /** Decisiones anteriores cuando hubo reenvíos después de un rechazo. */
  readonly historialDecisiones?: readonly DecisionSolicitud[];
}

/**
 * Última decisión registrada para un proveedor.
 *
 * Sirve para que el detalle del proveedor y la acción del tablero sigan
 * mostrando la respuesta del Ordenador del Gasto aunque después se haya
 * enviado a validación a otro proveedor.
 */
export function decisionDeProveedor(
  solicitud: SolicitudConDecision,
  proveedorId: string,
): DecisionSolicitud | null {
  const decisiones = [
    ...(solicitud.historialDecisiones ?? []),
    ...(solicitud.decision ? [solicitud.decision] : []),
  ];
  return (
    decisiones.filter((decision) => decision.proveedorId === proveedorId).at(-1) ??
    null
  );
}

/** Etiquetas visibles de la fase de decisión. */
export const ETIQUETAS_FASE_DECISION: Readonly<Record<FaseDecision, string>> = {
  enviada: "Enviada a validación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

/**
 * Resultado final de la solicitud.
 *
 * Se deriva de la decisión y, si no hay registro detallado (filas antiguas), del
 * estado del expediente. Devuelve `null` mientras la decisión esté pendiente.
 */
export function resultadoDecisionSolicitud(
  solicitud: SolicitudConDecision,
): ResultadoValidacion | null {
  if (solicitud.decision?.fase === "aprobada") {
    return "aprobada";
  }
  if (solicitud.decision?.fase === "rechazada") {
    return "rechazada";
  }
  if (solicitud.estado === "adjudicada") {
    return "aprobada";
  }
  if (solicitud.estado === "desierta") {
    return "rechazada";
  }
  return null;
}

/** Fase de decisión derivada (incluye el envío pendiente de validación). */
export function faseDecisionSolicitud(
  solicitud: SolicitudConDecision,
): FaseDecision | null {
  if (solicitud.decision) {
    return solicitud.decision.fase;
  }
  if (solicitud.estado === "adjudicada") {
    return "aprobada";
  }
  if (solicitud.estado === "desierta") {
    return "rechazada";
  }
  return null;
}

/**
 * Justificación final que verá el proveedor.
 *
 * Si el OG ya validó, prevalece su versión; mientras tanto se muestra la del
 * envío.
 */
export function justificacionFinalDecision(decision: DecisionSolicitud): string {
  return decision.validacion?.justificacionHtml ?? decision.envio.justificacionHtml;
}

/** Texto plano de la justificación final (para la bitácora). */
export function justificacionFinalTexto(decision: DecisionSolicitud): string {
  return decision.validacion?.justificacion ?? decision.envio.justificacion;
}
