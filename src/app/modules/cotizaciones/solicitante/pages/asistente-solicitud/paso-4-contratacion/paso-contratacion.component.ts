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
import { map } from "rxjs";
import {
  CONDICION_CONTRAENTREGA_SUGERIDA,
  FORMA_PAGO_CONTRAENTREGA,
  MIN_CARACTERES_CONDICION,
  NORMA_MEDIO_PAGO,
  PORCENTAJE_MINIMO,
  PORCENTAJE_PAGO_UNICO,
  PORCENTAJE_TOTAL,
  OpcionContratacion,
  ParametroPago,
  calcularResumenPagos,
  esPagoUnico,
  formatoPorcentajePago,
  reglaDesembolso,
} from "../../../../models/contratacion.model";
import { AlertService } from "src/app/shared/services/alert.service";
import { RegistroPersonaJuridicaCatalogosService } from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-catalogos.service";

function normalizarCatalogo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Validador del paso 4: exige al menos un parámetro de pago y que la suma de
 * los porcentajes sea exactamente el 100 %.
 *
 * Es un validador de grupo porque depende de la lista completa de parámetros.
 *
 * La contraentrega tiene su propia regla: admite **un solo** parámetro y su
 * porcentaje es fijo al 100 %, así que no basta con que la suma dé 100 %.
 */
