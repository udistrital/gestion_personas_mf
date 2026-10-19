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
import { AlertService } from "src/app/shared/services/alert.service";
import { formatoFechaCorta } from "../../../../models/datos-generales.model";
import {
  ACTIVIDADES_CIIU,
  AREAS_SNIES,
  ActividadVinculada,
  NBC_SIN_IDONEIDAD,
  NUCLEOS_SNIES,
  ProveedorObjetivo,
  ResumenSolicitudProveedores,
  buscarProveedores,
  etiquetaTipoNecesidad,
  exigeSnies,
  listarCodigos,
  perfilNbc,
} from "../../../../models/proveedores.model";

/** Proveedores que despliega la muestra de la tarjeta 4 (mockup: 3). */
const PROVEEDORES_EN_MUESTRA = 3;

/** Pluraliza el contador de actividades vinculadas. */
function formatoVinculadas(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "vinculada" : "vinculadas"}`;
}

/**
 * Validador del paso 5: exige al menos una actividad económica (CIIU).
 *
 * El SNIES obligatorio no vive aquí porque depende del tipo de necesidad que
 * calcula el paso 3; el asistente lo evalúa con esa información.
 */
export function criteriosProveedores(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const lista = grupo.get("actividades")?.value;
    if (!Array.isArray(lista) || lista.length === 0) {
      return { sinActividades: true };
    }
    return null;
  };
}

/**
 * Paso 5 del asistente: "Proveedores objetivo".
 *
 * Reúne los tres estados del mockup aprobado sobre un mismo componente: la
 * segmentación de servicios (exige SNIES), la de bienes (solo CIIU) y el cruce
 * sin coincidencias. El tipo de necesidad decide si el SNIES aplica y el cruce
 * del banco de proveedores decide el estado de la tarjeta 4.
 */
@Component({
  selector: "paso-proveedores",
  templateUrl: "./paso-proveedores.component.html",
  styleUrls: ["./paso-proveedores.component.scss"],
  standalone: false,
})
export class PasoProveedoresComponent implements OnInit {
  readonly catalogoCiiu = ACTIVIDADES_CIIU;
  readonly areasSnies = AREAS_SNIES;
  readonly nucleosSnies = NUCLEOS_SNIES;
  readonly formatoVinculadas = formatoVinculadas;

  /** Subgrupo `proveedores` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  /** Resumen de solo lectura que alimenta la tarjeta 1. */
  @Input() resumen: ResumenSolicitudProveedores | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly alerta = inject(AlertService);

  /** Actividades económicas vinculadas (tabla de la tarjeta 2). */
  readonly actividades = signal<readonly ActividadVinculada[]>([]);

  /** Término del buscador de actividades. */
  readonly busqueda = signal("");

  /** true cuando la muestra de proveedores está desplegada. */
  readonly mostrarProveedores = signal(false);

  /** Dispara el recálculo cuando cambian los selectores del SNIES. */
  private readonly marcas = signal(0);

  ngOnInit(): void {
    const guardadas = this.controlOpcional("actividades")?.value;
    if (Array.isArray(guardadas) && guardadas.length > 0) {
      this.actividades.set(guardadas as readonly ActividadVinculada[]);
    }

    for (const nombre of ["areaSnies", "nucleoSnies"]) {
      this.controlOpcional(nombre)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.mostrarProveedores.set(false);
          this.marcas.update((cantidad) => cantidad + 1);
        });
    }
  }

  // ── Estado derivado ──────────────────────────────────────────────────────

  /** Tipo de necesidad calculado en el paso 3 ("bienes" por defecto). */
  get tipoNecesidad(): "bienes" | "servicios" | "mixta" {
    return this.resumen?.tipoNecesidad ?? "bienes";
  }

  /** true cuando la solicitud exige idoneidad técnica certificada (SNIES). */
  get sniesAplica(): boolean {
    return exigeSnies(this.tipoNecesidad);
  }

  /** Etiqueta del tipo de necesidad para la cabecera de la tarjeta 1. */
  get etiquetaNecesidad(): string {
    return etiquetaTipoNecesidad(this.tipoNecesidad);
  }

  /** Códigos CIIU vinculados ("6201, 6202, 6209"). */
  get codigosVinculados(): string {
    return listarCodigos(this.actividades());
  }

  /** Proveedores que cumplen las características de la solicitud. */
  readonly proveedores = computed<readonly ProveedorObjetivo[]>(() => {
    this.marcas();
    const codigos = this.actividades().map((actividad) => actividad.codigo);
    const nucleo = String(this.controlOpcional("nucleoSnies")?.value ?? "");
    return buscarProveedores(codigos, nucleo, this.sniesAplica);
  });

  /** Muestra acotada que despliega la tarjeta 4. */
  readonly muestraProveedores = computed(() =>
    this.proveedores().slice(0, PROVEEDORES_EN_MUESTRA),
  );

  /** true cuando el cruce no devolvió coincidencias. */
  readonly sinCoincidencias = computed(() => this.proveedores().length === 0);

  /** Perfil técnico inferido del NBC elegido. */
  readonly perfil = computed(() => {
    this.marcas();
    return perfilNbc(String(this.controlOpcional("nucleoSnies")?.value ?? ""));
  });

  /** Fecha de apertura ya formateada (o guion cuando falta). */
  get fechaAperturaTexto(): string {
    return this.resumen?.fechaApertura
      ? formatoFechaCorta(this.resumen.fechaApertura)
      : "—";
  }

  /** Fecha de cierre ya formateada (o guion cuando falta). */
  get fechaCierreTexto(): string {
    return this.resumen?.fechaCierre
      ? formatoFechaCorta(this.resumen.fechaCierre)
      : "—";
  }

  /** true cuando un selector obligatorio del SNIES quedó vacío. */
  mostrarErrorSnies(nombre: string): boolean {
    const control = this.controlOpcional(nombre);
    return (
      this.sniesAplica &&
      !!control &&
      !control.value &&
      (control.dirty || control.touched)
    );
  }

  /** Refleja el texto del buscador CIIU en la señal local. */
  alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  // ── Acciones de la tarjeta 2 (CIIU) ──────────────────────────────────────

  /** Vincula la actividad buscada (por código o palabra clave). */
  agregarActividad(): void {
    const consulta = this.busqueda().trim();
    if (!consulta) {
      return;
    }

    const objetivo = this.catalogoCiiu.find(
      (actividad) =>
        actividad.codigo === consulta ||
        actividad.codigo.startsWith(consulta) ||
        actividad.descripcion.toLowerCase().includes(consulta.toLowerCase()),
    );

    if (!objetivo) {
      this.alerta.showAlert(
        "Actividad no encontrada",
        "No se halló una actividad CIIU con ese código o palabra clave. Verifique el catálogo DANE (Revisión 4 A.C.).",
      );
      return;
    }

    if (
      this.actividades().some(
        (actividad) => actividad.codigo === objetivo.codigo,
      )
    ) {
      this.alerta.showAlert(
        "Actividad ya vinculada",
        `El código CIIU ${objetivo.codigo} ya hace parte de la segmentación de la solicitud.`,
      );
      return;
    }

    this.actividades.update((lista) => [
      ...lista,
      { ...objetivo, id: `${objetivo.codigo}-${Date.now()}` },
    ]);
    this.sincronizarLista();
    this.busqueda.set("");
  }

  /** Quita una actividad de la tabla. */
  eliminarActividad(id: string): void {
    this.actividades.update((lista) =>
      lista.filter((actividad) => actividad.id !== id),
    );
    this.sincronizarLista();
  }

  /** Alterna la visibilidad de la muestra de proveedores. */
  alternarProveedores(): void {
    this.mostrarProveedores.update((visible) => !visible);
  }

  // ── Acciones de la barra contextual (estado sin coincidencias) ────────────

  /** Devuelve los criterios de segmentación a su estado inicial. */
  restablecerFiltros(): void {
    this.actividades.set([]);
    this.busqueda.set("");
    this.controlOpcional("areaSnies")?.setValue("");
    this.controlOpcional("nucleoSnies")?.setValue("");
    this.mostrarProveedores.set(false);
    this.sincronizarLista();
    this.marcas.update((cantidad) => cantidad + 1);
  }

  /** Aplica el perfil general (sin idoneidad técnica certificada). */
  usarPerfilGeneral(): void {
    if (!this.sniesAplica) {
      return;
    }
    this.controlOpcional("areaSnies")?.setValue("SIN");
    this.controlOpcional("nucleoSnies")?.setValue(NBC_SIN_IDONEIDAD);
    this.mostrarProveedores.set(false);
    this.marcas.update((cantidad) => cantidad + 1);
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  /**
   * Escribe la lista de actividades en el control `actividades` del formulario.
   *
   * Se guarda como un arreglo plano (no `FormArray`) para que el borrador
   * pueda restaurarlo con un simple `patchValue`.
   */
  private sincronizarLista(): void {
    this.controlOpcional("actividades")?.setValue([...this.actividades()]);
  }

  private controlOpcional(nombre: string): AbstractControl | null {
    return this.form.get(nombre);
  }
}
