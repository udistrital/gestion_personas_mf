import { Component, computed, inject } from "@angular/core";
import {
  FechaCaracteristica,
  ResponsableDetalle,
} from "../../../../../models/detalle-solicitud.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/**
 * Pestaña "General" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura el responsable, las características y el plan de
 * acción relacionado. La solicitud la recibe del armazón a través de
 * `SolicitudDetalleStore`, así que no repite la petición ni conoce estados.
 *
 * Los textos capturados con el editor enriquecido se pintan con
 * `htmlSeguro` (sanitizado); nunca se confía en su HTML con
 * `bypassSecurityTrustHtml`.
 *
 * Los campos "Por definir" del mockup se omiten por completo.
 */
@Component({
  selector: "app-pestana-general",
  templateUrl: "./pestana-general.component.html",
  styleUrls: ["./pestana-general.component.scss"],
  standalone: false,
})
export class PestanaGeneralComponent {
  private readonly store = inject(SolicitudDetalleStore);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Responsable de la solicitud (o `null` mientras no hay datos). */
  readonly responsable = computed<ResponsableDetalle | null>(
    () => this.solicitud()?.general.responsable ?? null,
  );

  /** Características de la solicitud. */
  readonly caracteristicas = computed(
    () => this.solicitud()?.general.caracteristicas ?? null,
  );

  /** Plan de acción relacionado. */
  readonly planAccion = computed(
    () => this.solicitud()?.general.planAccion ?? null,
  );

  /** Nota combinada de una fecha (\"08:00 COT …\"). */
  notaDe(fecha: FechaCaracteristica | null): string {
    return fecha?.nota ?? "";
  }
}