export function sumaPorcentajes(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const lista = grupo.get("parametros")?.value;
    const formaPago = String(grupo.get("formaPago")?.value ?? "");

    if (!Array.isArray(lista) || lista.length === 0) {
      return { sinParametros: true };
    }

    if (esPagoUnico(formaPago)) {
      const porcentaje = Number(lista[0]?.porcentaje ?? 0);
      return lista.length === 1 && porcentaje === PORCENTAJE_PAGO_UNICO
        ? null
        : { pagoUnicoIncompleto: { cantidad: lista.length, porcentaje } };
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
  tiposContrato: readonly OpcionContratacion[] = [];
  mediosPago: readonly OpcionContratacion[] = [];
  formasPago: readonly OpcionContratacion[] = [];
  readonly normaMedioPago = NORMA_MEDIO_PAGO;
  readonly minCondicion = MIN_CARACTERES_CONDICION;
  readonly formatoPorcentaje = formatoPorcentajePago;

  /** Condición de pago sugerida para la contraentrega (placeholder). */
  readonly condicionSugerida = CONDICION_CONTRAENTREGA_SUGERIDA;

  /** Subgrupo `contratacion` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alerta = inject(AlertService);
  private readonly catalogos = inject(RegistroPersonaJuridicaCatalogosService);

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
    this.catalogos
      .obtenerCatalogoParametro("TIP_FOR_PAG_COT")
      .pipe(
        map((opciones) => ({
          tiposContrato: opciones.map((opcion) => ({
            valor: opcion.codigo ?? String(opcion.id),
            etiqueta: opcion.nombre,
          })),
          formasPago: opciones.map((opcion) => ({
            valor: this.esOpcionPagoUnico(opcion)
              ? FORMA_PAGO_CONTRAENTREGA
              : "pagos_parciales",
            etiqueta: opcion.nombre,
          })),
        })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ tiposContrato, formasPago }) => {
          this.tiposContrato = tiposContrato;
          this.formasPago = formasPago;
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar el catálogo de formas de pago y contratos.",
          );
        },
      });

    this.catalogos
      .obtenerCatalogoParametro("MPA")
      .pipe(
        map((opciones) =>
          opciones.map((opcion) => ({
            valor: opcion.codigo ?? String(opcion.id),
            etiqueta: opcion.nombre,
          })),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (opciones) => {
          this.mediosPago = opciones;
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar el catálogo de medios de pago.",
          );
        },
      });

    // Restaura los parámetros que el borrador dejó en el formulario.
    const guardados = this.controlOpcional("parametros")?.value;
    if (Array.isArray(guardados) && guardados.length > 0) {
      this.parametros.set(guardados as readonly ParametroPago[]);
    }

    for (const nombre of ["tipoContrato", "medioPago"]) {
      this.controlOpcional(nombre)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.marcas.update((cantidad) => cantidad + 1));
    }

    // La forma de pago manda sobre la captura: al cambiarla se revisa que los
    // parámetros ya registrados sigan siendo válidos.
    this.controlOpcional("formaPago")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor: string) => {
        this.marcas.update((cantidad) => cantidad + 1);
        this.reconciliarParametros(String(valor ?? ""));
      });

    // Normaliza el borrador restaurado: un borrador anterior a esta regla
    // podría venir en contraentrega con más de un parámetro.
    this.reconciliarParametros(this.formaPagoActual());
  }

  // ── Estado derivado ──────────────────────────────────────────────────────

  /**
   * true cuando la forma de pago exige un único desembolso al 100 %.
   *
   * En contraentrega el solicitante solo registra la condición del pago: el
   * porcentaje viene fijo y no se admiten parámetros adicionales.
   */
  readonly esContraentrega = computed(() => {
    this.marcas();
    return esPagoUnico(this.formaPagoActual());
  });

  /** Texto de ayuda del campo de condición de pago, según la forma de pago. */
  readonly placeholderCondicion = computed(() => {
    if (this.completo()) {
      return "Cupo de porcentaje completo (100% alcanzado)";
    }
    return this.esContraentrega()
      ? this.condicionSugerida
      : "Describa el hito o entregable que condiciona el desembolso…";
  });

  /** Resumen porcentual de los parámetros agregados. */
  readonly resumen = computed(() => calcularResumenPagos(this.parametros()));

  /** true cuando la distribución porcentual alcanzó el 100 %. */
  readonly completo = computed(() => this.resumen().completo);

  /** Etiquetas legibles de los selects (cabeceras de tarjeta y avisos). */
  readonly seleccion = computed(() => {
    this.marcas();
    const medioPago = String(this.controlOpcional("medioPago")?.value ?? "");
    const formaPago = String(this.controlOpcional("formaPago")?.value ?? "");
    return {
      medioPago:
        this.mediosPago.find((opcion) => opcion.valor === medioPago)?.etiqueta ??
        medioPago,
      formaPago:
        this.formasPago.find((opcion) => opcion.valor === formaPago)?.etiqueta ??
        formaPago,
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
    // La contraentrega admite un único parámetro de pago.
    if (this.esContraentrega() && this.parametros().length > 0) {
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
    const pagoUnico = this.esContraentrega();
    // En contraentrega el porcentaje no es un dato que capture el solicitante:
    // el desembolso es único y siempre es del 100 %.
    const porcentaje = pagoUnico
      ? PORCENTAJE_PAGO_UNICO
      : Number(valores.porcentaje);
    const controlPorcentaje = form.get("porcentaje");

    if (!pagoUnico && porcentaje > this.maximoPorcentaje()) {
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
    form.reset({
      condicion: "",
      porcentaje: pagoUnico ? PORCENTAJE_PAGO_UNICO : null,
    });
  }

  /** Quita un parámetro de la tabla. */
  eliminarParametro(id: string): void {
    this.parametros.update((lista) =>
      lista.filter((parametro) => parametro.id !== id),
    );
    this.sincronizarLista();
    // En contraentrega el campo de captura vuelve a quedar fijo en 100 %.
    if (this.esContraentrega()) {
      this.fijarPorcentajeUnico();
    }
  }

  /** true si el campo ya recibió interacción y es inválido. */
  mostrarError(nombre: string, form: FormGroup): boolean {
    const control = form.get(nombre);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  /**
   * Ajusta los parámetros registrados a la forma de pago elegida.
   *
   * La contraentrega admite un único parámetro al 100 %: si lo que hay
   * capturado no cumple esa forma, se limpia la lista y se avisa al
   * solicitante para que diligencie solo la condición del pago final.
   */
  private reconciliarParametros(formaPago: string): void {
    if (!esPagoUnico(formaPago)) {
      // Al salir de la contraentrega el porcentaje vuelve a ser capturable.
      if (!this.completo()) {
        this.parametroForm.patchValue({ porcentaje: null });
      }
      return;
    }

    const lista = this.parametros();
    const cumple =
      lista.length === 1 &&
      Number(lista[0]?.porcentaje ?? 0) === PORCENTAJE_PAGO_UNICO;

    if (!cumple && lista.length > 0) {
      this.parametros.set([]);
      this.sincronizarLista();
      this.alerta.showAlert(
        "Forma de pago actualizada",
        "La contraentrega se paga en un solo desembolso del 100 %, por lo que se eliminaron los parámetros de pago que no aplican a esta forma de pago. Registre únicamente la condición del pago final.",
      );
    }

    this.fijarPorcentajeUnico();
  }

  /** Deja el campo de porcentaje fijo en 100 % (contraentrega). */
  private fijarPorcentajeUnico(): void {
    this.parametroForm.patchValue({ porcentaje: PORCENTAJE_PAGO_UNICO });
  }

  /** Forma de pago seleccionada en el formulario. */
  private formaPagoActual(): string {
    return String(this.controlOpcional("formaPago")?.value ?? "");
  }

  private esOpcionPagoUnico(opcion: { codigo?: string; nombre: string }): boolean {
    const clave = normalizarCatalogo(`${opcion.codigo ?? ""} ${opcion.nombre}`);
    return clave.includes("contraentrega") || clave.includes("pagounico");
  }

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
