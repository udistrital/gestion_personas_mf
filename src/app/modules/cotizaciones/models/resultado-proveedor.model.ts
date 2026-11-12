/**
 * Resultado del proceso visto por el proveedor (P-07).
 *
 * La vista es de solo lectura: no decide ni registra nada. Este modelo toma la
 * decisión que ya produjo S-11, la filtra para el proveedor actual y deriva el
 * estado visible del proceso. No duplica `DecisionSolicitud`: reutiliza
 * `decisionDeProveedor` y las funciones de justificación final.
 *
 * Reglas que respeta:
 * - RN-29: el proveedor solo ve su resultado, su cotización y el mensaje del
 *   solicitante. Nunca las ofertas, los precios ni los nombres de otros.
 * - RN-33: «no seleccionado» (la decisión es de otro proveedor) se diferencia
 *   de «seleccionado y rechazado por el Ordenador del Gasto» (hay decisión
 *   propia con fase rechazada).
 * - RN-34/35/42: la decisión es única y definitiva; no hay acciones de edición.
 *
 * Provisional: la constancia PDF, el hash institucional, las actas, los
 * puntajes y las fechas estimadas de publicación no existen en el modelo. Se
 * marcan con `etiqueta-por-definir` en la vista.
 */

import type { TonoDecision } from "src/app/core/constants/estados-solicitud.const";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import type { DecisionSolicitud } from "./decision.model";
import {
  decisionDeProveedor,
  justificacionFinalDecision,
  justificacionFinalTexto,
} from "./decision.model";
import type {
  InvitacionProveedor,
  ProveedorPublicoProveedor,
} from "./invitacion-proveedor.model";
import { formatoCop } from "./necesidad.model";
import type { Solicitud } from "./solicitud.model";
import { solicitudCerrada } from "./solicitud.model";

/** Estados visibles de la respuesta del solicitante. */
export type EstadoResultadoProveedor =
  | "favorable"
  | "no-seleccionado"
  | "rechazada-ordenador"
  | "en-validacion"
  | "no-disponible"
  | "sin-respuesta"
  | "cancelada";

/** Tono del banner; reutiliza los tonos de decisión y añade neutro. */
export type TonoResultado = TonoDecision | "neutro";

/** Decisión ya filtrada para el proveedor actual. */
export interface DecisionProveedor {
  readonly resultado: "aprobada" | "rechazada";
  /** HTML de la justificación final; se pinta con el pipe `htmlSeguro`. */
  readonly justificacionHtml: string;
  /** Texto plano de la misma justificación (respaldo y accesibilidad). */
  readonly justificacion: string;
  readonly autor: string;
  readonly rol: string;
  readonly fecha: string;
  readonly fechaIso: string;
  readonly codigoVerificacion: string;
}

/** Notificación propia del proveedor (RF-13); el envío real es del backend. */
export interface NotificacionProveedor {
  readonly fecha: string;
  readonly fechaIso: string;
  readonly tipo: string;
  readonly estadoEntrega: "programada" | "simulada" | "pendiente";
}

/** Resultado de un proveedor, sin datos de otros oferentes. */
export interface ResultadoProveedor {
  readonly estado: EstadoResultadoProveedor;
  readonly decision: DecisionProveedor | null;
  readonly notificacion: NotificacionProveedor | null;
  readonly publicadaEl: string | null;
  /** true mientras el plazo de participación siga abierto. */
  readonly procesoAbierto: boolean;
  readonly cerrada: boolean;
}

/** Metadato corto del banner. */
export interface DatoBannerResultado {
  readonly etiqueta: string;
  readonly valor: string;
  readonly icono: string;
}

/** Texto de siguiente etapa; lo no definido lleva `porDefinir`. */
export interface ProximoPasoResultado {
  readonly titulo: string;
  readonly detalle: string;
  readonly icono: string;
  readonly porDefinir: string;
}

