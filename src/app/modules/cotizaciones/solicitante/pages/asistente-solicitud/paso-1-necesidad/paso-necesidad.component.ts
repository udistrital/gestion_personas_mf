import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, FormGroup } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { EMPTY, Subject, catchError, of, switchMap } from "rxjs";
import {
  ErrorCruceSicapital,
  NecesidadOpcion,
  ResultadoCruce,
  AcuerdoMarco,
  formatoCop,
} from "../../../../models/necesidad.model";
import {
  SicapitalService,
  VIGENCIAS_NECESIDAD,
} from "../../../../services/sicapital.service";
import {
  UNIDADES_EJECUTORAS,
  etiquetaUnidadEjecutora,
} from "../../../../models/solicitud.model";
import { AlertService } from "src/app/shared/services/alert.service";
import { DialogoAcuerdoComponent } from "./components/dialogo-acuerdo/dialogo-acuerdo.component";

/** Estados visibles del paso 1 (cruz de tarjetas y banner). */
export type EstadoCruce =
  | "inicial"
  | "cargando"
  | "cargado"
  | "error";

/**
 * Paso 1 del asistente: "Necesidad y presupuesto".
 *
 * El solicitante define tres criterios (unidad ejecutora, vigencia y número
 * de necesidad); al elegir la necesidad se ejecuta el cruce con SICAPITAL y
 * el resultado alimenta las tarjetas 2 y 3 en modo solo lectura. Si el cruce
 * falla, las tarjetas se bloquean y el avance queda inhabilitado.
 */
@Component({
  selector: "paso-necesidad",
  templateUrl: "./paso-necesidad.component.html",
  styleUrls: ["./paso-necesidad.component.scss"],
  standalone: false,
})
export class PasoNecesidadComponent implements OnInit {
  readonly formatoCop = formatoCop;
  readonly unidades = UNIDADES_EJECUTORAS;
  readonly vigencias = VIGENCIAS_NECESIDAD;

  /** Subgrupo `necesidad` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  /** Notifica al shell el estado del cruce (para habilitar el avance). */
  @Output() cambioEstado = new EventEmitter<EstadoCruce>();

  /** Notifica si el acuerdo marco ya fue aceptado (o si no hace falta). */
  @Output() cambioAcuerdo = new EventEmitter<boolean>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly sicapital = inject(SicapitalService);
  private readonly dialog = inject(MatDialog);
  private readonly alerta = inject(AlertService);

  readonly vista = signal<EstadoCruce>("inicial");
  readonly resultado = signal<ResultadoCruce | null>(null);
  readonly fallo = signal<ErrorCruceSicapital | null>(null);
  readonly opciones = signal<readonly NecesidadOpcion[]>([]);
  readonly cargandoOpciones = signal(false);
  readonly dialogoAbierto = signal(false);
  /** Intentos de cruce fallidos; se usa para reforzar el mensaje de error. */
  readonly intentos = signal(0);

  private readonly acuerdoAceptado = signal(false);
  private readonly disparoCruce$ = new Subject<void>();
  private readonly disparoOpciones$ = new Subject<void>();

  /** Textos del banner según el estado del paso. */
  readonly banner = computed(() => {
    switch (this.vista()) {
      case "error":
        return {
          icono: "error_outline",
          etiquetas: [] as readonly string[],
          descripcion: this.fallo()?.message ?? "",
        };
      case "cargando":
        return {
          icono: "verified_user",
          etiquetas: [] as readonly string[],
          descripcion:
            "Consultando la disponibilidad presupuestal y el resumen de la solicitud en SICAPITAL…",
        };
      case "cargado":
        return {
          icono: "verified_user",
          etiquetas: [] as readonly string[],
          descripcion:
            "Seleccione la necesidad aprobada para asociar el presupuesto oficial a su solicitud de cotización en el sistema universitario.",
        };
      default:
        return {
          icono: "cached",
          etiquetas: ["Cruce con SICAPITAL"] as readonly string[],
          descripcion:
            "Vincule el número de necesidad aprobado para consolidar la apropiación presupuestal del proceso.",
        };
    }
  });

  /**
   * true cuando hay un acuerdo marco por aceptar y el diálogo se cerró sin
   * confirmarlo: muestra el acceso para reabrirlo en la tarjeta 2.
   */
  readonly acuerdoPendiente = computed(
    () =>
      !!this.resultado()?.acuerdoMarco &&
      !this.acuerdoAceptado() &&
      !this.dialogoAbierto(),
  );

