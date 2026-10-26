import { Injectable } from "@angular/core";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";
import type { DatosEdicionSolicitud } from "../models/edicion-solicitud.model";

/** Prefijo de claves de borradores de edición (una clave por solicitud). */
export const PREFIJO_BORRADOR_EDICION =
  "agora.gestion-personas.borrador.solicitud.";

/** Sufijo que distingue el borrador de edición del borrador de creación. */
export const SUFIJO_BORRADOR_EDICION = ".edicion";

/**
 * Borrador del asistente de edición.
 *
 * Guarda la fotografía editable (los mismos grupos del formulario) y el paso
 * alcanzado. No guarda archivos: `DatosEdicionSolicitud` solo conserva los
 * metadatos de los anexos, nunca el `File` del navegador.
 */
export interface BorradorEdicionSolicitud extends BorradorBase {
  version: number;
  currentStep: number;
  savedAt: string;
  /** Fotografía editable que se restaura con `patchValue`. */
  datos: DatosEdicionSolicitud;
}

/**
 * Persistencia del borrador de edición por solicitud.
 *
 * La clave incluye el identificador de la solicitud, así que dos ediciones
 * simultáneas (dos pestañas, dos solicitudes) nunca se pisan. Es independiente
 * de `BORRADOR_SOLICITUD_KEY`, que sigue siendo exclusivo de la creación.
 */
@Injectable({ providedIn: "root" })
export class EdicionSolicitudService {
  /** Clave de `localStorage` del borrador de una solicitud concreta. */
  clave(solicitudId: string): string {
    return `${PREFIJO_BORRADOR_EDICION}${solicitudId}${SUFIJO_BORRADOR_EDICION}`;
  }

  /** Borrador guardado de la solicitud, o `null` si no hay uno válido. */
  cargar(solicitudId: string): BorradorEdicionSolicitud | null {
    return this.almacen(solicitudId).cargar();
  }

  /** Guarda la fotografía actual; devuelve false si el navegador falla. */
  guardar(
    solicitudId: string,
    datos: DatosEdicionSolicitud,
    currentStep: number,
  ): boolean {
    return this.almacen(solicitudId).guardar({
      version: 1,
      currentStep,
      savedAt: new Date().toISOString(),
      datos,
    });
  }

  /** Elimina el borrador de la solicitud (al guardar o descartar). */
  eliminar(solicitudId: string): void {
    this.almacen(solicitudId).eliminar();
  }

  /** Instancia acotada a la clave de la solicitud. */
  private almacen(
    solicitudId: string,
  ): BorradorService<BorradorEdicionSolicitud> {
    return new BorradorService<BorradorEdicionSolicitud>(
      this.clave(solicitudId),
    );
  }
}
