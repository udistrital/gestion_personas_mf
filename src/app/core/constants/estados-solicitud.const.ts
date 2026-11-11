/**
 * Estados, catálogo de acciones y metadatos visuales de una solicitud.
 *
 * Qué puede hacer cada rol en cada estado se declara en
 * `acciones-por-rol-y-estado.const.ts` y se consulta a través de
 * `PermisosSolicitudService`; aquí solo vive el vocabulario (estados y
 * acciones) y sus etiquetas, iconos y rutas.
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

export type EstadoPostulacionProveedor =
  | "borrador"
  | "enviada"
  | "pendiente-ajuste"
  | "excluida"
  | "aceptada"
  | "rechazada"
  | "declinada"
  | "vencida";

/**
 * Estado de presentación de un oferente dentro del tablero S-07.
 *
 * No se guarda en la invitación: se deriva de la respuesta radicada, las
 * observaciones y el cierre del proceso. `seleccionado` no es un estado, es un
 * indicador aparte (RN-33).
 */
export type EstadoOferente =
  | "cotizo"
  | "modifico"
  | "observo"
  | "notificado"
  | "sin-respuesta"
  | "pendiente-ajuste";

/**
 * Estado del periodo de subsanación documental (S-12).
 *
 * No es un `EstadoSolicitud`: se deriva de las fechas del periodo y de su
 * cancelación. La solicitud conserva su estado de proceso.
 */
export type EstadoSubsanacion =
  | "configurada"
  | "activa"
  | "vencida"
  | "cancelada";

/** Estado derivado de un oferente dentro de un periodo de subsanación. */
export type EstadoSubsanacionOferente =
  | "sin-observaciones"
  | "requiere-subsanacion"
  | "en-espera"
  | "subsanado-parcial"
  | "subsanado-completo"
  | "no-subsanado";

/**
 * Estado de un estudio de mercado (S-13).
 *
 * Es un ciclo propio y no se mezcla con `EstadoSolicitud`: un estudio de
 * mercado no es una solicitud de cotización. `cerrado` se deriva de la fecha
 * límite cuando el estudio está en recepción.
 */
export type EstadoEstudioMercado =
  | "borrador"
  | "en-recepcion"
  | "cerrado"
  | "aprobado"
  | "descartado";

/** Estado de un proveedor dentro de un estudio de mercado. */
export type EstadoInvitacionEstudio =
  | "sin-invitar"
  | "invitado"
  | "respondio"
  | "no-respondio";


export type AccionSolicitud =
  | "ver-detalle"
  | "modificar"
  | "foro"
  | "formular-observacion"
  | "oferentes"
  | "cancelar";

export type AccionInvitacionProveedor =
  | "ver-detalle-proveedor"
  | "ver-mi-cotizacion"
  | "observar"
  | "formular-observacion"
  | "responder"
  | "actualizar"
  | "descargar-anexo";

/**
 * Estado derivado de la respuesta del proveedor frente a la versión vigente
 * de la solicitud. No se persiste en la invitación: se calcula con
 * `PermisosSolicitudService` a partir de la adenda y de la respuesta radicada.
 */
export type EstadoActualizacionRespuesta =
  | "sin-modificacion"
  | "desactualizada"
  | "actualizada"
  | "vencida";

/** Acciones de una fila del tablero de oferentes (S-07). */
export type AccionOferente =
  | "ver-oferente"
  | "ver-observaciones"
  | "ver-cotizacion"
  | "ver-respuesta"
  | "continuar-decision";

/** Acciones del comparador de cotizaciones (S-09). */
export type AccionComparador = "ver-oferta" | "exportar";

/** Acciones con efecto del detalle del proveedor (S-10). */
export type AccionDetalleProveedor = "continuar-decision";

/**
 * Acciones del trámite de decisión (S-11).
 *
 * S-11 solo registra el envío a validación. La validación final (aprobar o
 * rechazar) pertenece a las vistas exclusivas del Ordenador del Gasto
 * (O-01 a O-04), que se implementarán en una entrega posterior.
 */
export type AccionDecision = "enviar-a-validacion";

/** Acciones del periodo de subsanación documental (S-12). */
export type AccionSubsanacion =
  | "configurar"
  | "ver-historial"
  | "ampliar"
  | "cancelar";

/** Acciones de un estudio de mercado (S-13). */
export type AccionEstudioMercado =
  | "ver-detalle"
  | "editar"
  | "invitar-proveedores"
  | "exportar"
  | "descartar";