/** Todo lo que pinta el banner de resultado. */
export interface BannerResultadoDatos {
  readonly estado: EstadoResultadoProveedor;
  readonly tono: TonoResultado;
  readonly etiqueta: string;
  readonly eyebrow: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: string;
  readonly datos: readonly DatoBannerResultado[];
  /** Texto del botón de constancia; vacío cuando no aplica. */
  readonly accionConstancia: string;
  readonly proximoPaso: ProximoPasoResultado;
}

/** Contexto de la solicitud que el banner necesita para sus textos. */
export interface ContextoBannerResultado {
  readonly titulo: string;
  readonly cierre: string | null;
  readonly criterioSeleccion: string;
  readonly proveedorNombre: string;
  readonly proveedorCorreo: string;
  readonly radicado: string | null;
  readonly total: number | null;
}

const ETIQUETAS: Readonly<Record<EstadoResultadoProveedor, string>> = {
  favorable: "Seleccionado (Favorable)",
  "no-seleccionado": "No seleccionada",
  "rechazada-ordenador": "Rechazada por Ordenador del Gasto",
  "en-validacion": "En validación",
  "no-disponible": "Resultado pendiente",
  "sin-respuesta": "Sin respuesta",
  cancelada: "Proceso cancelado",
};

const TONOS: Readonly<Record<EstadoResultadoProveedor, TonoResultado>> = {
  favorable: "exito",
  "no-seleccionado": "neutro",
  "rechazada-ordenador": "error",
  "en-validacion": "advertencia",
  "no-disponible": "advertencia",
  "sin-respuesta": "neutro",
  cancelada: "neutro",
};

const ICONOS: Readonly<Record<EstadoResultadoProveedor, string>> = {
  favorable: "check_circle",
  "no-seleccionado": "info",
  "rechazada-ordenador": "cancel",
  "en-validacion": "pending_actions",
  "no-disponible": "hourglass_empty",
  "sin-respuesta": "mark_email_unread",
  cancelada: "block",
};

const ANTETITULOS: Readonly<Record<EstadoResultadoProveedor, string>> = {
  favorable: "Dictamen aprobatorio definitivo",
  "no-seleccionado": "Notificación institucional de adjudicación",
  "rechazada-ordenador": "Dictamen desfavorable",
  "en-validacion": "Validación del Ordenador del Gasto",
  "no-disponible": "Resultado aún no disponible",
  "sin-respuesta": "Participación no registrada",
  cancelada: "Proceso cancelado",
};

const TITULOS: Readonly<Record<EstadoResultadoProveedor, string>> = {
  favorable: "Su cotización fue seleccionada",
  "no-seleccionado": "Su cotización no fue seleccionada en esta ocasión",
  "rechazada-ordenador": "La cotización fue rechazada en la validación",
  "en-validacion": "La decisión está en validación",
  "no-disponible": "Resultado aún no disponible",
  "sin-respuesta": "No se registró una cotización",
  cancelada: "El proceso fue cancelado",
};

const ACCIONES_CONSTANCIA: Readonly<Record<EstadoResultadoProveedor, string>> =
  {
    favorable: "Descargar constancia de selección",
    "no-seleccionado": "Descargar informe de evaluación",
    "rechazada-ordenador": "Descargar dictamen de rechazo",
    "en-validacion": "",
    "no-disponible": "",
    "sin-respuesta": "",
    cancelada: "",
  };

const ETIQUETAS_ENTREGA: Readonly<
  Record<NotificacionProveedor["estadoEntrega"], string>
> = {
  programada: "programada",
  simulada: "simulada",
  pendiente: "pendiente",
};

/** Construye el resultado del proveedor a partir de la decisión de S-11. */
export function construirResultadoProveedor(
  solicitud: Solicitud,
  invitacion: InvitacionProveedor,
  proveedor: ProveedorPublicoProveedor,
): ResultadoProveedor {
  const decision = decisionDeProveedor(solicitud, proveedor.id);
  const cerrada = solicitudCerrada(solicitud);
  const estado = estadoResultadoProveedor(
    solicitud,
    invitacion,
    decision,
    cerrada,
  );
  const final = decision && decision.fase !== "enviada" ? decision : null;

  return {
    estado,
    decision: final ? proyectarDecision(final) : null,
    notificacion: final ? notificacionDe(final, proveedor) : null,
    publicadaEl: final ? (final.validacion?.fecha ?? final.envio.fecha) : null,
    procesoAbierto: !cerrada,
    cerrada,
  };
}

