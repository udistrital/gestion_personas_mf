/**
 * ÚNICA matriz de acciones por rol y estado.
 *
 * Sigue el patrón de `plan_anual_auditoria_mf`: cada rol es una clave y dentro
 * de él se declara qué acciones ve en cada estado. Los roles salen de
 * `environment.ROL`, así que un cambio de literales en el token no obliga a
 * tocar pantallas.
 *
 * Hay dos ejes de estado distintos y por eso dos matrices:
 *
 * - `ACCIONES_SOLICITUD_POR_ROL_Y_ESTADO` — vistas de consulta del área
 *   solicitante (S-01, S-03). Eje: `EstadoSolicitud`.
 * - `ACCIONES_INVITACION_POR_ROL_Y_ESTADO` — bandeja y detalle del proveedor
 *   (P-01, P-02, P-03, P-04). Eje: `EstadoPostulacionProveedor`, porque la
 *   invitación tiene su propio ciclo de vida.
 *
 * Ningún componente importa estas matrices directamente para decidir qué
 * pintar: se consultan a través de `PermisosSolicitudService`, que además
 * aplica las reglas de fecha (cierre, límite de observaciones).
 */

import { environment } from "src/environments/environment";
import {
  AccionComparador,
  AccionDecision,
  AccionDetalleProveedor,
  AccionEstudioMercado,
  AccionInvitacionProveedor,
  AccionOferente,
  AccionSolicitud,
  AccionSubsanacion,
  EstadoEstudioMercado,
  EstadoOferente,
  EstadoPostulacionProveedor,
  EstadoSolicitud,
  ESTADOS_SOLICITUD_LISTA,
} from "./estados-solicitud.const";
import { Rol, ROLES_DISPONIBLES } from "./roles.const";

/** Matriz genérica: rol → estado → acciones. */
export type AccionesPorRolYEstado<
  E extends string,
  A extends string,
> = Readonly<Partial<Record<Rol, Partial<Record<E, readonly A[]>>>>>;

export type AccionesSolicitudPorRolYEstado = AccionesPorRolYEstado<
  EstadoSolicitud,
  AccionSolicitud
>;

export type AccionesInvitacionPorRolYEstado = AccionesPorRolYEstado<
  EstadoPostulacionProveedor,
  AccionInvitacionProveedor
>;

export type AccionesOferentePorRolYEstado = AccionesPorRolYEstado<
  EstadoOferente,
  AccionOferente
>;

export type AccionesComparadorPorRolYEstado = AccionesPorRolYEstado<
  EstadoSolicitud,
  AccionComparador
>;

export type AccionesDetalleProveedorPorRolYEstado = AccionesPorRolYEstado<
  EstadoSolicitud,
  AccionDetalleProveedor
>;

export type AccionesDecisionPorRolYEstado = AccionesPorRolYEstado<
  EstadoSolicitud,
  AccionDecision
>;

export type AccionesSubsanacionPorRolYEstado = AccionesPorRolYEstado<
  EstadoSolicitud,
  AccionSubsanacion
>;

export type AccionesEstudioMercadoPorRolYEstado = AccionesPorRolYEstado<
  EstadoEstudioMercado,
  AccionEstudioMercado
>;

/**
 * Forma laxa que consume `RolService.mostrarAcciones` para decidir si la
 * columna de acciones tiene algo que ofrecer a los roles del usuario.
 */
export type MatrizAccionesPorRol = Readonly<
  Partial<Record<string, Partial<Record<string, readonly string[]>>>>
>;

/* ─────────────────── Área solicitante (JD y OG) ─────────────────── */

/**
 * Acciones base del área solicitante.
 *
 * Hoy la comparten `JEFE_DEPENDENCIA` y `ORDENADOR_DEL_GASTO`: ambos crean,
 * editan y cancelan solicitudes. El OG añade encima sus acciones exclusivas
 * (O-01 a O-04) cuando esas pantallas existan.
 *
 * `formular-observacion` no aparece aquí: es acción del proveedor y vive en
 * `ACCIONES_INVITACION_POR_ROL_Y_ESTADO`.
 */
const ACCIONES_SOLICITANTE: Partial<
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

