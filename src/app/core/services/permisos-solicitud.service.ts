import { Injectable, inject } from "@angular/core";
import { ROLES_SOLICITANTE } from "../constants/roles.const";
import { RolService } from "./rol.service";
import {
  ACCIONES_SOLICITUD,
  AccionSolicitud,
  AccionSolicitudMeta,
  ESTADOS_SOLICITUD,
  EstadoSolicitud,
  MATRIZ_ACCIONES_POR_ESTADO,
} from "../constants/estados-solicitud.const";

/** Contrato mínimo que la capa de datos debe garantizar para evaluar permisos. */
export interface SolicitudPermisable {
  readonly estado: EstadoSolicitud;
}

@Injectable({ providedIn: "root" })
export class PermisosSolicitudService {
  private readonly rol = inject(RolService);

  /** Acciones que el menú de la fila debe mostrar para esa solicitud. */
  accionesPermitidas(
    solicitud: SolicitudPermisable,
  ): readonly AccionSolicitud[] {
    const acciones = MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado] ?? [];
    if (!this.rol.estaCargado()) {
      return acciones.filter((accion) => accion !== "cancelar");
    }

    const esSolicitante = ROLES_SOLICITANTE.some((rol) =>
      this.rol.tieneRol(rol),
    );
    return esSolicitante
      ? acciones
      : acciones.filter((accion) => accion !== "cancelar");
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
}
