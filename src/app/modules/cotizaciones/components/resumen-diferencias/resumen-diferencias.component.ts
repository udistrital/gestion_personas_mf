import { Component, Input } from "@angular/core";
import type {
  ModoEdicionSolicitud,
  ResumenDiferencias,
} from "../../models/edicion-solicitud.model";

/**
 * Resumen de cambios de S-04, S-08 y P-05.
 *
 * Componente presentacional: recibe el resultado de un servicio de diferencias
 * y pinta una tarjeta por paso con el valor anterior y el nuevo. No conoce
 * campos ni catálogos. P-05 lo reutiliza en variante tabla para el panel de la
 * adenda y en variante lista para el resumen frente a la respuesta anterior.
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

  /** Modo de edición; cambia el texto de apoyo de S-04. */
  @Input() modo: ModoEdicionSolicitud = "completa";

  /** Título visible; S-04 conserva «Resumen de cambios». */
  @Input() titulo = "Resumen de cambios";

  /** Descripción explícita; si está vacía se usa la de `modo`. */
  @Input() descripcionPersonalizada = "";

  /** `lista` (S-04/S-08) o `tabla` (panel de adenda de P-05). */
  @Input() variante: "lista" | "tabla" = "lista";

  /** Muestra «Paso N» delante del título del grupo. */
  @Input() mostrarPaso = true;

  /** Sustantivo del contador total («campo» en S-04, «cambio» en P-05). */
  @Input() sustantivo = "campo";

  /** Fecha común de la adenda, si la fuente la conoce. */
  @Input() publicadoEl = "";

  /** Motivo común de la adenda, si la fuente lo conoce. */
  @Input() motivo = "";

  /** Etiqueta del contador total ("3 campos modificados"). */
  get totalTexto(): string {
    const total = this.diferencias.total;
    return `${total} ${total === 1 ? `${this.sustantivo} modificado` : `${this.sustantivo}s modificados`}`;
  }

  /** Texto de apoyo según el alcance de la edición. */
  get descripcion(): string {
    if (this.descripcionPersonalizada) {
      return this.descripcionPersonalizada;
    }
    return this.modo === "restringida"
      ? "Solo se modifican los bienes y servicios (paso 3) y la fecha de cierre (paso 2). El resto del expediente viaja sin cambios y la propuesta queda pendiente de aprobación."
      : "Estos son los ajustes que quedarán en la nueva versión del borrador. La solicitud aún no se envía a proveedores.";
  }

  /** Fecha visible de un cambio: la propia o la común de la adenda. */
  fechaCambio(cambio: { readonly fecha?: string }): string {
    return cambio.fecha || this.publicadoEl || "—";
  }

  /** Motivo visible de un cambio: el propio o el común de la adenda. */
  motivoCambio(cambio: { readonly motivo?: string }): string {
    return cambio.motivo || this.motivo || "—";
  }
}