  /** Resumen corto del fallo para la línea técnica del banner. */
  readonly resumenFallo = computed(() => {
    const f = this.fallo();
    if (!f) {
      return "";
    }
    if (f.estado === 504) {
      return "Fallo HTTP 504 Gateway Timeout";
    }
    if (f.estado === 404) {
      return "Fallo HTTP 404 Not Found";
    }
    if (f.estado > 0) {
      return `Fallo HTTP ${f.estado}`;
    }
    return "Fallo de red (sin código HTTP)";
  });

  constructor() {
    this.disparoCruce$
      .pipe(
        takeUntilDestroyed(),
        switchMap(() => {
          this.vista.set("cargando");
          this.fallo.set(null);
          this.resultado.set(null);
          this.cambioEstado.emit("cargando");
          return this.sicapital.cruzar(this.criterios()).pipe(
            catchError((error: unknown) => {
              this.aplicarFallo(error);
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe((resultado) => this.aplicarExito(resultado));

    this.disparoOpciones$
      .pipe(
        takeUntilDestroyed(),
        switchMap(() => {
          const criterios = this.criterios();
          if (!criterios.unidadEjecutora || !criterios.vigencia) {
            return of([] as readonly NecesidadOpcion[]);
          }
          return this.sicapital.listarNecesidades(criterios).pipe(
            catchError(() => of([] as readonly NecesidadOpcion[])),
          );
        }),
      )
      .subscribe((opciones) => {
        this.opciones.set(opciones);
        this.cargandoOpciones.set(false);
      });
  }

  ngOnInit(): void {
    const unidad = this.control("unidadEjecutora");
    const vigencia = this.control("vigencia");
    const necesidad = this.control("numeroNecesidad");

    unidad.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.alCambiarCriterio());
    vigencia.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.alCambiarCriterio());
    necesidad.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor: string) =>
        valor ? this.consultar() : this.reiniciarResultado(),
      );

    // Restauración de borrador: los valores llegan sin pasar por el usuario.
    this.solicitarOpciones();
    if (necesidad.value) {
      this.consultar();
    }
  }

  /** Texto de apoyo de la tarjeta 1 según el estado del paso. */
  get descripcionTarjeta1(): string {
    switch (this.vista()) {
      case "error":
        return "Identifique el código presupuestal expedido por la dependencia solicitante.";
      case "cargando":
        return "Verificando la necesidad seleccionada en el sistema presupuestal…";
      case "cargado":
        return "Consulte y vincule la solicitud de necesidad aprobada en el sistema presupuestal.";
      default:
        return "Defina la unidad ejecutora y la vigencia para buscar la necesidad en SICAPITAL.";
    }
  }

  /** true cuando ya se eligió unidad ejecutora. */
  unidadListo(): boolean {
    return !!this.control("unidadEjecutora").value;
  }

  /** true cuando ya se eligió vigencia. */
  vigenciaListo(): boolean {
    return !!this.control("vigencia").value;
  }

  /** Etiqueta de la unidad ejecutora elegida (para el estado de solo lectura). */
  get unidadSeleccionada(): string {
    return etiquetaUnidadEjecutora(String(this.control("unidadEjecutora").value));
  }

  get valorVigencia(): string {
    return String(this.control("vigencia").value ?? "");
  }

  get valorNecesidad(): string {
    return String(this.control("numeroNecesidad").value ?? "");
  }

  /** El select de vigencia espera a que haya unidad ejecutora. */
  vigenciaDeshabilitada(): boolean {
    return this.vista() === "cargando" || !this.control("unidadEjecutora").value;
  }

  /** El select de necesidad espera a que haya vigencia. */
  necesidadDeshabilitada(): boolean {
    return (
      this.vista() === "cargando" ||
      this.cargandoOpciones() ||
      !this.control("vigencia").value
    );
  }

  /** Ejecuta (o reejecuta) el cruce con SICAPITAL. */
  consultar(): void {
    const criterios = this.criterios();
    if (
      !criterios.unidadEjecutora ||
      !criterios.vigencia ||
      !criterios.numeroNecesidad
    ) {
      this.reiniciarResultado();
      return;
    }
    this.disparoCruce$.next();
  }

  /** Limpia los criterios y vuelve al estado inicial. */
  limpiarNecesidad(): void {
    this.form.reset({
      unidadEjecutora: "",
      vigencia: "",
      numeroNecesidad: "",
    });
    this.opciones.set([]);
    this.cargandoOpciones.set(false);
    this.intentos.set(0);
    this.acuerdoAceptado.set(false);
    this.reiniciarResultado();
    this.cambioAcuerdo.emit(false);
  }

  /** Reintenta el cruce tras un fallo. */
  reintentar(): void {
    this.consultar();
  }

  /** Vuelve a abrir el diálogo del acuerdo marco (si quedó pendiente). */
  reabrirAcuerdo(): void {
    const acuerdo = this.resultado()?.acuerdoMarco;
    if (acuerdo) {
      this.abrirDialogo(acuerdo);
    }
  }

  /** Reporta la incidencia al canal de soporte (no disponible en esta fase). */
  reportarMesaAyuda(): void {
    this.alerta.showAlert(
      "Mesa de Ayuda REDUDI",
      "El canal de reporte de incidencias se habilitará en una fase posterior del desarrollo.",
    );
  }

  private alCambiarCriterio(): void {
    // Cambiar unidad o vigencia invalida la necesidad seleccionada.
    this.control("numeroNecesidad").setValue("", { emitEvent: false });
    this.acuerdoAceptado.set(false);
    this.cambioAcuerdo.emit(false);
    this.reiniciarResultado();
    this.solicitarOpciones();
  }

  private solicitarOpciones(): void {
    const criterios = this.criterios();
    if (!criterios.unidadEjecutora || !criterios.vigencia) {
      this.opciones.set([]);
      this.cargandoOpciones.set(false);
      return;
    }
    this.cargandoOpciones.set(true);
    this.disparoOpciones$.next();
  }

  private reiniciarResultado(): void {
    this.vista.set("inicial");
    this.resultado.set(null);
    this.fallo.set(null);
    this.cambioEstado.emit("inicial");
  }

  private aplicarExito(resultado: ResultadoCruce): void {
    this.resultado.set(resultado);
    this.fallo.set(null);
    this.vista.set("cargado");
    this.cambioEstado.emit("cargado");

    if (resultado.acuerdoMarco && !this.acuerdoAceptado()) {
      this.cambioAcuerdo.emit(false);
      this.abrirDialogo(resultado.acuerdoMarco);
      return;
    }

    this.cambioAcuerdo.emit(true);
  }

  private aplicarFallo(error: unknown): void {
    const fallo =
      error instanceof ErrorCruceSicapital
        ? error
        : new ErrorCruceSicapital(
            "No fue posible consultar la necesidad en SICAPITAL. Intente nuevamente o contacte a la oficina responsable.",
            "ERR-SIC-DES",
            0,
            error instanceof Error ? error.message : "Error no identificado.",
            "http://sicapital.udistrital.edu.co/ws/presupuesto",
            "10.20.0.45",
          );

    this.resultado.set(null);
    this.fallo.set(fallo);
    this.vista.set("error");
    this.intentos.update((n) => n + 1);
    this.acuerdoAceptado.set(false);
    this.cambioEstado.emit("error");
    this.cambioAcuerdo.emit(false);
  }

  private abrirDialogo(acuerdo: AcuerdoMarco): void {
    if (this.dialogoAbierto()) {
      return;
    }
    this.dialogoAbierto.set(true);
    this.dialog
      .open(DialogoAcuerdoComponent, {
        data: { acuerdo },
        width: "620px",
        maxWidth: "96vw",
        autoFocus: ".dialogo__aceptar",
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((aceptado) => {
        this.dialogoAbierto.set(false);
        this.acuerdoAceptado.set(aceptado === true);
        this.cambioAcuerdo.emit(aceptado === true);
      });
  }

  private criterios() {
    const raw = this.form.getRawValue() as Record<string, string>;
    return {
      unidadEjecutora: raw["unidadEjecutora"] ?? "",
      vigencia: raw["vigencia"] ?? "",
      numeroNecesidad: raw["numeroNecesidad"] ?? "",
    };
  }

  private control(nombre: string): AbstractControl {
    const control = this.form.get(nombre);
    if (!control) {
      throw new Error(`Control "${nombre}" no existe en el subgrupo necesidad`);
    }
    return control;
  }
}
