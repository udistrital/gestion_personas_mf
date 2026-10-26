import { Component, EventEmitter, Input, Output } from "@angular/core";

export interface PasoStepperVisual {
  numero: number;
  icono?: string;
  nombre: string;
  /** Texto secundario bajo el nombre (p. ej. "Cruce SICAPITAL"). */
  subtitulo?: string;
}

@Component({
  selector: "stepper-visual",
  templateUrl: "./stepper-visual.component.html",
  styleUrls: ["./stepper-visual.component.scss"],
  standalone: false,
})
export class StepperVisualComponent {

  /**
   * Etiqueta para el elemento de navegación del stepper visual, utilizada para accesibilidad.
   * @default "Progreso"
   * @example "Progreso del procedimiento"
   */
  @Input() label: string = "Progreso";

  /**
   * Número del paso actual en el stepper visual. Este valor determina qué paso se encuentra activo.
   *
   */
  @Input() pasoActual!: number;
  @Output() pasoActualChange = new EventEmitter<number>();

  /**
   * Lista de pasos que conforman el stepper visual. Cada paso debe incluir un número, un nombre y un icono.
   * @example
   * ```
   * [{ numero: 1, nombre: "Datos personales", icono: "person" }, { numero: 2, nombre: "Información financiera", icono: "account_balance" }]
   * ```
   */
  @Input() pasos!: PasoStepperVisual[];

  /**
   * Número de columnas del stepper en escritorio. El valor por defecto (4)
   * conserva el aspecto de los formularios de registro; los asistentes de
   * 7 pasos usan 7 (por debajo de 1024px vuelve a 4 y en móvil a 1).
   * @default 4
   */
  @Input() columnas: number = 4;

  /**
   * Último paso que el usuario alcanzó. Si se define, solo se permite navegar
   * hasta ese número ("solo volver a pasos ya alcanzados"); los demás pasos
   * quedan con `aria-disabled`. Si no se define se conserva el comportamiento
   * libre de siempre (los hosts siguen filtrando el clic como quieran).
   */
  @Input() pasoAlcanzado?: number;

  /**
   * Número del paso que debe resaltarse en estado de error
   * (icono de alerta y color `--agora-error`).
   */
  @Input() pasoConError: number | null = null;

  /** true si el paso puede abrirse según `pasoAlcanzado`. */
  esNavegable(numero: number): boolean {
    return this.pasoAlcanzado === undefined || numero <= this.pasoAlcanzado;
  }

  /** true si ese paso está marcado con error. */
  hayError(numero: number): boolean {
    return this.pasoConError === numero;
  }

  /**
   * Selecciona un paso del stepper visual.
   * @param numero Número del paso a seleccionar. Este valor debe coincidir con el número de uno de los pasos definidos en la propiedad `pasos`.
   */
  seleccionarPaso(numero: number): void {
    if (!this.esNavegable(numero)) {
      return;
    }
    this.pasoActualChange.emit(numero);
  }

}
