import { Component, Input } from "@angular/core";
import { ItemVerificacion } from "../../../../../../models/revision.model";

/**
 * Columna derecha del paso 7: la lista de verificación institucional.
 *
 * Componente presentacional que resume los criterios de completitud del
 * expediente antes de la radicación, más el aviso "Todo listo para procesar" y
 * la nota del Estatuto de Contratación UD.
 */
@Component({
  selector: "lista-verificacion",
  templateUrl: "./lista-verificacion.component.html",
  styleUrls: ["./lista-verificacion.component.scss"],
  standalone: false,
})
export class ListaVerificacionComponent {
  /** Criterios de completitud evaluados sobre el expediente. */
  @Input() items: readonly ItemVerificacion[] = [];

  /** true cuando todos los criterios se cumplen (habilita el procesamiento). */
  @Input() completo = false;
}
