import {
  Component,
  Injector,
  Input,
  OnInit,
  forwardRef,
  inject,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from "@angular/forms";
import { ErrorStateMatcher } from "@angular/material/core";
import { MatDatepickerInputEvent } from "@angular/material/datepicker";

/**
 * Campo de fecha con `mat-datepicker` que conserva el valor como texto ISO.
 *
 * Los formularios de registro (y el mapper hacia el MID) trabajan con fechas
 * `YYYY-MM-DD`; el datepicker de Material trabaja con `Date`. Este componente
 * hace la conversión en ambos sentidos para que el `FormControl` no cambie de
 * tipo. Incluye la etiqueta externa para mantener el patrón visual de los
 * formularios de registro.
 */
@Component({
  selector: "campo-fecha",
  templateUrl: "./campo-fecha.component.html",
  styleUrls: ["./campo-fecha.component.scss"],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoFechaComponent),
      multi: true,
    },
  ],
})
export class CampoFechaComponent implements ControlValueAccessor, OnInit {
  /** Etiqueta visible sobre el campo. */
  @Input() etiqueta = "";

  /** Muestra el asterisco de obligatorio. */
  @Input() requerido = false;

  /** Texto de ayuda bajo el campo. */
  @Input() ayuda = "";

  /** Texto de la pista cuando está vacío. */
  @Input() placeholder = "dd/mm/aaaa";

  /** Fecha mínima seleccionable. */
  @Input() min: Date | null = null;

  /** Fecha máxima seleccionable. */
  @Input() max: Date | null = null;

  /** Mensaje cuando el campo es obligatorio y está vacío. */
  @Input() mensajeRequerido = "Este campo es obligatorio.";

  private static secuencia = 0;
  protected readonly id = `campo-fecha-${CampoFechaComponent.secuencia++}`;

  private readonly injector = inject(Injector);

  /**
   * Se resuelve en `ngOnInit`, no en el constructor.
   *
   * Inyectarlo antes provoca NG0200: el `FormControlName` del mismo elemento
   * necesita el `NG_VALUE_ACCESSOR` de este componente y el componente
   * necesitaría el `NgControl` que aún se está construyendo.
   */
  private ngControl: NgControl | null = null;

  /** Fecha mostrada por el datepicker. */
  protected fecha: Date | null = null;

  protected deshabilitado = false;

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  /**
   * Refleja el estado de error del control externo en el `mat-form-field`.
   *
   * El input del datepicker no es el control del formulario (el valor lo
   * gestiona este CVA), así que Material necesita este matcher para pintar
   * el borde y mostrar el `mat-error`.
   */
  readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => {
      const control = this.ngControl?.control;
      return !!control && control.invalid && control.touched;
    },
  };

  ngOnInit(): void {
    this.ngControl = this.injector.get(NgControl, null, {
      self: true,
      optional: true,
    });
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  // ── ControlValueAccessor ────────────────────────────────────────────────

  writeValue(valor: string | null): void {
    this.fecha = this.desdeIso(valor);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
  }

  // ── Interacción ─────────────────────────────────────────────────────────

  alCambiar(evento: MatDatepickerInputEvent<Date>): void {
    this.fecha = evento.value ?? null;
    this.onChange(this.fecha ? this.aIso(this.fecha) : "");
  }

  alSalir(): void {
    this.onTouched();
  }

  get invalido(): boolean {
    const control = this.ngControl?.control;
    return !!control && control.touched && control.invalid;
  }

  get errorRequerido(): boolean {
    const control = this.ngControl?.control;
    return this.invalido && !!control?.hasError("required");
  }

  get errorFormato(): boolean {
    const control = this.ngControl?.control;
    return this.invalido && !!control?.hasError("matDatepickerParse");
  }

  // ── Conversión ISO ↔ Date ───────────────────────────────────────────────

  private desdeIso(valor: string | null): Date | null {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return null;
    }
    const [anio, mes, dia] = valor.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private aIso(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  }
}
