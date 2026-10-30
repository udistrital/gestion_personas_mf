import { Injectable, inject } from "@angular/core";
import { ROLES_SOLICITANTE } from "../constants/roles.const";
import { RolService } from "./rol.service";
import {
  ACCIONES_INVITACION_PROVEEDOR,
  ACCIONES_SOLICITUD,
  AccionInvitacionProveedor,
  AccionSolicitud,
  AccionSolicitudMeta,
  ESTADOS_SOLICITUD,
  EstadoSolicitud,
  MATRIZ_ACCIONES_INVITACION_PROVEEDOR,
  MATRIZ_ACCIONES_POR_ESTADO,
  MATRIZ_SOLICITUD_PERMITE_RESPUESTA,
} from "../constants/estados-solicitud.const";
import type {
  InvitacionProveedor,
} from "src/app/modules/cotizaciones/models/invitacion-proveedor.model";
import type { Solicitud } from "src/app/modules/cotizaciones/models/solicitud.model";
import { ROL_PROVEEDOR } from "../constants/roles.const";

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

  /** Acciones que el menú de la fila debe mostrar para esa solicitud. */
  accionesPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionSolicitud[] {
    const acciones = MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado] ?? [];
    const accionesSinAccionesProveedor = acciones.filter(
      (accion) => accion !== "formular-observacion",
    );
    if (!this.rol.estaCargado()) {
      return accionesSinAccionesProveedor.filter(
        (accion) => accion !== "cancelar" && accion !== "foro",
      );
    }

    const esSolicitante = ROLES_SOLICITANTE.some((rol) =>
      this.rol.tieneRol(rol),
    );
    return esSolicitante
      ? accionesSinAccionesProveedor
      : accionesSinAccionesProveedor.filter(
          (accion) => accion !== "cancelar" && accion !== "foro",
        );
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

  /** Acciones de la bandeja del proveedor según estado, solicitud y cierre. */
  accionesInvitacionPermitidas(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): readonly AccionInvitacionProveedor[] {
    if (
      !this.rol.estaCargado() ||
      this.rol.getRolActivo() !== ROL_PROVEEDOR
    ) {
      return [];
    }

    return MATRIZ_ACCIONES_INVITACION_PROVEEDOR[invitacion.estado].filter(
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
      this.rol.getRolActivo() !== ROL_PROVEEDOR ||
      !MATRIZ_ACCIONES_INVITACION_PROVEEDOR[invitacion.estado].includes(
        "formular-observacion",
      ) ||
      !MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado].includes(
        "formular-observacion",
      ) ||
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
      this.rol.getRolActivo() === ROL_PROVEEDOR &&
      MATRIZ_ACCIONES_INVITACION_PROVEEDOR[invitacion.estado].includes(
        "descargar-anexo",
      )
    );
  }

  /** Permiso centralizado para abrir P-04 según invitación, estado y cierre. */
  puedeResponderInvitacion(
    invitacion: InvitacionPermisable,
    solicitud: Solicitud,
  ): boolean {
    return (
      this.rol.estaCargado() &&
      this.rol.getRolActivo() === ROL_PROVEEDOR &&
      MATRIZ_ACCIONES_INVITACION_PROVEEDOR[invitacion.estado].includes(
        "responder",
      ) &&
      MATRIZ_SOLICITUD_PERMITE_RESPUESTA[solicitud.estado] &&
      !this.solicitudCerradaPorFecha(solicitud)
    );
  }

  solicitudCerradaPorFecha(solicitud: Pick<Solicitud, "cierre">): boolean {
    const cierre = fechaCierreDeSolicitud(solicitud.cierre);
    return cierre !== null && cierre <= Date.now();
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

/** El cierre visible dd/MM/yyyy vence a las 23:59 de esa misma fecha. */
function fechaCierreDeSolicitud(cierre: string | null): number | null {
  if (!cierre) {
    return null;
  }

  const [dia, mes, anio] = cierre.split("/").map(Number);
  const fechaValidacion = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    !dia ||
    !mes ||
    !anio ||
    fechaValidacion.getUTCDate() !== dia ||
    fechaValidacion.getUTCMonth() !== mes - 1 ||
    fechaValidacion.getUTCFullYear() !== anio
  ) {
    return null;
  }

  const fechaIso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return Date.parse(`${fechaIso}T23:59:59.999-05:00`);
}
