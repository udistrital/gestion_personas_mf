import { Injectable, inject } from "@angular/core";
import { RolService } from "./rol.service";
import {
  ACCIONES_COMPARADOR,
  ACCIONES_INVITACION_PROVEEDOR,
  ACCIONES_OFERENTE,
  ACCIONES_SOLICITUD,
  AccionComparador,
  AccionComparadorMeta,
  AccionInvitacionProveedor,
  AccionOferente,
  AccionSolicitud,
  AccionSolicitudMeta,
  ESTADOS_SOLICITUD,
  EstadoSolicitud,
  MATRIZ_SOLICITUD_PERMITE_RESPUESTA,
} from "../constants/estados-solicitud.const";
import {
  ACCIONES_INVITACION_POR_ROL_Y_ESTADO,
  accionesComparadorPorRoles,
  accionesOferentePorRoles,
  accionesSolicitudPorRoles,
} from "../constants/acciones-por-rol-y-estado.const";
import type {
  InvitacionProveedor,
} from "src/app/modules/cotizaciones/models/invitacion-proveedor.model";
import type { OferenteTablero } from "src/app/modules/cotizaciones/models/oferente.model";
import { cierreSolicitudVencido } from "src/app/modules/cotizaciones/models/solicitud.model";
import type { Solicitud } from "src/app/modules/cotizaciones/models/solicitud.model";
import {
  ROLES_SOLICITANTE,
  ROL_PROVEEDOR,
} from "../constants/roles.const";

/** Contrato mínimo que la capa de datos debe garantizar para evaluar permisos. */
export interface SolicitudPermisable {
  readonly estado: EstadoSolicitud;
}

export type InvitacionPermisable = Pick<InvitacionProveedor, "estado">;
type SolicitudForoPermisable = Pick<
  Solicitud,
  "estado" | "cierre" | "fechaLimiteObservaciones"
>;

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
   * dependen de los datos (observaciones, respuesta radicada) y del cierre.
   */
  accionesOferentePermitidas(
    oferente: OferenteTablero,
    solicitud: Pick<Solicitud, "estado" | "cierre">,
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
        if (accion === "ver-observaciones") {
          return oferente.observaciones > 0 && this.puede("foro", solicitud);
        }
        // ver-cotizacion / ver-respuesta
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
        if (accion === "ver-detalle-proveedor") {
          return true;
        }
        if (accion === "observar") {
          return true;
        }
        if (accion === "formular-observacion") {
          return this.puedeFormularObservacion(invitacion, solicitud);
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
