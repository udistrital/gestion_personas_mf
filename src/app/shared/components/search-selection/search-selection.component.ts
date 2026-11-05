// Adapted from https://stackblitz.com/github/bithost-gmbh/ngx-mat-select-search-example?file=src%2Fapp%2Fapp.component.html

import {
  AfterViewInit,
  Component,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  forwardRef,
  inject,
} from "@angular/core";
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  NgControl,
} from "@angular/forms";
import { ErrorStateMatcher } from "@angular/material/core";
import { MatSelect } from "@angular/material/select";
import { ReplaySubject, Subject } from "rxjs";
import { take, takeUntil } from "rxjs/operators";

export interface Selectable {
  value: any;
  label: string;
}

/**
 * Matcher que refleja el estado del control externo en el `mat-form-field`.
 *
 * El componente implementa `ControlValueAccessor` y usa un control interno
 * para `mat-select`; los validadores viven en el control del formulario padre.
 * Sin este matcher, el borde de error no aparecería.
 */
class EstadoErrorExternoMatcher implements ErrorStateMatcher {
  constructor(private readonly host: SearchSelectionComponent) {}

  isErrorState(): boolean {
    const control = this.host.controlExterno;
    return !!control && control.invalid && control.touched;
  }
}

/**
 * Select con búsqueda para catálogos extensos.
 *
 * Implementa `ControlValueAccessor`, así que se usa con `formControlName`
 * dentro de un `FormGroup`. La etiqueta visible se pinta en el formulario
 * padre (patrón de los formularios de registro); aquí se recibe solo el
 * `ariaLabel`. El buscador se apoya en `ngx-mat-select-search`.
 */