/**
 * Deriva el estado visible.
 *
 * El orden importa: la decisión propia manda sobre el estado del expediente.
 * Si la solicitud está adjudicada pero la decisión es de otro proveedor, este
 * proveedor no fue seleccionado (RN-33) y nunca se infiere lo contrario.
 */
function estadoResultadoProveedor(
  solicitud: Solicitud,
  invitacion: InvitacionProveedor,
  decision: DecisionSolicitud | null,
  cerrada: boolean,
): EstadoResultadoProveedor {
  if (decision?.fase === "aprobada") {
    return "favorable";
  }
  if (decision?.fase === "rechazada") {
    return "rechazada-ordenador";
  }
  if (decision?.fase === "enviada") {
    return "en-validacion";
  }
  if (solicitud.estado === "cancelada") {
    return "cancelada";
  }
  if (!invitacion.respuestaVigente) {
    return cerrada ? "sin-respuesta" : "no-disponible";
  }
  if (
    solicitud.estado === "adjudicada" ||
    solicitud.estado === "desierta"
  ) {
    return "no-seleccionado";
  }
  return "no-disponible";
}

/** Proyección de la decisión sin datos internos ni de otros proveedores. */
function proyectarDecision(decision: DecisionSolicitud): DecisionProveedor {
  const validacion = decision.validacion;
  return {
    resultado: decision.fase === "rechazada" ? "rechazada" : "aprobada",
    justificacionHtml: justificacionFinalDecision(decision),
    justificacion: justificacionFinalTexto(decision),
    autor: validacion?.autor ?? decision.envio.autor,
    rol: validacion?.rol ?? decision.envio.rol,
    fecha: validacion?.fecha ?? decision.envio.fecha,
    fechaIso: validacion?.fechaIso ?? decision.envio.fechaIso,
    codigoVerificacion: decision.codigoVerificacion,
  };
}

/** Última notificación dirigida al proveedor actual; nunca a terceros. */
function notificacionDe(
  decision: DecisionSolicitud,
  proveedor: ProveedorPublicoProveedor,
): NotificacionProveedor | null {
  const notificacion = [...decision.notificaciones]
    .reverse()
    .find(
      (item) =>
        item.correo === proveedor.correo ||
        item.destinatario === proveedor.nombre,
    );
  if (!notificacion) {
    return null;
  }
  return {
    fecha: notificacion.fecha,
    fechaIso: notificacion.fechaIso,
    tipo: notificacion.tipo,
    estadoEntrega: notificacion.estadoEntrega,
  };
}