/** Estado derivado del trámite de decisión (no es un `EstadoSolicitud`). */
export type EstadoDecision =
  | "pendiente"
  | "en-validacion"
  | "aprobada"
  | "rechazada";

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

export const ESTADOS_POSTULACION_PROVEEDOR: Readonly<
  Record<EstadoPostulacionProveedor, EstadoSolicitudMeta>
> = {
  borrador: {
    etiqueta: "Borrador",
    tono: "advertencia",
    icono: null,
    pulso: false,
  },
  enviada: {
    etiqueta: "Enviada",
    tono: "info",
    icono: null,
    pulso: true,
  },
  "pendiente-ajuste": {
    etiqueta: "Pendiente de Ajuste",
    tono: "advertencia",
    icono: "edit_note",
    pulso: true,
  },
  excluida: {
    etiqueta: "Excluida",
    tono: "neutro",
    icono: "block",
    pulso: false,
  },
  aceptada: {
    etiqueta: "Aceptada",
    tono: "exito",
    icono: "verified",
    pulso: false,
  },
  rechazada: {
    etiqueta: "Rechazada",
    tono: "neutro",
    icono: "cancel",
    pulso: false,
  },
  declinada: {
    etiqueta: "Declinada",
    tono: "neutro",
    icono: "do_not_disturb_on",
    pulso: false,
  },
  vencida: {
    etiqueta: "Vencida",
    tono: "neutro",
    icono: "schedule",
    pulso: false,
  },
};

/** Metadatos visuales del estado de actualización de la respuesta (P-05). */
export const ESTADOS_ACTUALIZACION_RESPUESTA: Readonly<
  Record<EstadoActualizacionRespuesta, EstadoSolicitudMeta>
> = {
  "sin-modificacion": {
    etiqueta: "Sin modificaciones pendientes",
    tono: "neutro",
    icono: "check_circle",
    pulso: false,
  },
  desactualizada: {
    etiqueta: "Respuesta desactualizada",
    tono: "advertencia",
    icono: "edit_note",
    pulso: true,
  },
  actualizada: {
    etiqueta: "Respuesta actualizada",
    tono: "exito",
    icono: "published_with_changes",
    pulso: false,
  },
  vencida: {
    etiqueta: "Plazo vencido sin actualizar",
    tono: "neutro",
    icono: "lock_clock",
    pulso: false,
  },
};

/**
 * Estados de presentación del tablero de oferentes (S-07).
 *
 * Los tonos salen de los tokens institucionales: el mockup usa morado para
 * "Modificó" y azul para "Notificado", pero aquí se mapean a los tonos del
 * catálogo para no introducir colores sueltos.
 */
export const ESTADOS_OFERENTE: Readonly<
  Record<EstadoOferente, EstadoSolicitudMeta>
> = {
  cotizo: {
    etiqueta: "Cotizó",
    tono: "exito",
    icono: null,
    pulso: false,
  },
  modifico: {
    etiqueta: "Modificó",
    tono: "primario",
    icono: null,
    pulso: false,
  },
  observo: {
    etiqueta: "Observó",
    tono: "advertencia",
    icono: null,
    pulso: false,
  },
  notificado: {
    etiqueta: "Notificado",
    tono: "info",
    icono: null,
    pulso: false,
  },
  "sin-respuesta": {
    etiqueta: "Sin respuesta",
    tono: "neutro",
    icono: null,
    pulso: false,
  },
  "pendiente-ajuste": {
    etiqueta: "Pendiente de ajuste",
    tono: "advertencia",
    icono: "edit_note",
    pulso: false,
  },
};

/**
 * Metadatos visuales del trámite de decisión.
 *
 * No se mezclan con `ESTADOS_CHIP` porque no son estados de la solicitud ni de
 * la postulación: son la fase del trámite de S-11 y su resultado. El tono
 * `error` se usa solo en la vista de S-11, con los tokens `--agora-error-*`.
 */
export type TonoDecision = "exito" | "error" | "advertencia" | "info";

export interface EstadoDecisionMeta {
  readonly etiqueta: string;
  readonly tono: TonoDecision;
  readonly icono: string;
}

export const ESTADOS_DECISION: Readonly<
  Record<EstadoDecision, EstadoDecisionMeta>