export const ACCIONES_SOLICITUD_POR_ROL_Y_ESTADO: AccionesSolicitudPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_SOLICITANTE,

    [environment.ROL.ORDENADOR_DEL_GASTO]: {
      ...ACCIONES_SOLICITANTE,
      /*
       * Punto de extensión de las acciones exclusivas del OG (O-01 a O-04):
       * aceptar/rechazar modificaciones y aprobar/rechazar la cotización
       * enviada a validación con proveedor seleccionado. Se agregan aquí
       * cuando existan las pantallas y sus rutas; ejemplo:
       *
       *   "en-aprobacion": [
       *     ...(ACCIONES_SOLICITANTE["en-aprobacion"] ?? []),
       *     "validar",
       *   ],
       */
    },

    [environment.ROL.PROVEEDOR]: {
      // El proveedor entra por su propio módulo; aquí solo puede consultar.
      borrador: ["ver-detalle"],
      "enviada-proveedores": ["ver-detalle"],
      "en-aprobacion": ["ver-detalle"],
      "enviada-con-modificaciones": ["ver-detalle"],
      "en-evaluacion": ["ver-detalle"],
      adjudicada: ["ver-detalle"],
      desierta: ["ver-detalle"],
      cancelada: ["ver-detalle"],
    },
  };

/* ───────────────────── Área proveedor (P-01 a P-04) ───────────────────── */

export const ACCIONES_INVITACION_POR_ROL_Y_ESTADO: AccionesInvitacionPorRolYEstado =
  {
    [environment.ROL.PROVEEDOR]: {
      borrador: [
        "ver-detalle-proveedor",
        "observar",
        "formular-observacion",
        "responder",
        "descargar-anexo",
      ],
      enviada: [
        "ver-detalle-proveedor",
        "observar",
        "formular-observacion",
        "actualizar",
        "descargar-anexo",
      ],
      "pendiente-ajuste": [
        "ver-detalle-proveedor",
        "observar",
        "formular-observacion",
        "actualizar",
        "descargar-anexo",
      ],
      excluida: ["ver-detalle-proveedor", "observar", "descargar-anexo"],
      aceptada: ["ver-detalle-proveedor", "observar", "descargar-anexo"],
      rechazada: ["ver-detalle-proveedor", "observar", "descargar-anexo"],
      declinada: ["ver-detalle-proveedor", "observar", "descargar-anexo"],
      vencida: ["ver-detalle-proveedor", "observar", "descargar-anexo"],
    },
  };

/* ───────────────────── Tablero de oferentes (S-07) ───────────────────── */

/**
 * Acciones base de una fila del tablero.
 *
 * La matriz solo expresa qué acciones corresponden al estado del oferente; las
 * reglas adicionales (existencia de observaciones, respuesta radicada y cierre
 * del periodo) las aplica `PermisosSolicitudService`, no las plantillas.
 *
 * El punto de extensión del OG son las acciones de selección/validación de
 * S-11, que se agregarán aquí cuando exista esa pantalla.
 */
const ACCIONES_OFERENTE_BASE: Partial<
  Record<EstadoOferente, readonly AccionOferente[]>
> = {
  cotizo: [
    "ver-oferente",
    "ver-observaciones",
    "ver-cotizacion",
    "ver-respuesta",
    "continuar-decision",
  ],
  modifico: [
    "ver-oferente",
    "ver-observaciones",
    "ver-cotizacion",
    "ver-respuesta",
    "continuar-decision",
  ],
  observo: ["ver-oferente", "ver-observaciones"],
  notificado: ["ver-oferente"],
  "sin-respuesta": ["ver-oferente"],
  "pendiente-ajuste": ["ver-oferente", "ver-observaciones"],
};

export const ACCIONES_OFERENTE_POR_ROL_Y_ESTADO: AccionesOferentePorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_OFERENTE_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_OFERENTE_BASE,
  };

/* ───────────────── Comparador de cotizaciones (S-09) ──────────────────── */

/**
 * Acciones del comparador.
 *
 * El comparador es de solo lectura: la selección del proveedor se hace al
 * enviarlo a validación desde S-07. Aquí solo se consulta y se exporta.
 */
const ACCIONES_COMPARADOR_BASE: Partial<
  Record<EstadoSolicitud, readonly AccionComparador[]>