/** Arma los textos y metadatos del banner para el estado actual. */
export function construirBannerResultado(
  resultado: ResultadoProveedor,
  contexto: ContextoBannerResultado,
): BannerResultadoDatos {
  const estado = resultado.estado;
  const base = {
    estado,
    tono: TONOS[estado],
    etiqueta: ETIQUETAS[estado],
    eyebrow: ANTETITULOS[estado],
    titulo: TITULOS[estado],
    icono: ICONOS[estado],
    accionConstancia: ACCIONES_CONSTANCIA[estado],
  };

  switch (estado) {
    case "favorable":
      return {
        ...base,
        descripcion: `Felicitaciones. La propuesta presentada por ${contexto.proveedorNombre} fue seleccionada como la oferta más favorable para el proceso «${contexto.titulo}». La decisión fue ratificada por el Ordenador del Gasto.`,
        datos: [
          {
            etiqueta: "Código de verificación",
            valor: resultado.decision?.codigoVerificacion ?? "Por definir",
            icono: "article",
          },
          {
            etiqueta: "Notificación",
            valor: textoNotificacion(resultado),
            icono: "mark_email_read",
          },
          {
            etiqueta: "Fecha de la decisión",
            valor: resultado.publicadaEl ?? "Por definir",
            icono: "event_available",
          },
          ...datoValorPropio(contexto),
        ],
        proximoPaso: {
          titulo: "Formalización de la adjudicación",
          detalle:
            "La Universidad se pondrá en contacto con el proveedor para la suscripción de la orden de compra o del contrato.",
          icono: "handshake",
          porDefinir:
            "Etapas posteriores a la selección y formato de formalización institucional (por definir).",
        },
      };

    case "no-seleccionado":
      return {
        ...base,
        descripcion:
          "Agradecemos su participación en este proceso. Después de la evaluación institucional, otra propuesta radicada fue seleccionada para la presente contratación. Su empresa permanece activa en el banco de proveedores de la Universidad.",
        datos: [
          {
            etiqueta: "Criterio de selección",
            valor: recortar(
              textoPlanoDesdeHtml(contexto.criterioSeleccion),
              90,
            ) || "Publicado en el pliego de condiciones",
            icono: "balance",
          },
          {
            etiqueta: "Cierre de recepción",
            valor: contexto.cierre ?? "Por definir",
            icono: "event_available",
          },
          {
            etiqueta: "Publicación del resultado",
            valor: resultado.publicadaEl ?? "Por definir",
            icono: "campaign",
          },
          ...datoValorPropio(contexto),
        ],
        proximoPaso: {
          titulo: "Siga participando en nuevos procesos",
          detalle:
            "Revise las solicitudes publicadas en su bandeja y conserve su registro y certificados vigentes.",
          icono: "travel_explore",
          porDefinir:
            "La respuesta personalizada a proveedores no seleccionados aún no se registra en S-11 (por definir).",
        },
      };

    case "rechazada-ordenador":
      return {
        ...base,
        descripcion:
          "El Ordenador del Gasto determinó no validar la cotización presentada. La motivación registrada se muestra en esta misma pantalla y la decisión no admite réplica.",
        datos: [
          {
            etiqueta: "Código de verificación",
            valor: resultado.decision?.codigoVerificacion ?? "Por definir",
            icono: "article",
          },
          {
            etiqueta: "Fecha de la decisión",
            valor: resultado.publicadaEl ?? "Por definir",
            icono: "event_available",
          },
          {
            etiqueta: "Notificación",
            valor: textoNotificacion(resultado),
            icono: "mark_email_read",
          },
          ...datoValorPropio(contexto),
        ],
        proximoPaso: {
          titulo: "La decisión es definitiva",
          detalle:
            "No se habilitan acciones de edición ni de réplica sobre la cotización.",
          icono: "gavel",
          porDefinir:
            "Constancia oficial del dictamen y su firma digital (por definir).",
        },
      };

    case "en-validacion":
      return {
        ...base,
        descripcion:
          "La oferta seleccionada fue enviada a validación del Ordenador del Gasto. El resultado definitivo se publicará en esta misma pantalla.",
        datos: [
          {
            etiqueta: "Etapa actual",
            valor: "Validación del Ordenador del Gasto",
            icono: "pending_actions",
          },
          {
            etiqueta: "Cierre de recepción",
            valor: contexto.cierre ?? "Por definir",
            icono: "event_available",
          },
          {
            etiqueta: "Publicación estimada",
            valor: "Por definir",
            icono: "campaign",
          },
          ...datoRadicado(contexto),
        ],
        proximoPaso: {
          titulo: "Espere la validación",
          detalle:
            "El Ordenador del Gasto aprobará o rechazará la oferta. La consulta se actualizará cuando se registre la decisión.",
          icono: "hourglass_top",
          porDefinir: "Plazo de la validación (por definir).",
        },
      };

    case "no-disponible":
      return {
        ...base,
        descripcion: resultado.procesoAbierto
          ? "El proceso de cotización aún está abierto. El resultado se publicará después del cierre y de la evaluación de las propuestas recibidas."
          : "El proceso de evaluación todavía no registra un resultado definitivo. La decisión se publicará en esta misma pantalla una vez se consolide el acta correspondiente.",
        datos: [
          {
            etiqueta: "Etapa actual",
            valor: resultado.procesoAbierto
              ? "Recepción de propuestas"
              : "Evaluación de las propuestas",
            icono: "find_in_page",
          },
          {
            etiqueta: "Cierre de recepción",
            valor: contexto.cierre ?? "Por definir",
            icono: "event_available",
          },
          {
            etiqueta: "Correo de notificación",
            valor: contexto.proveedorCorreo || "Por definir",
            icono: "mail",
          },
          ...datoRadicado(contexto),
        ],
        proximoPaso: {
          titulo: "Espere la publicación oficial",
          detalle:
            "El resultado se habilitará en esta pantalla cuando el Ordenador del Gasto registre la decisión final.",
          icono: "campaign",
          porDefinir:
            "Fecha estimada de publicación y envío real de la notificación (por definir).",
        },
      };

    case "sin-respuesta":
      return {
        ...base,
        descripcion:
          "No se registró una cotización de su empresa dentro del plazo de participación. Por ello no hay un resultado de selección que consultar.",
        datos: [
          {
            etiqueta: "Cierre de recepción",
            valor: contexto.cierre ?? "Por definir",
            icono: "event_available",
          },
          {
            etiqueta: "Estado de la invitación",
            valor: "Sin respuesta radicada",
            icono: "mark_email_unread",
          },
        ],
        proximoPaso: {
          titulo: "Consulte el detalle de la solicitud",
          detalle:
            "Puede revisar las condiciones del proceso y las solicitudes publicadas en su bandeja.",
          icono: "description",
          porDefinir: "",
        },
      };

    case "cancelada":
      return {
        ...base,
        descripcion:
          "La solicitud fue cancelada por la entidad. No hay un resultado de selección que consultar y no se generan acciones sobre su cotización.",
        datos: [
          {
            etiqueta: "Estado del proceso",
            valor: "Cancelado",
            icono: "block",
          },
          {
            etiqueta: "Cierre de recepción",
            valor: contexto.cierre ?? "Por definir",
            icono: "event_available",
          },
          ...datoRadicado(contexto),
        ],
        proximoPaso: {
          titulo: "Revise otras solicitudes",
          detalle:
            "Consulte las convocatorias vigentes en su bandeja de solicitudes de cotización.",
          icono: "travel_explore",
          porDefinir:
            "Motivo público de la cancelación y notificación asociada (por definir).",
        },
      };
  }
}