> = {
  pendiente: {
    etiqueta: "Decisión pendiente",
    tono: "advertencia",
    icono: "hourglass_top",
  },
  "en-validacion": {
    etiqueta: "Enviada a validación",
    tono: "info",
    icono: "pending_actions",
  },
  aprobada: {
    etiqueta: "Aprobada",
    tono: "exito",
    icono: "verified",
  },
  rechazada: {
    etiqueta: "Rechazada",
    tono: "error",
    icono: "cancel",
  },
};

/** Metadatos visuales del periodo de subsanación (S-12). */
export const ESTADOS_SUBSANACION: Readonly<
  Record<EstadoSubsanacion, EstadoSolicitudMeta>
> = {
  configurada: {
    etiqueta: "Programada",
    tono: "info",
    icono: "event_upcoming",
    pulso: false,
  },
  activa: {
    etiqueta: "En curso",
    tono: "exito",
    icono: null,
    pulso: true,
  },
  vencida: {
    etiqueta: "Finalizada",
    tono: "neutro",
    icono: "lock_clock",
    pulso: false,
  },
  cancelada: {
    etiqueta: "Cancelada",
    tono: "advertencia",
    icono: "cancel",
    pulso: false,
  },
};

/** Metadatos visuales del estado de un oferente en la subsanación. */
export const ESTADOS_SUBSANACION_OFERENTE: Readonly<
  Record<EstadoSubsanacionOferente, EstadoSolicitudMeta>
> = {
  "sin-observaciones": {
    etiqueta: "Sin observaciones",
    tono: "neutro",
    icono: "check_circle",
    pulso: false,
  },
  "requiere-subsanacion": {
    etiqueta: "Requiere subsanación",
    tono: "advertencia",
    icono: "report",
    pulso: false,
  },
  "en-espera": {
    etiqueta: "En espera de proponente",
    tono: "info",
    icono: "hourglass_top",
    pulso: false,
  },
  "subsanado-parcial": {
    etiqueta: "Subsanación parcial",
    tono: "advertencia",
    icono: "pending_actions",
    pulso: false,
  },
  "subsanado-completo": {
    etiqueta: "Subsanado completo",
    tono: "exito",
    icono: "verified",
    pulso: false,
  },
  "no-subsanado": {
    etiqueta: "No subsanado en plazo",
    tono: "advertencia",
    icono: "block",
    pulso: false,
  },
};

/** Metadatos visuales del ciclo de un estudio de mercado (S-13). */
export const ESTADOS_ESTUDIO_MERCADO: Readonly<
  Record<EstadoEstudioMercado, EstadoSolicitudMeta>
> = {
  borrador: {
    etiqueta: "Borrador",
    tono: "advertencia",
    icono: null,
    pulso: false,
  },
  "en-recepcion": {
    etiqueta: "En recepción",
    tono: "info",
    icono: null,
    pulso: true,
  },
  cerrado: {
    etiqueta: "Cerrado",
    tono: "neutro",
    icono: "lock_clock",
    pulso: false,
  },
  aprobado: {
    etiqueta: "Aprobado",
    tono: "exito",
    icono: "verified",
    pulso: false,
  },
  descartado: {
    etiqueta: "Descartado",
    tono: "neutro",
    icono: "delete",
    pulso: false,
  },
};

/** Metadatos visuales de la invitación de un proveedor a un estudio. */
export const ESTADOS_INVITACION_ESTUDIO: Readonly<
  Record<EstadoInvitacionEstudio, EstadoSolicitudMeta>
> = {
  "sin-invitar": {
    etiqueta: "Sin invitar",
    tono: "neutro",
    icono: null,
    pulso: false,
  },
  invitado: {
    etiqueta: "Invitado",
    tono: "info",
    icono: null,
    pulso: true,
  },
  respondio: {
    etiqueta: "Respondió",
    tono: "exito",
    icono: "check_circle",
    pulso: false,
  },
  "no-respondio": {
    etiqueta: "No respondió",
    tono: "advertencia",
    icono: "schedule",
    pulso: false,
  },
};

/** Unificación de estados visibles para el chip compartido. */
export const ESTADOS_CHIP: Readonly<
  Record<
    | EstadoSolicitud
    | EstadoPostulacionProveedor
    | EstadoOferente
    | EstadoSubsanacion
    | EstadoSubsanacionOferente
    | EstadoEstudioMercado
    | EstadoInvitacionEstudio
    | EstadoActualizacionRespuesta,
    EstadoSolicitudMeta
  >