> = {
  "enviada-proveedores": ["ver-oferta", "exportar"],
  "enviada-con-modificaciones": ["ver-oferta", "exportar"],
  "en-evaluacion": ["ver-oferta", "exportar"],
  "en-aprobacion": ["ver-oferta", "exportar"],
  adjudicada: ["ver-oferta", "exportar"],
  desierta: ["ver-oferta", "exportar"],
};

export const ACCIONES_COMPARADOR_POR_ROL_Y_ESTADO: AccionesComparadorPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_COMPARADOR_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_COMPARADOR_BASE,
  };

/* ────────────────── Detalle del proveedor y su oferta (S-10) ──────────── */

/**
 * Acciones con efecto del detalle del proveedor.
 *
 * La pantalla es de solo consulta; la única acción es enviar la oferta a
 * validación desde la cabecera. La selección ya no se hace con preselección.
 */
const ACCIONES_DETALLE_PROVEEDOR_BASE: Partial<
  Record<EstadoSolicitud, readonly AccionDetalleProveedor[]>
> = {
  "enviada-proveedores": ["continuar-decision"],
  "enviada-con-modificaciones": ["continuar-decision"],
  "en-evaluacion": ["continuar-decision"],
  "en-aprobacion": ["continuar-decision"],
  adjudicada: [],
  desierta: ["continuar-decision"],
};

export const ACCIONES_DETALLE_PROVEEDOR_POR_ROL_Y_ESTADO: AccionesDetalleProveedorPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_DETALLE_PROVEEDOR_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_DETALLE_PROVEEDOR_BASE,
  };

/* ─────────────────── Decisión y envío a validación (S-11) ─────────────────── */

/**
 * Acciones del trámite de decisión.
 *
 * S-11 solo registra el envío a validación: lo pueden hacer el Jefe de
 * Dependencia y el Ordenador del Gasto. La validación final (aprobar o
 * rechazar) no vive aquí: corresponde a las vistas exclusivas del OG
 * (O-01 a O-04), que se implementarán después.
 *
 * `desierta` aparece para permitir el reenvío después de un rechazo. La regla
 * fina (solo si hay una decisión rechazada y el proveedor es distinto del
 * rechazado) la aplica `PermisosSolicitudService` y el servicio.
 */
const ACCIONES_DECISION_ENVIO: Partial<
  Record<EstadoSolicitud, readonly AccionDecision[]>
> = {
  "enviada-proveedores": ["enviar-a-validacion"],
  "enviada-con-modificaciones": ["enviar-a-validacion"],
  "en-evaluacion": ["enviar-a-validacion"],
  desierta: ["enviar-a-validacion"],
};

export const ACCIONES_DECISION_POR_ROL_Y_ESTADO: AccionesDecisionPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_DECISION_ENVIO,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_DECISION_ENVIO,
  };

/* ───────────────────── Subsanación documental (S-12) ───────────────────── */

/**
 * Acciones del periodo de subsanación.
 *
 * Solo se configura cuando la solicitud está en `en-evaluacion`: antes de esa
 * etapa todavía hay proveedores que no han cargado documentos y la subsanación
 * no tendría sentido. En las etapas posteriores solo se conserva el historial.
 */
const ACCIONES_SUBSANACION_BASE: Partial<
  Record<EstadoSolicitud, readonly AccionSubsanacion[]>
> = {
  "en-evaluacion": ["configurar", "ver-historial"],
  "en-aprobacion": ["ver-historial"],
  adjudicada: ["ver-historial"],
  desierta: ["ver-historial"],
};

export const ACCIONES_SUBSANACION_POR_ROL_Y_ESTADO: AccionesSubsanacionPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_SUBSANACION_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_SUBSANACION_BASE,
  };

/* ────────────────────── Estudios de mercado (S-13) ────────────────────── */

/**
 * Acciones del estudio de mercado.
 *
 * El ciclo es propio y no depende de `EstadoSolicitud`. El borrador se puede
 * continuar y descartar; con invitaciones cursadas solo se consulta, se
 * invitan más proveedores y se exporta. La aprobación final no vive en esta
 * entrega: `aprobado` solo aparece en los datos semilla.
 */
const ACCIONES_ESTUDIO_MERCADO_BASE: Partial<
  Record<EstadoEstudioMercado, readonly AccionEstudioMercado[]>
