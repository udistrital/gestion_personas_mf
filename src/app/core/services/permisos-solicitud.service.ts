import { Injectable } from "@angular/core";
import {
  AccionSolicitud,
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
  /** Acciones que el menú de la fila debe mostrar para esa solicitud. */
  accionesPermitidas(solicitud: SolicitudPermisable): readonly AccionSolicitud[] {
    return MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado] ?? [];
  }

  /** true si la acción está permitida en el estado de la solicitud. */
  puede(accion: AccionSolicitud, solicitud: SolicitudPermisable): boolean {
    return this.accionesPermitidas(solicitud).includes(accion);
  }

  /** Texto visible de un estado (para `aria-label` y textos de apoyo). */
  etiquetaEstado(estado: EstadoSolicitud): string {
    return ESTADOS_SOLICITUD[estado]?.etiqueta ?? estado;
  }
}
