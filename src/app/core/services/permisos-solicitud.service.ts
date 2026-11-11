import { Injectable, inject } from "@angular/core";
import { RolService } from "./rol.service";
import {
  ACCIONES_COMPARADOR,
  ACCIONES_DECISION,
  ACCIONES_DETALLE_PROVEEDOR,
  ACCIONES_ESTUDIO_MERCADO,
  ACCIONES_INVITACION_PROVEEDOR,
  ACCIONES_OFERENTE,
  ACCIONES_SOLICITUD,
  ACCIONES_SUBSANACION,
  AccionComparador,
  AccionComparadorMeta,
  AccionDecision,
  AccionDecisionMeta,
  AccionDetalleProveedor,
  AccionDetalleProveedorMeta,
  AccionEstudioMercado,
  AccionEstudioMercadoMeta,
  AccionInvitacionProveedor,
  AccionOferente,
  AccionSolicitud,
  AccionSolicitudMeta,
  AccionSubsanacion,
  AccionSubsanacionMeta,
  ESTADOS_ACTUALIZACION_RESPUESTA,
  ESTADOS_SOLICITUD,
  EstadoActualizacionRespuesta,
  EstadoEstudioMercado,
  EstadoSolicitud,
  MATRIZ_SOLICITUD_PERMITE_ACTUALIZACION,
  MATRIZ_SOLICITUD_PERMITE_RESPUESTA,
} from "../constants/estados-solicitud.const";
import {
  ACCIONES_INVITACION_POR_ROL_Y_ESTADO,
  accionesComparadorPorRoles,
  accionesDecisionPorRoles,
  accionesDetalleProveedorPorRoles,
  accionesEstudioPorRoles,
  accionesOferentePorRoles,
  accionesSolicitudPorRoles,
  accionesSubsanacionPorRoles,
} from "../constants/acciones-por-rol-y-estado.const";
import type {
  DecisionSolicitud,
} from "src/app/modules/cotizaciones/models/decision.model";
import { decisionDeProveedor } from "src/app/modules/cotizaciones/models/decision.model";
import type {
  InvitacionProveedor,
} from "src/app/modules/cotizaciones/models/invitacion-proveedor.model";
import type { OferenteTablero } from "src/app/modules/cotizaciones/models/oferente.model";
import type { Subsanacion } from "src/app/modules/cotizaciones/models/subsanacion.model";
import { cierreSolicitudVencido } from "src/app/modules/cotizaciones/models/solicitud.model";
import type { Solicitud } from "src/app/modules/cotizaciones/models/solicitud.model";
import {
  ROLES_SOLICITANTE,
  ROL_PROVEEDOR,
} from "../constants/roles.const";

/** Contrato mínimo que la capa de datos debe garantizar para evaluar permisos. */
export interface SolicitudPermisable {
  readonly estado: EstadoSolicitud;
  /** Envío a validación y, si existe, decisión final del OG. */
  readonly decision?: DecisionSolicitud;
  /** Decisiones anteriores de reenvíos tras un rechazo. */
  readonly historialDecisiones?: readonly DecisionSolicitud[];
}

export type InvitacionPermisable = Pick<
  InvitacionProveedor,
  "estado" | "adendaPublicada" | "respuestaVigente"
>;
type SolicitudForoPermisable = Pick<
  Solicitud,
  "estado" | "cierre" | "fechaLimiteObservaciones"
>;
/** Solicitud con los datos que necesitan los permisos de S-11. */
export type SolicitudDecisionPermisable = Pick<
  Solicitud,
  "estado" | "cierre" | "decision" | "historialDecisiones"
>;

/** Solicitud con los datos que necesitan los permisos de S-12. */
export interface SolicitudSubsanacionPermisable {
  readonly estado: EstadoSolicitud;
  readonly cierre: string | null;
  readonly decision?: DecisionSolicitud;
  readonly subsanacion?: Subsanacion | null;
}

/** Estudio de mercado con los datos que necesitan los permisos de S-13. */
export interface EstudioPermisable {
  readonly estado: EstadoEstudioMercado;
}

@Injectable({ providedIn: "root" })
export class PermisosSolicitudService {
  private readonly rol = inject(RolService);