> = {
  borrador: ["ver-detalle", "editar", "invitar-proveedores", "descartar"],
  "en-recepcion": ["ver-detalle", "invitar-proveedores", "exportar"],
  cerrado: ["ver-detalle", "exportar"],
  aprobado: ["ver-detalle", "exportar"],
  descartado: ["ver-detalle"],
};

export const ACCIONES_ESTUDIO_MERCADO_POR_ROL_Y_ESTADO: AccionesEstudioMercadoPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_ESTUDIO_MERCADO_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_ESTUDIO_MERCADO_BASE,
  };


/* ─────────────────────────────── Helpers ─────────────────────────────── */

/**
 * Acciones que el usuario ve en un estado, uniendo todos sus roles.
 *
 * Un usuario puede tener varios roles a la vez: se acumulan sin duplicados.
 */
export function accionesSolicitudPorRoles(
  roles: readonly Rol[],
  estado: EstadoSolicitud,
): readonly AccionSolicitud[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_SOLICITUD_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones de un oferente en un estado, uniendo todos los roles del usuario. */
export function accionesOferentePorRoles(
  roles: readonly Rol[],
  estado: EstadoOferente,
): readonly AccionOferente[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_OFERENTE_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones del comparador en un estado, uniendo todos los roles. */
export function accionesComparadorPorRoles(
  roles: readonly Rol[],
  estado: EstadoSolicitud,
): readonly AccionComparador[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_COMPARADOR_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones del detalle del proveedor en un estado, uniendo todos los roles. */
export function accionesDetalleProveedorPorRoles(
  roles: readonly Rol[],
  estado: EstadoSolicitud,
): readonly AccionDetalleProveedor[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_DETALLE_PROVEEDOR_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones del trámite de decisión en un estado, uniendo todos los roles. */
export function accionesDecisionPorRoles(
  roles: readonly Rol[],
  estado: EstadoSolicitud,
): readonly AccionDecision[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_DECISION_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones de subsanación en un estado, uniendo todos los roles. */
export function accionesSubsanacionPorRoles(
  roles: readonly Rol[],
  estado: EstadoSolicitud,
): readonly AccionSubsanacion[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_SUBSANACION_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/** Acciones de un estudio de mercado en un estado, uniendo todos los roles. */
export function accionesEstudioPorRoles(
  roles: readonly Rol[],
  estado: EstadoEstudioMercado,
): readonly AccionEstudioMercado[] {
  const acciones = roles.flatMap(
    (rol) => ACCIONES_ESTUDIO_MERCADO_POR_ROL_Y_ESTADO[rol]?.[estado] ?? [],
  );
  return Array.from(new Set(acciones));
}

/**
 * Acciones por estado del área solicitante, sin mirar el rol.
 *
 * Se deriva de la matriz de roles para no mantener dos fuentes: la usan los
 * guards de la capa de datos (`cancelar`, `foro`), que razonan sobre el estado
 * y no sobre quién está mirando.
 */
export const ACCIONES_SOLICITUD_POR_ESTADO: Readonly<
  Record<EstadoSolicitud, readonly AccionSolicitud[]>
> = ESTADOS_SOLICITUD_LISTA.reduce(
  (acumulado, estado) => {
    acumulado[estado] = accionesSolicitudPorRoles(
      ROLES_DISPONIBLES,
      estado,
    );
    return acumulado;
  },
  {} as Record<EstadoSolicitud, readonly AccionSolicitud[]>,
);

/**
 * Acciones del trámite de decisión por estado, sin mirar el rol.
 *
 * La usa la capa de datos (`registrarEnvioDecision`) para validar que el estado
 * permite el envío. La pantalla sigue consultando la matriz por rol a través de
 * `PermisosSolicitudService`.
 */
export const ACCIONES_DECISION_POR_ESTADO: Readonly<
  Record<EstadoSolicitud, readonly AccionDecision[]>
> = ESTADOS_SOLICITUD_LISTA.reduce(
  (acumulado, estado) => {
    acumulado[estado] = accionesDecisionPorRoles(ROLES_DISPONIBLES, estado);
    return acumulado;
  },
  {} as Record<EstadoSolicitud, readonly AccionDecision[]>,
);
