import { Component, Input } from "@angular/core";
import type {
  ModoEdicionSolicitud,
  ResumenDiferencias,
} from "../../../../../../models/edicion-solicitud.model";

/**
 * Resumen de cambios de la edición (S-04).
 *
 * Componente presentacional: recibe el resultado de
 * `DiferenciasSolicitudService` y pinta una tarjeta por paso con el valor
 * anterior (tachado) y el nuevo. No conoce campos ni catálogos, de modo que el
 * cálculo vive en un único servicio y esta vista se reutiliza en cualquier
 * punto del flujo de edición.
 */
@Component({
  selector: "resumen-diferencias",
  templateUrl: "./resumen-diferencias.component.html",
  styleUrls: ["./resumen-diferencias.component.scss"],
  standalone: false,
})
export class ResumenDiferenciasComponent {
  /** Cambios calculados contra la última versión guardada. */
  @Input({ required: true }) diferencias!: ResumenDiferencias;

  /** Modo de edición; cambia el texto de apoyo. */
  @Input() modo: ModoEdicionSolicitud = "completa";

  /** Etiqueta del contador total ("3 campos modificados"). */
  get totalTexto(): string {
    const total = this.diferencias.total;
    return `${total} ${total === 1 ? "campo modificado" : "campos modificados"}`;
  }

  /** Texto de apoyo según el alcance de la edición. */
  get descripcion(): string {
    return this.modo === "restringida"
      ? "Solo se modifican los bienes y servicios (paso 3) y la fecha de cierre (paso 2). El resto del expediente viaja sin cambios y la propuesta queda pendiente de aprobación."
      : "Estos son los ajustes que quedarán en la nueva versión del borrador. La solicitud aún no se envía a proveedores.";
  }
}