> = {
  ...ESTADOS_SOLICITUD,
  ...ESTADOS_POSTULACION_PROVEEDOR,
  ...ESTADOS_ACTUALIZACION_RESPUESTA,
  ...ESTADOS_OFERENTE,
  ...ESTADOS_SUBSANACION,
  ...ESTADOS_SUBSANACION_OFERENTE,
  ...ESTADOS_ESTUDIO_MERCADO,
  ...ESTADOS_INVITACION_ESTUDIO,
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
    ruta: "cotizaciones/solicitudes/:id/observaciones",
  },
  "formular-observacion": {
    etiqueta: "Formular observación",
    icono: "add_comment",
    ruta: null,
  },
  oferentes: {
    etiqueta: "Tablero de oferentes",
    icono: "group",
    ruta: "cotizaciones/solicitudes/:id/oferentes",
  },
  cancelar: {
    etiqueta: "Cancelar solicitud",
    icono: "cancel",
    ruta: null, // S-05
    peligro: true,
  },
};

export interface AccionInvitacionProveedorMeta {
  readonly etiqueta: string;
  readonly icono: string;
  readonly ruta: string | null;
}

export const ACCIONES_INVITACION_PROVEEDOR: Readonly<
  Record<AccionInvitacionProveedor, AccionInvitacionProveedorMeta>
> = {
  "ver-detalle-proveedor": {
    etiqueta: "Ver solicitud",
    icono: "visibility",
    ruta: "cotizaciones/bandeja-solicitudes/:id",
  },
  "ver-mi-cotizacion": {
    etiqueta: "Mi cotización",
    icono: "request_quote",
    ruta: "cotizaciones/bandeja-solicitudes/:id/mi-cotizacion",
  },
  observar: {
    etiqueta: "Observaciones",
    icono: "forum",
    ruta: "cotizaciones/bandeja-solicitudes/:id/observaciones",
  },
  "formular-observacion": {
    etiqueta: "Formular observación",
    icono: "add_comment",
    ruta: null,
  },
  responder: {
    etiqueta: "Responder",
    icono: "edit_square",
    ruta: "cotizaciones/bandeja-solicitudes/:id/responder",
  },
  actualizar: {
    etiqueta: "Modificar respuesta",
    icono: "edit_note",
    ruta: "cotizaciones/bandeja-solicitudes/:id/actualizar",
  },
  "descargar-anexo": {
    etiqueta: "Descargar anexo",
    icono: "download",
    ruta: null,
  },
};

/** Acciones de una fila del tablero de oferentes (S-07). */
export interface AccionOferenteMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta plantilla; `:id` es la solicitud y `:proveedorId` el proveedor. */
  readonly ruta: string;
}

export const ACCIONES_OFERENTE: Readonly<
  Record<AccionOferente, AccionOferenteMeta>
> = {
  "ver-oferente": {
    etiqueta: "Detalle de persona",
    icono: "visibility",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/proveedores/:proveedorId",
  },
  "ver-observaciones": {
    etiqueta: "Observaciones",
    icono: "chat",
    ruta: "cotizaciones/solicitudes/:id/observaciones",
  },
  "ver-cotizacion": {
    etiqueta: "Cotización radicada",
    icono: "request_quote",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/proveedores/:proveedorId",
  },
  "ver-respuesta": {
    etiqueta: "Respuesta del ordenador del gasto",
    icono: "fact_check",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/proveedores/:proveedorId",
  },
  "continuar-decision": {
    etiqueta: "Enviar a validación",
    icono: "gavel",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/decision",
  },
};

/** Metadatos de una acción del comparador (S-09). */
export interface AccionComparadorMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta plantilla; `null` cuando la acción la ejecuta el servicio. */
  readonly ruta: string | null;
}

export const ACCIONES_COMPARADOR: Readonly<
  Record<AccionComparador, AccionComparadorMeta>
> = {
  "ver-oferta": {
    etiqueta: "Ver detalle completo",
    icono: "visibility",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/proveedores/:proveedorId",
  },
  exportar: {
    etiqueta: "Exportar comparativo",
    icono: "download",
    ruta: null,
  },
};

/** Metadatos de una acción del detalle del proveedor (S-10). */
export interface AccionDetalleProveedorMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta plantilla; `null` cuando la acción la ejecuta el servicio. */
  readonly ruta: string | null;
}

export const ACCIONES_DETALLE_PROVEEDOR: Readonly<
  Record<AccionDetalleProveedor, AccionDetalleProveedorMeta>
