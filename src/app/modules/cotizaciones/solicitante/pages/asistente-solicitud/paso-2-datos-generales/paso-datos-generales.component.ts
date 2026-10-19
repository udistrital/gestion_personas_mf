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
  CaracteristicasSolicitud,
  ResponsableSolicitud,
} from "../../../../models/necesidad.model";

/**
 * Validador del cronograma: la fecha de cierre debe estar al menos
 * `DIAS_HABILES_MINIMOS` días hábiles después de la apertura.
 *
 * Es un validador de grupo porque depende de los dos controles a la vez.
 */
export function validadorCronograma(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const apertura = String(grupo.get("fechaApertura")?.value ?? "");
    const cierre = String(grupo.get("fechaCierre")?.value ?? "");
    if (!apertura || !cierre) {
      return null;
    }
    const dias = diasHabilesEntre(apertura, cierre);
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

  private readonly destroyRef = inject(DestroyRef);

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
    const apertura = String(this.control("fechaApertura").value ?? "");
    const cierre = String(this.control("fechaCierre").value ?? "");
    const dias = diasHabilesEntre(apertura, cierre);
    return {
      aperturaLarga: formatoFechaLarga(apertura),
      cierreLarga: formatoFechaLarga(cierre),
      aperturaCorta: formatoFechaCorta(apertura),
      cierreCorta: formatoFechaCorta(cierre),
      dias,
      cumple: !!apertura && !!cierre && dias >= DIAS_HABILES_MINIMOS,
      completo: !!apertura && !!cierre,
    };
  });

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
