import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PasoStepperVisual } from "../stepper-visual/stepper-visual.component";

/**
 * Envoltorio de `stepper-visual` para los asistentes de 7 pasos.
 *
 * Encapsula la única regla de navegación que todos los asistentes comparten
 * —**solo volver a pasos ya alcanzados**— para no repetirla en cada host
 * (antes vivía en `irAlPaso` de persona natural).
 */
@Component({
  selector: "asistente-pasos",
  templateUrl: "./asistente-pasos.component.html",
  styleUrls: ["./asistente-pasos.component.scss"],
  standalone: false,
})
export class AsistentePasosComponent {
  /** Pasos del asistente (número, nombre y subtítulo opcional). */
  @Input() pasos: PasoStepperVisual[] = [];

  /** Paso visible actualmente. */
  @Input() pasoActual = 1;

  /** Último paso alcanzado; a partir de ahí no se puede avanzar por clic. */
  @Input() pasoAlcanzado = 1;

  /** Paso que debe resaltarse en estado de error. */
  @Input() pasoConError: number | null = null;

  /** Columnas del stepper en escritorio (7 en los asistentes). */
  @Input() columnas = 7;

  /** Etiqueta de accesibilidad de la navegación. */
  @Input() label = "Progreso del trámite";

  @Output() pasoActualChange = new EventEmitter<number>();

  /** Navega a un paso respetando el límite de pasos alcanzados. */
  cambiarPaso(paso: number): void {
    if (paso < 1 || paso > this.pasos.length || paso > this.pasoAlcanzado) {
      return;
    }
    this.pasoActualChange.emit(paso);
  }
}
