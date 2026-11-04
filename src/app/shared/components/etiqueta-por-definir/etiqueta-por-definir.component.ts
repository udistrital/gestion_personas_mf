import { Component, Input } from "@angular/core";

/**
 * Etiqueta de "Por definir" para reglas que el diseño aún no cierra.
 *
 * Se usa inline junto a un título o una acción y siempre acompaña al texto
 * visible: el color no es el único indicador, y el detalle opcional se anuncia
 * a los lectores de pantalla (no solo en el `title`).
 */
@Component({
  selector: "etiqueta-por-definir",
  templateUrl: "./etiqueta-por-definir.component.html",
  styleUrls: ["./etiqueta-por-definir.component.scss"],
  standalone: false,
})
export class EtiquetaPorDefinirComponent {
  /** Texto visible de la etiqueta. */
  @Input() texto = "Por definir";

  /** Motivo o regla pendiente; se anuncia como texto adicional. */
  @Input() detalle = "";

  /** Icono Material a la izquierda. */
  @Input() icono = "help_outline";
}
