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
  AccionDetalleProveedor,
  AccionInvitacionProveedor,
  AccionOferente,
  AccionSolicitud,
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
        "descargar-anexo",
      ],
      "pendiente-ajuste": [
        "ver-detalle-proveedor",
        "observar",
        "formular-observacion",
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
  ],
  modifico: [
    "ver-oferente",
    "ver-observaciones",
    "ver-cotizacion",
    "ver-respuesta",
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
 * JD y OG comparten las mismas acciones: ambos pueden preseleccionar una oferta
 * como recomendación y continuar a S-11. La decisión final sigue siendo del OG
 * (RN-34) y se implementará en esa pantalla, no aquí.
 *
 * En `adjudicada` el comparador es de solo lectura: no se preselecciona ni se
 * retira la preselección.
 */
const ACCIONES_COMPARADOR_BASE: Partial<
  Record<EstadoSolicitud, readonly AccionComparador[]>
> = {
  "enviada-proveedores": [
    "ver-oferta",
    "preseleccionar",
    "quitar-preseleccion",
    "exportar",
    "continuar-decision",
  ],
  "enviada-con-modificaciones": [
    "ver-oferta",
    "preseleccionar",
    "quitar-preseleccion",
    "exportar",
    "continuar-decision",
  ],
  "en-evaluacion": [
    "ver-oferta",
    "preseleccionar",
    "quitar-preseleccion",
    "exportar",
    "continuar-decision",
  ],
  "en-aprobacion": [
    "ver-oferta",
    "preseleccionar",
    "quitar-preseleccion",
    "exportar",
    "continuar-decision",
  ],
  adjudicada: ["ver-oferta", "exportar"],
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
 * La pantalla es de solo consulta; las únicas acciones que cambian algo son la
 * preselección y el paso a S-11. Ambas siguen la misma matriz que S-09 para no
 * abrir dos caminos distintos al mismo estado.
 */
const ACCIONES_DETALLE_PROVEEDOR_BASE: Partial<
  Record<EstadoSolicitud, readonly AccionDetalleProveedor[]>
> = {
  "enviada-proveedores": [
    "preseleccionar",
    "quitar-preseleccion",
    "continuar-decision",
  ],
  "enviada-con-modificaciones": [
    "preseleccionar",
    "quitar-preseleccion",
    "continuar-decision",
  ],
  "en-evaluacion": [
    "preseleccionar",
    "quitar-preseleccion",
    "continuar-decision",
  ],
  "en-aprobacion": [
    "preseleccionar",
    "quitar-preseleccion",
    "continuar-decision",
  ],
  adjudicada: [],
};

export const ACCIONES_DETALLE_PROVEEDOR_POR_ROL_Y_ESTADO: AccionesDetalleProveedorPorRolYEstado =
  {
    [environment.ROL.JEFE_DEPENDENCIA]: ACCIONES_DETALLE_PROVEEDOR_BASE,
    [environment.ROL.ORDENADOR_DEL_GASTO]: ACCIONES_DETALLE_PROVEEDOR_BASE,
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
