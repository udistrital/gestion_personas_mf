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


export type AccionSolicitud =
  | "ver-detalle"
  | "modificar"
  | "foro"
  | "formular-observacion"
  | "oferentes"
  | "cancelar";

export type AccionInvitacionProveedor =
  | "ver-detalle-proveedor"
  | "observar"
  | "formular-observacion"
  | "responder"
  | "descargar-anexo";

/** Acciones de una fila del tablero de oferentes (S-07). */
export type AccionOferente =
  | "ver-oferente"
  | "ver-observaciones"
  | "ver-cotizacion"
  | "ver-respuesta";

/** Acciones del comparador de cotizaciones (S-09). */
export type AccionComparador =
  | "ver-oferta"
  | "preseleccionar"
  | "quitar-preseleccion"
  | "exportar"
  | "continuar-decision";

/** Acciones con efecto del detalle del proveedor (S-10). */
export type AccionDetalleProveedor =
  | "preseleccionar"
  | "quitar-preseleccion"
  | "continuar-decision";

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

/** Unificación de estados visibles para el chip compartido. */
export const ESTADOS_CHIP: Readonly<
  Record<
    EstadoSolicitud | EstadoPostulacionProveedor | EstadoOferente,
    EstadoSolicitudMeta
  >
> = {
  ...ESTADOS_SOLICITUD,
  ...ESTADOS_POSTULACION_PROVEEDOR,
  ...ESTADOS_OFERENTE,
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
    etiqueta: "Respuesta solicitante",
    icono: "fact_check",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/proveedores/:proveedorId",
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
  preseleccionar: {
    etiqueta: "Preseleccionar esta oferta",
    icono: "how_to_reg",
    ruta: null,
  },
  "quitar-preseleccion": {
    etiqueta: "Quitar preselección",
    icono: "remove_done",
    ruta: null,
  },
  exportar: {
    etiqueta: "Exportar comparativo",
    icono: "download",
    ruta: null,
  },
  "continuar-decision": {
    etiqueta: "Continuar a decisión (S-11)",
    icono: "arrow_forward",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/decision",
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
  preseleccionar: {
    etiqueta: "Preseleccionar esta oferta",
    icono: "how_to_reg",
    ruta: null,
  },
  "quitar-preseleccion": {
    etiqueta: "Quitar preselección",
    icono: "remove_done",
    ruta: null,
  },
  "continuar-decision": {
    etiqueta: "Continuar a decisión (S-11)",
    icono: "arrow_forward",
    ruta: "cotizaciones/solicitudes/:id/evaluacion/decision",
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