  /**
   * Acciones que el menú de la fila debe mostrar para esa solicitud.
   *
   * Se resuelven con la matriz rol+estado: si el usuario tiene varios roles se
   * acumulan (sin duplicados) y sin roles conocidos no se ofrece ninguna.
   */
  accionesPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionSolicitud[] {
    if (!this.rol.estaCargado()) {
      return [];
    }
    return accionesSolicitudPorRoles(this.rol.roles(), solicitud.estado);
  }

  /** true si la acción está permitida en el estado de la solicitud. */
  puede(accion: AccionSolicitud, solicitud: SolicitudPermisable): boolean {
    return this.accionesPermitidas(solicitud).includes(accion);
  }

  /** Texto visible de un estado (para `aria-label` y textos de apoyo). */
  etiquetaEstado(estado: EstadoSolicitud): string {
    return ESTADOS_SOLICITUD[estado]?.etiqueta ?? estado;
  }

  /**
   * Etiqueta contextual de una acción.
   *
   * S-04 necesita distinguir "Modificar" (borrador) de "Solicitar
   * modificación" (solicitud ya enviada) sin duplicar esa regla en las
   * pantallas.
   */
  etiquetaAccion(
    accion: AccionSolicitud,
    solicitud: SolicitudPermisable,
  ): string {
    const meta = ACCIONES_SOLICITUD[accion];
    return meta.etiquetaPorEstado?.[solicitud.estado] ?? meta.etiqueta;
  }

  /**
   * Ruta contextual de una acción.
   *
   * Devuelve la plantilla con `:id` para que la pantalla sustituya el
   * identificador; `null` cuando la acción todavía no tiene destino.
   */
  rutaAccion(
    accion: AccionSolicitud,
    solicitud: SolicitudPermisable,
  ): string | null {
    const meta: AccionSolicitudMeta = ACCIONES_SOLICITUD[accion];
    return meta.rutaPorEstado?.[solicitud.estado] ?? meta.ruta;
  }

  /* ───────────────────── Estudios de mercado (S-13) ───────────────────── */

  /**
   * Acciones que el menú de la fila ofrece para un estudio de mercado.
   *
   * Usa la matriz rol+estado propia del estudio; no reutiliza la matriz de
   * solicitudes porque el ciclo de vida es distinto.
   */
  accionesEstudioPermitidas(
    estudio: EstudioPermisable,
  ): readonly AccionEstudioMercado[] {
    if (!this.rol.estaCargado()) {
      return [];
    }
    return accionesEstudioPorRoles(this.rol.roles(), estudio.estado);
  }

  /** true si el usuario puede crear estudios de mercado. */
  puedeCrearEstudio(): boolean {
    return this.rol.permisoCreacion(ROLES_SOLICITANTE);
  }

  /** Etiqueta visible de una acción del estudio. */
  etiquetaAccionEstudio(accion: AccionEstudioMercado): string {
    return ACCIONES_ESTUDIO_MERCADO[accion].etiqueta;
  }

  /** Ruta plantilla de una acción del estudio; `null` si la maneja la página. */
  rutaAccionEstudio(accion: AccionEstudioMercado): string | null {
    const meta: AccionEstudioMercadoMeta = ACCIONES_ESTUDIO_MERCADO[accion];
    return meta.ruta;
  }

  /** true si la acción del estudio es destructiva. */
  esPeligroEstudio(accion: AccionEstudioMercado): boolean {
    return ACCIONES_ESTUDIO_MERCADO[accion].peligro === true;
  }

  /* ───────────────────── Tablero de oferentes (S-07) ───────────────────── */

