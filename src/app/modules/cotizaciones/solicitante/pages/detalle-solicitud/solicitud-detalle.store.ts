import { Injectable, signal } from "@angular/core";
import { SolicitudDetalle } from "../../../models/solicitud.model";

/**
 * Estado del expediente abierto en el detalle (S-03, armazón).
 *
 * El armazón lo llena con lo que resolvió `solicitudResolver` y lo provee en su
 * propio `providers`, de modo que cada pestaña hija lo inyecta y lee la misma
 * solicitud sin repetir la petición. Al vivir en el inyector del componente
 * padre, el estado se destruye al salir del detalle.
 */
@Injectable()
export class SolicitudDetalleStore {
  private readonly solicitudInterna = signal<SolicitudDetalle | null>(null);

  /** Solicitud resuelta; `null` mientras no hay datos. */
  readonly solicitud = this.solicitudInterna.asReadonly();

  /** Publica la solicitud resuelta para las pestañas hijas. */
  establecer(solicitud: SolicitudDetalle | null): void {
    this.solicitudInterna.set(solicitud);
  }
}
