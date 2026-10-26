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
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import {
  DEPENDENCIAS_DESTINO,
  DEPENDENCIAS_SOLICITANTES,
  DIAS_HABILES_MINIMOS,
  HITOS_CRONOGRAMA,
  MIN_CARACTERES_CRITERIO,
  MIN_CARACTERES_PLAN,
  diasHabilesEntre,
  formatoFechaCorta,
  formatoFechaLarga,
} from "../../../../models/datos-generales.model";
import {
  FechasFestivas,
  festivosDelRango,
} from "../../../../models/calendario.model";
import { CalendarioFestivosService } from "../../../../services/calendario-festivos.service";
import {
  CaracteristicasSolicitud,
  ResponsableSolicitud,
} from "../../../../models/necesidad.model";
import type { ModoEdicionSolicitud } from "../../../../models/edicion-solicitud.model";
import { ReglasEdicionSolicitudService } from "../../../../services/reglas-edicion-solicitud.service";

/**
 * Validador del cronograma: la fecha de cierre debe estar al menos
 * `DIAS_HABILES_MINIMOS` días hábiles después de la apertura.
 *
 * Es un validador de grupo porque depende de los dos controles a la vez.
 *
 * Los días hábiles se calculan con el calendario de festivos vigente, que se
 * recibe como función para leer siempre el estado más reciente: cuando la
 * consulta del calendario termina, el asistente revalida el grupo y la regla
 * se vuelve a evaluar con los festivos ya cargados.
 */
export function validadorCronograma(
  obtenerFestivos: () => FechasFestivas = () => new Set<string>(),
): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    // Se lee el valor crudo: en la modificación restringida la apertura está
    // deshabilitada y `.value` devolvería `null`, dejando la regla sin aplicar
    // cuando el usuario cambia solo la fecha de cierre.
    const apertura = String(grupo.get("fechaApertura")?.getRawValue() ?? "");
    const cierre = String(grupo.get("fechaCierre")?.getRawValue() ?? "");
    if (!apertura || !cierre) {
      return null;
    }
    const dias = diasHabilesEntre(apertura, cierre, obtenerFestivos());
    return dias >= DIAS_HABILES_MINIMOS
      ? null
      : { cronogramaInsuficiente: { dias, minimo: DIAS_HABILES_MINIMOS } };
  };
}

/**
 * Validador de longitud mínima del texto visible (sin etiquetas HTML), para
 * los campos del editor enriquecido.
 */
export function minCaracteres(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const html = String(control.value ?? "");
    const nodo = document.createElement("div");
    nodo.innerHTML = html;
    const texto = (nodo.textContent ?? "").trim();
    if (!texto) {
      return { required: true };
    }
    return texto.length >= minimo ? null : { minCaracteres: { minimo } };
  };
}

/**
 * Paso 2 del asistente: "Datos generales, cronograma y plan de acción".
 *
 * Replica las cuatro tarjetas del mockup aprobado. El responsable y las
 * características técnicas llegan precargados del cruce con SICAPITAL (paso 1,
 * solo lectura); el solicitante define dependencias, cronograma, criterio de
 * selección y plan de acción.
 */
@Component({
  selector: "paso-datos-generales",
  templateUrl: "./paso-datos-generales.component.html",
  styleUrls: ["./paso-datos-generales.component.scss"],
  standalone: false,
})
export class PasoDatosGeneralesComponent implements OnInit {
  readonly dependenciasSolicitantes = DEPENDENCIAS_SOLICITANTES;
  readonly dependenciasDestino = DEPENDENCIAS_DESTINO;
  readonly hitos = HITOS_CRONOGRAMA;
  readonly minCriterio = MIN_CARACTERES_CRITERIO;
  readonly minPlan = MIN_CARACTERES_PLAN;
  readonly minimoDiasHabiles = DIAS_HABILES_MINIMOS;

  /** Subgrupo `datosGenerales` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  /**
   * Datos del cruce con SICAPITAL. `null` mientras el paso 1 no ha cruzado:
   * en ese caso las tarjetas de solo lectura se muestran vacías con un aviso.
   */
  @Input() resultado: RespuestaPaso2 | null = null;

  /**
   * Modo de edición (S-04). `null` en la creación; `restringida` deshabilita
   * todos los campos del paso salvo la fecha de cierre.
   */
  @Input() modoEdicion: ModoEdicionSolicitud | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly reglas = inject(ReglasEdicionSolicitudService);

  /**
   * Calendario de días festivos (raíz del inyector).
   *
   * Lo consulta el asistente; este componente sólo lee el resultado para
   * contar los días hábiles y para avisar cuando el calendario no está
   * disponible.
   */
  private readonly calendario = inject(CalendarioFestivosService);

  /** Dispara el recálculo del resumen del cronograma. */
  private readonly marcas = signal(0);

