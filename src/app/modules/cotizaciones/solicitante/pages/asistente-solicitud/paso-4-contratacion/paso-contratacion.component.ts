import {
  Component,
  DestroyRef,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import {
  FORMAS_PAGO,
  MEDIOS_PAGO,
  MIN_CARACTERES_CONDICION,
  NORMA_MEDIO_PAGO,
  PORCENTAJE_MINIMO,
  PORCENTAJE_TOTAL,
  ParametroPago,
  TIPOS_CONTRATO,
  calcularResumenPagos,
  etiquetaCorta,
  formatoPorcentajePago,
  reglaDesembolso,
} from "../../../../models/contratacion.model";

/**
 * Validador del paso 4: exige al menos un parámetro de pago y que la suma de
 * los porcentajes sea exactamente el 100 %.
 *
 * Es un validador de grupo porque depende de la lista completa de parámetros.
 */
export function sumaPorcentajes(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const lista = grupo.get("parametros")?.value;
    if (!Array.isArray(lista) || lista.length === 0) {
      return { sinParametros: true };
    }
    const total = lista.reduce(
      (acumulado: number, parametro: ParametroPago) =>
        acumulado + Number(parametro?.porcentaje ?? 0),
      0,
    );
    return total === PORCENTAJE_TOTAL ? null : { sumaPorcentajes: { total } };
  };
}

/**
 * Validador de longitud mínima sobre el texto plano de la condición.
 *
 * La condición de pago es texto plano, así que basta un trim (mismo criterio
 * que el validador equivalente del paso 3).
 */
function minCaracteresTexto(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = String(control.value ?? "").trim();
    if (!texto) {
      return { required: true };
    }
    return texto.length >= minimo ? null : { minCaracteres: { minimo } };
  };
}

/**
 * Paso 4 del asistente: "Tipo de contratación e información de pago".
 *
 * Replica las dos vistas del mockup aprobado sobre un mismo componente: el
 * estado incompleto (la suma de los porcentajes no alcanza el 100 %) y el
 * estado completo (la distribución porcentual quedó cerrada). Los selects, la
 * lista de parámetros y los cálculos viven en el subgrupo `contratacion` del
 * formulario raíz para que el borrador los conserve.
 */
@Component({
  selector: "paso-contratacion",
  templateUrl: "./paso-contratacion.component.html",
  styleUrls: ["./paso-contratacion.component.scss"],
  standalone: false,
})
export class PasoContratacionComponent implements OnInit {
  readonly tiposContrato = TIPOS_CONTRATO;
  readonly mediosPago = MEDIOS_PAGO;
  readonly formasPago = FORMAS_PAGO;
  readonly normaMedioPago = NORMA_MEDIO_PAGO;
  readonly minCondicion = MIN_CARACTERES_CONDICION;
  readonly formatoPorcentaje = formatoPorcentajePago;

  /** Subgrupo `contratacion` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  /** Parámetros de pago agregados (alimenta la tabla y el medidor). */
  readonly parametros = signal<readonly ParametroPago[]>([]);

  /** Subformulario del parámetro (creado una sola vez). */
  readonly parametroForm: FormGroup;

  /** Dispara el recálculo cuando cambian los selects del contrato. */
  private readonly marcas = signal(0);

  constructor() {
    this.parametroForm = this.fb.group({
      condicion: [
        "",
        [Validators.required, minCaracteresTexto(MIN_CARACTERES_CONDICION)],
      ],
      porcentaje: [
        null,
        [Validators.required, Validators.min(PORCENTAJE_MINIMO)],
      ],
    });
  }

  ngOnInit(): void {
    // Restaura los parámetros que el borrador dejó en el formulario.
    const guardados = this.controlOpcional("parametros")?.value;
    if (Array.isArray(guardados) && guardados.length > 0) {
      this.parametros.set(guardados as readonly ParametroPago[]);
    }

    for (const nombre of ["tipoContrato", "medioPago", "formaPago"]) {
      this.controlOpcional(nombre)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.marcas.update((cantidad) => cantidad + 1));
    }
  }

  // ── Estado derivado ──────────────────────────────────────────────────────

  /** Resumen porcentual de los parámetros agregados. */
  readonly resumen = computed(() => calcularResumenPagos(this.parametros()));

  /** true cuando la distribución porcentual alcanzó el 100 %. */
  readonly completo = computed(() => this.resumen().completo);

  /** Etiquetas legibles de los selects (cabeceras de tarjeta y avisos). */
  readonly seleccion = computed(() => {
    this.marcas();
    return {
      medioPago: etiquetaCorta(
        MEDIOS_PAGO,
        String(this.controlOpcional("medioPago")?.value ?? ""),
      ),
      formaPago: etiquetaCorta(
        FORMAS_PAGO,
        String(this.controlOpcional("formaPago")?.value ?? ""),
      ),
    };
  });

  /** Texto de la regla de desembolso según la forma de pago elegida. */
  readonly regla = computed(() => {
    this.marcas();
    return reglaDesembolso(
      String(this.controlOpcional("formaPago")?.value ?? ""),
    );
  });

  /** Porcentaje máximo que admite el campo de captura. */
  readonly maximoPorcentaje = computed(() =>
    Math.max(0, PORCENTAJE_TOTAL - this.resumen().total),
  );

  // ── Parámetros de pago ───────────────────────────────────────────────────

  /** Agrega el parámetro diligenciado a la tabla consolidada. */
  agregarParametro(form: FormGroup): void {
    if (this.completo()) {
      return;
    }
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const valores = form.getRawValue() as {
      condicion: string;
      porcentaje: number;
    };
    const porcentaje = Number(valores.porcentaje);
    const controlPorcentaje = form.get("porcentaje");

    if (porcentaje > this.maximoPorcentaje()) {
      controlPorcentaje?.setErrors({ maximo: { maximo: this.maximoPorcentaje() } });
      controlPorcentaje?.markAsTouched();
      return;
    }

    this.parametros.update((lista) => [
      ...lista,
      {
        id: this.nuevoId(),
        condicion: valores.condicion.trim(),
        porcentaje,
      },
    ]);
    this.sincronizarLista();
    form.reset({ condicion: "", porcentaje: null });
  }

  /** Quita un parámetro de la tabla. */
  eliminarParametro(id: string): void {
    this.parametros.update((lista) =>
      lista.filter((parametro) => parametro.id !== id),
    );
    this.sincronizarLista();
  }

  /** true si el campo ya recibió interacción y es inválido. */
  mostrarError(nombre: string, form: FormGroup): boolean {
    const control = form.get(nombre);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  /**
   * Escribe la lista de parámetros en el control `parametros` del formulario.
   *
   * Se guarda como un arreglo plano (no `FormArray`) para que el borrador
   * pueda restaurarlo con un simple `patchValue`.
   */
  private sincronizarLista(): void {
    this.controlOpcional("parametros")?.setValue([...this.parametros()]);
  }

  private nuevoId(): string {
    const siguiente = this.parametros().length + 1;
    return `${siguiente}-${Date.now()}`;
  }

  private controlOpcional(nombre: string): AbstractControl | null {
    return this.form.get(nombre);
  }
}