> = {
  "continuar-decision": {
    etiqueta: "Enviar a validación",
    icono: "send",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/decision",
  },
};

/** Metadatos de una acción del trámite de decisión (S-11). */
export interface AccionDecisionMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** `null` porque la acción se ejecuta dentro de la página S-11. */
  readonly ruta: string | null;
}

export const ACCIONES_DECISION: Readonly<
  Record<AccionDecision, AccionDecisionMeta>
> = {
  "enviar-a-validacion": {
    etiqueta: "Enviar a validación",
    icono: "send",
    ruta: null,
  },
};

/** Metadatos de una acción del periodo de subsanación (S-12). */
export interface AccionSubsanacionMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta plantilla; `null` cuando la acción la ejecuta la pantalla. */
  readonly ruta: string | null;
}

export const ACCIONES_SUBSANACION: Readonly<
  Record<AccionSubsanacion, AccionSubsanacionMeta>
> = {
  configurar: {
    etiqueta: "Habilitar subsanación",
    icono: "fact_check",
    ruta: "cotizaciones/solicitudes/:id/subsanacion",
  },
  "ver-historial": {
    etiqueta: "Ver historial de subsanación",
    icono: "history",
    ruta: "cotizaciones/solicitudes/:id/subsanacion/historial",
  },
  ampliar: {
    etiqueta: "Ampliar plazo de subsanación",
    icono: "update",
    ruta: null,
  },
  cancelar: {
    etiqueta: "Cancelar periodo de subsanación",
    icono: "cancel",
    ruta: null,
  },
};

/** Metadatos de una acción del estudio de mercado (S-13). */
export interface AccionEstudioMercadoMeta {
  readonly etiqueta: string;
  readonly icono: string;
  /** Ruta plantilla; `null` cuando la acción abre un diálogo o la maneja la página. */
  readonly ruta: string | null;
  /** Acción destructiva: se pinta en rojo y exige confirmación. */
  readonly peligro?: boolean;
}

export const ACCIONES_ESTUDIO_MERCADO: Readonly<
  Record<AccionEstudioMercado, AccionEstudioMercadoMeta>
> = {
  "ver-detalle": {
    etiqueta: "Ver detalle",
    icono: "visibility",
    ruta: null,
  },
  editar: {
    etiqueta: "Continuar borrador",
    icono: "edit",
    ruta: null,
  },
  "invitar-proveedores": {
    etiqueta: "Invitar proveedores",
    icono: "forward_to_inbox",
    ruta: "cotizaciones/estudios-mercado/:id/proveedores",
  },
  exportar: {
    etiqueta: "Exportar estudio",
    icono: "download",
    ruta: null,
  },
  descartar: {
    etiqueta: "Descartar borrador",
    icono: "delete",
    ruta: null,
    peligro: true,
  },
};


/**
 * La consulta del foro está disponible para toda invitación. Formular requiere
 * además que la invitación y la solicitud sigan habilitadas y que el plazo
 * específico de observaciones no haya vencido.
 *
 * Las acciones por estado de la invitación viven en
 * `acciones-por-rol-y-estado.const.ts` (eje rol + estado de postulación).
 */

/** Estados del proceso en los que puede recibirse una respuesta de proveedor. */
export const MATRIZ_SOLICITUD_PERMITE_RESPUESTA: Readonly<
  Record<EstadoSolicitud, boolean>
> = {
  borrador: false,
  "enviada-proveedores": true,
  "en-aprobacion": false,
  "enviada-con-modificaciones": true,
  "en-evaluacion": false,
  adjudicada: false,
  desierta: false,
  cancelada: false,
};

/**
 * Estados del proceso en los que se puede actualizar una respuesta ya radicada
 * tras una modificación de la solicitud (P-05).
 *
 * Es provisional: RN-30 permite modificar ítems y cierre después de procesar,
 * pero el momento exacto de cierre de la ventana de actualización aún no está
 * definido por negocio. Se excluyen los estados terminales y la aprobación.
 */
export const MATRIZ_SOLICITUD_PERMITE_ACTUALIZACION: Readonly<
  Record<EstadoSolicitud, boolean>
> = {
  borrador: false,
  "enviada-proveedores": true,
  "en-aprobacion": false,
  "enviada-con-modificaciones": true,
  "en-evaluacion": true,
  adjudicada: false,
  desierta: false,
  cancelada: false,
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