  ngOnInit(): void {
    const apertura = this.control("fechaApertura");
    const cierre = this.control("fechaCierre");
    [apertura, cierre].forEach((control) =>
      control.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.marcas.update((n) => n + 1)),
    );
  }

  /** Resumen calculado del cronograma (días hábiles y cumplimiento). */
  readonly cronograma = computed(() => {
    this.marcas();
    // `getRawValue` conserva la apertura aunque el modo restringido la
    // deshabilite: el resumen del cronograma debe seguir mostrando el rango.
    const apertura = String(this.control("fechaApertura").getRawValue() ?? "");
    const cierre = String(this.control("fechaCierre").getRawValue() ?? "");
    const dias = diasHabilesEntre(
      apertura,
      cierre,
      this.calendario.fechasFestivas(),
    );
    return {
      aperturaLarga: formatoFechaLarga(apertura),
      cierreLarga: formatoFechaLarga(cierre),
      aperturaCorta: formatoFechaCorta(apertura),
      cierreCorta: formatoFechaCorta(cierre),
      dias,
      cumple: !!apertura && !!cierre && dias >= DIAS_HABILES_MINIMOS,
      completo: !!apertura && !!cierre,
      /** Festivos que se descuentan dentro del rango del cronograma. */
      festivosExcluidos: this.festivosExcluidos(apertura, cierre),
    };
  });

  /** true mientras se consulta el calendario de festivos. */
  readonly calendarioCargando = computed(
    () => this.calendario.detalle().estado === "cargando",
  );

  /**
   * true cuando el conteo de días hábiles se hizo sin todos los festivos.
   *
   * El trámite no se bloquea: la tarjeta avisa al solicitante para que revise
   * los días festivos al elegir la fecha de cierre.
   */
  readonly calendarioDegradado = computed(() => this.calendario.degradado());

  /** Vuelve a consultar los años del calendario que no se pudieron cargar. */
  reintentarCalendario(): void {
    this.calendario.reintentar();
  }

  /** Festivos del rango del cronograma, con la fecha ya formateada. */
  private festivosExcluidos(
    apertura: string,
    cierre: string,
  ): readonly FestivoExcluido[] {
    return festivosDelRango(
      apertura,
      cierre,
      this.calendario.festivos(),
    ).map((festivo) => ({
      fecha: festivo.fecha,
      fechaCorta: formatoFechaCorta(festivo.fecha),
      nombre: festivo.nombre,
    }));
  }

  /** Responsable precargado por SICAPITAL (o `null` si no hay cruce). */
  get responsable(): ResponsableSolicitud | null {
    return this.resultado?.responsable ?? null;
  }

  /** Características precargadas por SICAPITAL (o `null` si no hay cruce). */
  get caracteristicas(): CaracteristicasSolicitud | null {
    return this.resultado?.caracteristicas ?? null;
  }

  /** Etiqueta de cada hito: fecha real del cronograma o "Por definir". */
  fechaHito(origen: string): string {
    const resumen = this.cronograma();
    switch (origen) {
      case "apertura":
        return resumen.aperturaCorta || "Por definir";
      case "cierre":
        return resumen.cierreCorta || "Por definir";
      default:
        return "Por definir";
    }
  }

  /** true cuando el hito tiene fecha calculable en el cronograma. */
  hitoActivo(origen: string, definido: boolean): boolean {
    if (origen === "apertura") {
      return !!this.cronograma().aperturaCorta;
    }
    if (origen === "cierre") {
      return !!this.cronograma().cierreCorta;
    }
    return definido;
  }

  /** true si el mensaje de error del criterio debe mostrarse. */
  mostrarErrorCriterio(): boolean {
    const control = this.control("criterioSeleccion");
    return control.invalid && (control.dirty || control.touched);
  }

  /** true si el mensaje de error del plan debe mostrarse. */
  mostrarErrorPlan(): boolean {
    const control = this.control("planAccion");
    return control.invalid && (control.dirty || control.touched);
  }

  /** true cuando el paso se muestra dentro de una edición (S-04). */
  get esEdicion(): boolean {
    return this.modoEdicion !== null;
  }

  /** true en una modificación restringida (solo fecha de cierre). */
  get esRestringida(): boolean {
    return this.modoEdicion === "restringida";
  }

  /** true si el campo se puede modificar en el modo actual. */
  campoEditable(campo: string): boolean {
    const modo = this.modoEdicion;
    return !modo || this.reglas.campoDatosGeneralesEditable(campo, modo);
  }

  private control(nombre: string): AbstractControl {
    const control = this.form.get(nombre);
    if (!control) {
      throw new Error(
        `Control "${nombre}" no existe en el subgrupo datosGenerales`,
      );
    }
    return control;
  }
}

/** Contrato mínimo de los datos de SICAPITAL que consume el paso 2. */
export interface RespuestaPaso2 {
  readonly responsable: ResponsableSolicitud;
  readonly caracteristicas: CaracteristicasSolicitud;
}

/** Festivo que se descuenta del cronograma, con la fecha ya formateada. */
interface FestivoExcluido {
  readonly fecha: string;
  readonly fechaCorta: string;
  readonly nombre: string;
}