@Component({
  selector: "app-search-selection",
  templateUrl: "./search-selection.component.html",
  styleUrls: ["./search-selection.component.scss"],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectionComponent),
      multi: true,
    },
  ],
})
export class SearchSelectionComponent
  implements ControlValueAccessor, OnInit, AfterViewInit, OnChanges, OnDestroy
{
  /** Texto de la etiqueta flotante; vacío para usar la etiqueta externa. */
  @Input() public label = "";

  /** Icono a la izquierda del select. */
  @Input() public icon = "";

  /** Pista visible cuando no hay selección. */
  @Input() public placeholder = "Seleccione una opción";

  /** Nombre accesible del select cuando no hay `label`. */
  @Input() public ariaLabel = "";

  /** Mensaje cuando el campo es obligatorio y está vacío. */
  @Input() public noSelectionErrorMessage = "Debe seleccionar una opción";

  /** Mensaje cuando el catálogo no tiene opciones. */
  @Input() public noOptionsErrorMessage = "No hay opciones disponibles";

  /** Lista de elementos para seleccionar (admite arreglos `readonly`). */
  @Input() public items: readonly any[] = [];

  /** Propiedad que se muestra como etiqueta. */
  @Input() public labelKey: string | null = null;

  /** Propiedad que se guarda como valor. */
  @Input() public valueKey: string | null = null;

  /** Lista convertida a `{ label, value }`. */
  public selectables: Selectable[] = [];

  /** Control interno que alimenta `mat-select`; el valor viaja al padre por CVA. */
  public readonly control = new FormControl<any>(null);

  /** Control del formulario padre, para leer validadores y estado tocado. */
  public get controlExterno(): FormControl | null {
    return (this.ngControl?.control as FormControl | null) ?? null;
  }

  /** Control del buscador dentro del panel. */
  public readonly formFilterControl = new FormControl<string | null>("");

  /** Opciones filtradas por el buscador. */
  public readonly filteredSelectables = new ReplaySubject<Selectable[]>(1);

  /** Matcher que propaga el estado de error del control externo. */
  public readonly errorStateMatcher = new EstadoErrorExternoMatcher(this);

  /** Selección múltiple (acepta el atributo sin binding). */
  private _multiple = false;

  @Input()
  public set multiple(value: boolean | string | undefined) {
    this._multiple = value === "" || value === true || value === "true";
  }

  public get multiple(): boolean {
    return this._multiple;
  }

  @ViewChild("matSelect", { static: true }) matSelect!: MatSelect;

  private readonly injector = inject(Injector);

  /**
   * Se resuelve en `ngOnInit` para evitar NG0200: el `FormControlName` del
   * mismo elemento necesita el value accessor de este componente.
   */
  private ngControl: NgControl | null = null;

  protected readonly _onDestroy = new Subject<void>();

  private onChange: (valor: any) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.ngControl = this.injector.get(NgControl, null, {
      self: true,
      optional: true,
    });
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    this.formFilterControl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => this.filterSelectables());

    this.control.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe((valor) => this.onChange(valor));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["multiple"] && this.multiple) {
      this.asegurarValorMultiple();
    }

    if (changes["items"] && this.items) {
      this.selectables = this.aSelectables(
        this.items,
        this.labelKey,
        this.valueKey,
      );
      // Si el usuario ya escribió una búsqueda, se conserva al cambiar la
      // lista (por ejemplo, al agregar o retirar una actividad CIIU).
      this.filterSelectables();
      this.setInitialValue();
    }
  }

  ngAfterViewInit(): void {
    this.asegurarValorMultiple();
    this.setInitialValue();
  }

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  // ── ControlValueAccessor ────────────────────────────────────────────────

  writeValue(valor: any): void {
    this.control.setValue(valor ?? (this.multiple ? [] : null), {
      emitEvent: false,
    });
  }

  registerOnChange(fn: (valor: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    if (deshabilitado) {
      this.control.disable({ emitEvent: false });
    } else {
      this.control.enable({ emitEvent: false });
    }
  }

  /** Marca el campo como tocado al cerrar el panel. */
  alCerrarPanel(abierto: boolean): void {
    if (!abierto) {
      this.onTouched();
    }
  }

  // ── Errores ─────────────────────────────────────────────────────────────

  get mostrarErrorSeleccion(): boolean {
    return (
      !!this.controlExterno?.hasError("required") &&
      !!this.controlExterno?.touched &&
      this.selectables.length > 0
    );
  }

  get mostrarErrorSinOpciones(): boolean {
    return (
      !!this.controlExterno?.hasError("required") &&
      !!this.controlExterno?.touched &&
      this.selectables.length === 0
    );
  }

  get ariaLabelSelect(): string {
    return this.ariaLabel || this.label || this.placeholder;
  }

  // ── Internos ────────────────────────────────────────────────────────────

  /** Convierte los elementos de entrada al formato del componente. */
  protected aSelectables(
    items: readonly any[],
    labelKey: string | null,
    valueKey: string | null,
  ): Selectable[] {
    return items.map((item) => ({
      label: labelKey ? item[labelKey] : String(item),
      value: valueKey ? item[valueKey] : item,
    }));
  }

  /** Fija la comparación por identidad para valores primitivos. */
  protected setInitialValue(): void {
    if (!this.matSelect) {
      return;
    }

    this.filteredSelectables
      .pipe(take(1), takeUntil(this._onDestroy))
      .subscribe(() => {
        this.matSelect.compareWith = (a: any, b: any) => !!a && !!b && a === b;
      });
  }

  /** Si es múltiple, el valor debe ser siempre un arreglo. */
  protected asegurarValorMultiple(): void {
    if (!this.multiple) {
      return;
    }

    const actual = this.control.value;
    if (actual == null) {
      this.control.setValue([], { emitEvent: false });
      return;
    }

    if (!Array.isArray(actual)) {
      this.control.setValue([actual], { emitEvent: false });
    }
  }

  /** Filtra las opciones según lo escrito en el buscador. */
  protected filterSelectables(): void {
    let busqueda = this.formFilterControl.value;
    if (!busqueda) {
      this.filteredSelectables.next(this.selectables.slice());
      return;
    }

    busqueda = busqueda.toLowerCase();
    this.filteredSelectables.next(
      this.selectables.filter((selectable) =>
        selectable.label.toLowerCase().includes(busqueda),
      ),
    );
  }
}