  /**
   * true si el usuario puede abrir el tablero de oferentes.
   *
   * Combina el rol (JD/OG) con la matriz de estados de la solicitud; el estado
   * de presentación de cada oferente se evalúa después.
   */
  puedeAccederTableroOferentes(solicitud: SolicitudPermisable): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      this.puede("oferentes", solicitud)
    );
  }

  /**
   * RN-29: las respuestas y cotizaciones solo se consultan cuando terminó el
   * periodo de cotización.
   */
  puedeVerOfertas(solicitud: Pick<Solicitud, "cierre">): boolean {
    return cierreSolicitudVencido(solicitud.cierre);
  }

  /**
   * Acciones disponibles para una fila del tablero.
   *
   * La matriz rol+estado decide la base; aquí se aplican las reglas que
   * dependen de los datos (observaciones, respuesta radicada), del cierre y de
   * la decisión. `continuar-decision` aparece en todas las ofertas mientras no
   * haya una decisión vigente (o la vigente esté rechazada y el proveedor no
   * sea el rechazado). `ver-respuesta` solo se muestra para proveedores que
   * tengan una respuesta del Ordenador del Gasto, actual o histórica.
   */
  accionesOferentePermitidas(
    oferente: OferenteTablero,
    solicitud: Pick<
      Solicitud,
      "estado" | "cierre" | "decision" | "historialDecisiones"
    >,
  ): readonly AccionOferente[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    ) {
      return [];
    }

    const verOfertas = this.puedeVerOfertas(solicitud);
    return accionesOferentePorRoles(this.rol.roles(), oferente.estado).filter(
      (accion) => {
        if (accion === "ver-oferente") {
          return true;
        }
        if (accion === "continuar-decision") {
          return this.puedeEnviarAValidacion(
            solicitud,
            oferente.proveedor.id,
          );
        }
        if (accion === "ver-respuesta") {
          return (
            !!decisionDeProveedor(solicitud, oferente.proveedor.id) &&
            verOfertas
          );
        }
        if (accion === "ver-observaciones") {
          return oferente.observaciones > 0 && this.puede("foro", solicitud);
        }
        // ver-cotizacion
        return !!oferente.respuesta && verOfertas;
      },
    );
  }

  /** Texto visible de una acción de oferente. */
  etiquetaAccionOferente(accion: AccionOferente): string {
    return ACCIONES_OFERENTE[accion].etiqueta;
  }

  /**
   * Comandos de navegación de una acción de oferente.
   *
   * No resuelve los `queryParams` (por ejemplo el proveedor del foro): eso lo
   * decide la pantalla que conoce el contexto de la fila.
   */
  rutaAccionOferente(
    accion: AccionOferente,
    oferente: OferenteTablero,
  ): readonly string[] {
    return ACCIONES_OFERENTE[accion].ruta
      .split("/")
      .map((segmento) => {
        if (segmento === ":id") {
          return oferente.invitacion.solicitudId;
        }
        if (segmento === ":proveedorId") {
          return oferente.proveedor.id;
        }
        return segmento;
      });
  }

  /* ───────────────── Decisión y envío a validación (S-11) ───────────────── */

  /**
   * true si el usuario pertenece a los roles que pueden abrir S-11.
   *
   * S-11 es la vista de envío a validación: la comparten JD y OG. La validación
   * final (aprobar/rechazar) vive en las vistas exclusivas del OG (O-01 a O-04)
   * y no se ofrece aquí. Los estados y la decisión se evalúan por separado.
   */
  puedeAccederDecision(): boolean {
    return (
      this.rol.estaCargado() && this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    );
  }

  /** Acciones del trámite de decisión según los roles y el estado. */
  accionesDecisionPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionDecision[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    ) {
      return [];
    }
    return accionesDecisionPorRoles(this.rol.roles(), solicitud.estado);
  }

  /**
   * true si la oferta puede enviarse a validación.
   *
   * Exige que el cierre haya vencido (RN-29) y que la matriz permita la acción.
   * Si ya existe una decisión, solo se permite reenviar cuando la vigente fue
   * rechazada y el proveedor es distinto del rechazado. Una solicitud `desierta`
   * sin decisión registrada (fila antigua) no habilita el envío.
   */
  puedeEnviarAValidacion(
    solicitud: SolicitudDecisionPermisable,
    proveedorId?: string,
  ): boolean {
    const decision = solicitud.decision;
    const decisionProveedor = proveedorId
      ? decisionDeProveedor(solicitud, proveedorId)
      : decision;
    const reenvio = decision?.fase === "rechazada";

    // Ningún proveedor rechazado (ni el vigente ni uno histórico) puede
    // volver a enviarse.
    if (decisionProveedor?.fase === "rechazada") {
      return false;
    }
    if (decision && !reenvio) {
      return false;
    }
    if (solicitud.estado === "desierta" && !reenvio) {
      return false;
    }

    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      this.puedeVerOfertas(solicitud) &&
      this.accionesDecisionPermitidas(solicitud).includes(
        "enviar-a-validacion",
      )
    );
  }

  /** true si ya existe un envío o un resultado consultable. */
  puedeVerDecision(
    solicitud: Pick<Solicitud, "estado" | "decision">,
  ): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      (!!solicitud.decision ||
        solicitud.estado === "adjudicada" ||
        solicitud.estado === "desierta")
    );
  }

  /** Texto visible de una acción del trámite de decisión. */
  etiquetaAccionDecision(accion: AccionDecision): string {
    const meta: AccionDecisionMeta = ACCIONES_DECISION[accion];
    return meta.etiqueta;
  }

  /* ───────────────── Comparador de cotizaciones (S-09) ───────────────── */

  /**
   * true si el usuario puede abrir el comparador.
   *
   * Reutiliza la misma compuerta que S-07 (rol + estado) y deja que la pantalla
   * aplique RN-29: antes del cierre se muestra el estado bloqueado, no la data.
   */
  puedeAccederComparador(solicitud: SolicitudPermisable): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      this.puede("oferentes", solicitud)
    );
  }

  /** Acciones del comparador según los roles del usuario y el estado. */
  accionesComparadorPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionComparador[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    ) {
      return [];
    }
    return accionesComparadorPorRoles(this.rol.roles(), solicitud.estado);
  }

  /** Texto visible de una acción del comparador. */
  etiquetaAccionComparador(accion: AccionComparador): string {
    return ACCIONES_COMPARADOR[accion].etiqueta;
  }

  /** Comandos de navegación de una acción del comparador. */
  rutaAccionComparador(
    accion: AccionComparador,
    solicitudId: string,
    proveedorId?: string,
  ): readonly string[] | null {
    const meta: AccionComparadorMeta = ACCIONES_COMPARADOR[accion];
    if (!meta.ruta) {
      return null;
    }
    return meta.ruta
      .split("/")
      .map((segmento) => {
        if (segmento === ":id") {
          return solicitudId;
        }
        if (segmento === ":proveedorId") {
          return proveedorId ?? segmento;
        }
        return segmento;
      });
  }

  /* ───────────── Detalle del proveedor y su oferta (S-10) ───────────── */

  /**
   * true si el usuario puede abrir el detalle del proveedor.
   *
   * Comparte la compuerta de S-07/S-09 (rol + estado). RN-29 se aplica en la
   * pantalla: antes del cierre se muestra el estado bloqueado, no la oferta.
   */
  puedeAccederDetalleProveedor(solicitud: SolicitudPermisable): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      this.puede("oferentes", solicitud)
    );
  }

  /** Acciones con efecto del detalle del proveedor según rol y estado. */
  accionesDetalleProveedorPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionDetalleProveedor[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    ) {
      return [];
    }

    // Con una decisión pendiente o aprobada no se ofrece un nuevo envío. Si fue
    // rechazada, la pantalla decide si el proveedor actual puede reenviarse.
    if (solicitud.decision && solicitud.decision.fase !== "rechazada") {
      return [];
    }
    if (solicitud.estado === "desierta" && !solicitud.decision) {
      return [];
    }

    return accionesDetalleProveedorPorRoles(
      this.rol.roles(),
      solicitud.estado,
    );
  }

  /** Texto visible de una acción del detalle del proveedor. */
  etiquetaAccionDetalleProveedor(accion: AccionDetalleProveedor): string {
    return ACCIONES_DETALLE_PROVEEDOR[accion].etiqueta;
  }

  /** Comandos de navegación de una acción del detalle del proveedor. */
  rutaAccionDetalleProveedor(
    accion: AccionDetalleProveedor,
    solicitudId: string,
  ): readonly string[] | null {
    const meta: AccionDetalleProveedorMeta =
      ACCIONES_DETALLE_PROVEEDOR[accion];
    if (!meta.ruta) {
      return null;
    }
    return meta.ruta
      .split("/")
      .map((segmento) => (segmento === ":id" ? solicitudId : segmento));
  }

  /* ─────────────────── Subsanación documental (S-12) ─────────────────── */

  /** true si el usuario pertenece a los roles del área solicitante. */
  puedeVerSubsanacionPorRol(): boolean {
    return (
      this.rol.estaCargado() && this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    );
  }

  /**
   * true si el usuario puede abrir la subsanación.
   *
   * Comparte la compuerta de S-07/S-10 (rol + estado) y exige que el periodo de
   * cotización haya terminado. Configurar solo se permite en `en-evaluacion`;
   * en las etapas posteriores la vista queda como historial de solo lectura.
   */
  puedeAccederSubsanacion(solicitud: SolicitudSubsanacionPermisable): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneAlgunRol(ROLES_SOLICITANTE) &&
      this.puedeVerOfertas(solicitud) &&
      this.accionesSubsanacionPermitidas(solicitud).length > 0
    );
  }

  /** Acciones de subsanación según los roles del usuario y el estado. */
  accionesSubsanacionPermitidas(
    solicitud: SolicitudSubsanacionPermisable,
  ): readonly AccionSubsanacion[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneAlgunRol(ROLES_SOLICITANTE)
    ) {
      return [];
    }
    return accionesSubsanacionPorRoles(this.rol.roles(), solicitud.estado);
  }

  /**
   * true si se puede configurar un periodo nuevo.
   *
   * Exige `en-evaluacion`, cierre vencido, ausencia de decisión y que no exista
   * un periodo vigente. Un periodo cancelado no bloquea uno nuevo.
   */
  puedeConfigurarSubsanacion(
    solicitud: SolicitudSubsanacionPermisable,
  ): boolean {
    if (
      !this.puedeAccederSubsanacion(solicitud) ||
      solicitud.decision ||
      !this.accionesSubsanacionPermitidas(solicitud).includes("configurar")
    ) {
      return false;
    }
    const subsanacion = solicitud.subsanacion;
    return !subsanacion || !!subsanacion.cancelacion;
  }

  /** true si el usuario puede consultar el historial de subsanación. */
  puedeVerHistorialSubsanacion(
    solicitud: SolicitudSubsanacionPermisable,
  ): boolean {
    return (
      this.puedeAccederSubsanacion(solicitud) &&
      this.accionesSubsanacionPermitidas(solicitud).includes("ver-historial")
    );
  }

  /** true si el periodo se puede cancelar (programado o activo). */
  puedeCancelarSubsanacion(
    solicitud: SolicitudSubsanacionPermisable,
  ): boolean {
    const subsanacion = solicitud.subsanacion;
    if (!subsanacion || subsanacion.cancelacion) {
      return false;
    }
    // Una vez enviada la decisión, el periodo deja de admitir cambios.
    if (solicitud.estado !== "en-evaluacion" || solicitud.decision) {
      return false;
    }
    return (
      this.puedeAccederSubsanacion(solicitud) &&
      Date.now() < Date.parse(subsanacion.fin)
    );
  }

  /** true si el periodo se puede ampliar (programado o activo). */
  puedeAmpliarSubsanacion(
    solicitud: SolicitudSubsanacionPermisable,
  ): boolean {
    return this.puedeCancelarSubsanacion(solicitud);
  }

  /** Texto visible de una acción de subsanación. */
  etiquetaAccionSubsanacion(accion: AccionSubsanacion): string {
    return ACCIONES_SUBSANACION[accion].etiqueta;
  }

  /** Comandos de navegación de una acción de subsanación. */
  rutaAccionSubsanacion(
    accion: AccionSubsanacion,
    solicitudId: string,
  ): readonly string[] | null {
    const meta: AccionSubsanacionMeta = ACCIONES_SUBSANACION[accion];
    if (!meta.ruta) {
      return null;
    }
    return meta.ruta
      .split("/")
      .map((segmento) => (segmento === ":id" ? solicitudId : segmento));
  }

  /**
   * Acciones de la invitación para el rol proveedor en un estado dado.
   *
   * Único punto que lee la matriz de invitaciones; el resto de la clase aplica
   * encima las reglas de fecha.
   */
  private accionesInvitacionDe(
    estado: InvitacionPermisable["estado"],
  ): readonly AccionInvitacionProveedor[] {
    return ACCIONES_INVITACION_POR_ROL_Y_ESTADO[ROL_PROVEEDOR]?.[estado] ?? [];
  }

  /** Acciones de la bandeja del proveedor según estado, solicitud y cierre. */
  accionesInvitacionPermitidas(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): readonly AccionInvitacionProveedor[] {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneRol(ROL_PROVEEDOR)
    ) {
      return [];
    }

    return this.accionesInvitacionDe(invitacion.estado).filter(
      (accion) => {
        if (accion === "descargar-anexo") {
          return false;
        }
        if (accion === "ver-mi-cotizacion") {
          return true;
        }
        if (accion === "ver-detalle-proveedor") {
          return true;
        }
        if (accion === "observar") {
          return true;
        }
        if (accion === "formular-observacion") {
          return this.puedeFormularObservacion(invitacion, solicitud);
        }
        if (accion === "actualizar") {
          return this.puedeActualizarInvitacion(invitacion, solicitud);
        }
        return this.puedeResponderInvitacion(invitacion, solicitud);
      },
    ).filter((accion) => accion !== "formular-observacion");
  }

  /** Permiso centralizado para registrar, independiente del acceso de lectura al foro. */
  puedeFormularObservacion(
    invitacion: InvitacionPermisable,
    solicitud: SolicitudForoPermisable,
  ): boolean {
    if (
      !this.rol.estaCargado() ||
      !this.rol.tieneRol(ROL_PROVEEDOR) ||
      !this.accionesInvitacionDe(invitacion.estado).includes(
        "formular-observacion",
      ) ||
      // El foro se abre en la misma ventana que la respuesta (la solicitud
      // debe estar publicada a proveedores, no en borrador ni cerrada).
      !MATRIZ_SOLICITUD_PERMITE_RESPUESTA[solicitud.estado] ||
      this.solicitudCerradaPorFecha(solicitud)
    ) {
      return false;
    }

    const limite = solicitud.fechaLimiteObservaciones;
    return !!limite && Date.parse(limite) > Date.now();
  }

  puedeDescargarAnexo(
    invitacion: InvitacionPermisable,
  ): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneRol(ROL_PROVEEDOR) &&
      this.accionesInvitacionDe(invitacion.estado).includes("descargar-anexo")
    );
  }

  /** Permiso centralizado para abrir P-04 según invitación, estado y cierre. */
  puedeResponderInvitacion(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.tieneRol(ROL_PROVEEDOR) &&
      this.accionesInvitacionDe(invitacion.estado).includes("responder") &&
      MATRIZ_SOLICITUD_PERMITE_RESPUESTA[solicitud.estado] &&
      !this.solicitudCerradaPorFecha(solicitud)
    );
  }

  /**
   * Explica por qué el proveedor no puede responder la invitación.
   *
   * Devuelve una cadena vacía cuando sí puede. P-06 lo usa en el estado vacío;
   * así el motivo sale de la misma matriz que habilita el botón y no de un
   * texto duplicado en la plantilla.
   */
  motivoRespuestaNoDisponible(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): string {
    if (this.puedeResponderInvitacion(invitacion, solicitud)) {
      return "";
    }
    if (!this.rol.estaCargado() || !this.rol.tieneRol(ROL_PROVEEDOR)) {
      return "Su rol no permite responder solicitudes de cotización.";
    }
    if (invitacion.respuestaVigente) {
      return "Ya existe una respuesta radicada. Use «Modificar» si la solicitud cambió mediante adenda.";
    }
    if (!this.accionesInvitacionDe(invitacion.estado).includes("responder")) {
      return "El estado actual de la invitación no permite registrar una respuesta.";
    }
    if (!MATRIZ_SOLICITUD_PERMITE_RESPUESTA[solicitud.estado]) {
      return "El estado actual de la solicitud ya no admite respuestas.";
    }
    if (this.solicitudCerradaPorFecha(solicitud)) {
      return "El plazo de participación terminó: no se registró una cotización a tiempo.";
    }
    return "";
  }

  /** true si el usuario puede consultar su propia cotización (P-06). */
  puedeVerMiCotizacion(): boolean {
    return this.rol.estaCargado() && this.rol.tieneRol(ROL_PROVEEDOR);
  }

  /**
   * Estado derivado de la respuesta frente a la versión vigente (P-05).
   *
   * - `sin-modificacion`: no hay adenda pendiente o la respuesta ya corresponde
   *   a la versión vigente sin haber sido actualizada.
   * - `desactualizada`: hay adenda y la respuesta quedó en una versión anterior.
   * - `actualizada`: la respuesta se actualizó para la versión vigente.
   * - `vencida`: hay actualización pendiente y el plazo terminó.
   */
  estadoActualizacion(
    invitacion: InvitacionPermisable,
    solicitud: Pick<Solicitud, "cierre" | "version">,
  ): EstadoActualizacionRespuesta {
    const respuesta = invitacion.respuestaVigente;
    if (!respuesta) {
      return "sin-modificacion";
    }

    const versionVigente = solicitud.version ?? "v1.0";
    if (respuesta.actualizadaParaVersion === versionVigente) {
      return "actualizada";
    }

    const pendiente =
      !!invitacion.adendaPublicada &&
      respuesta.versionSolicitud !== versionVigente;
    if (!pendiente) {
      return "sin-modificacion";
    }

    return this.solicitudCerradaPorFecha(solicitud)
      ? "vencida"
      : "desactualizada";
  }

  /** Etiqueta visible del estado de actualización. */
  etiquetaEstadoActualizacion(
    estado: EstadoActualizacionRespuesta,
  ): string {
    return ESTADOS_ACTUALIZACION_RESPUESTA[estado].etiqueta;
  }

  /**
   * Permiso centralizado para abrir P-05.
   *
   * Además de la matriz rol+estado, exige una respuesta radicada, una adenda
   * publicada, una versión de solicitud distinta a la respondida y plazo
   * vigente. La regla «una actualización por versión de solicitud» es
   * provisional (RN-42): se implementa como una actualización por adenda.
   */
  puedeActualizarInvitacion(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): boolean {
    return !this.motivoActualizacionNoDisponible(invitacion, solicitud);
  }

  /** Explica por qué no se puede abrir P-05; vacío cuando sí se puede. */
  motivoActualizacionNoDisponible(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): string {
    if (!this.rol.estaCargado() || !this.rol.tieneRol(ROL_PROVEEDOR)) {
      return "Su rol no permite actualizar respuestas de cotización.";
    }
    if (!this.accionesInvitacionDe(invitacion.estado).includes("actualizar")) {
      return "El estado actual de la invitación no permite modificar la respuesta.";
    }
    if (!invitacion.respuestaVigente) {
      return "Todavía no existe una respuesta radicada que se pueda actualizar.";
    }
    if (!invitacion.adendaPublicada) {
      return "La solicitud no tiene una modificación publicada que exija actualizar la respuesta.";
    }
    if (!MATRIZ_SOLICITUD_PERMITE_ACTUALIZACION[solicitud.estado]) {
      return "El estado actual de la solicitud no permite actualizar la respuesta.";
    }
    if (this.solicitudCerradaPorFecha(solicitud)) {
      return "El plazo de participación terminó: ya no es posible actualizar la respuesta.";
    }

    const versionVigente = solicitud.version ?? "v1.0";
    if (
      invitacion.respuestaVigente.actualizadaParaVersion === versionVigente ||
      invitacion.respuestaVigente.versionSolicitud === versionVigente
    ) {
      return "Su respuesta ya corresponde a la versión vigente de la solicitud.";
    }
    return "";
  }

  solicitudCerradaPorFecha(solicitud: Pick<Solicitud, "cierre">): boolean {
    return cierreSolicitudVencido(solicitud.cierre);
  }

  etiquetaAccionInvitacion(accion: AccionInvitacionProveedor): string {
    return ACCIONES_INVITACION_PROVEEDOR[accion].etiqueta;
  }

  rutaAccionInvitacion(
    accion: AccionInvitacionProveedor,
  ): string | null {
    return ACCIONES_INVITACION_PROVEEDOR[accion].ruta;
  }

}