/** Valor propio de la oferta, sin compararlo con otros oferentes. */
function datoValorPropio(
  contexto: ContextoBannerResultado,
): readonly DatoBannerResultado[] {
  if (contexto.total === null) {
    return [];
  }
  return [
    {
      etiqueta: "Valor de su propuesta",
      valor: formatoCop(contexto.total),
      icono: "payments",
    },
  ];
}

/** Radicado de la respuesta propia; no se muestra si no existe. */
function datoRadicado(
  contexto: ContextoBannerResultado,
): readonly DatoBannerResultado[] {
  if (!contexto.radicado) {
    return [];
  }
  return [
    {
      etiqueta: "Radicado de su respuesta",
      valor: contexto.radicado,
      icono: "tag",
    },
  ];
}

function textoNotificacion(resultado: ResultadoProveedor): string {
  const notificacion = resultado.notificacion;
  if (!notificacion) {
    return "Por definir";
  }
  return `${notificacion.fecha} · ${ETIQUETAS_ENTREGA[notificacion.estadoEntrega]}`;
}

function recortar(texto: string, maximo: number): string {
  const limpio = texto.trim().replace(/\s+/g, " ");
  return limpio.length > maximo
    ? `${limpio.slice(0, maximo - 1).trimEnd()}…`
    : limpio;
}
