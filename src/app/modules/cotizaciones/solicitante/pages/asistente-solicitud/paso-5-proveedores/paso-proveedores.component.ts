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
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs";
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
  ActividadCiiu,
  ActividadVinculada,
  CODIGOS_AREAS_SNIES,
  NBC_SIN_IDONEIDAD,
  NUCLEOS_SNIES,
  OpcionSnies,
  ProveedorObjetivo,
  ResumenSolicitudProveedores,
  buscarProveedores,
  etiquetaTipoNecesidad,
  exigeSnies,
  listarCodigos,
  perfilNbc,
} from "../../../../models/proveedores.model";
import { RegistroPersonaJuridicaCatalogosService } from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-catalogos.service";

/** Proveedores que despliega la muestra de la tarjeta 4 (mockup: 3). */
const PROVEEDORES_EN_MUESTRA = 3;

const AREAS_SNIES_ANTERIORES: Readonly<Record<string, string>> = {
  ING: "ING_ARQ_AFINES",
  CIEN: "CIENCIAS_EDUCACIÓN",
  ECON: "ECONO_ADMIN_AFINES",
  SOC: "CIENCIAS_HUMANAS",
  NAT: "MAT_NATURALES",
  SALUD: "CIENCIAS_SALUD",
};

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
  catalogoCiiu: readonly ActividadCiiu[] = [];
  readonly areasSnies = signal<readonly OpcionSnies[]>([]);
  readonly nucleosSnies = signal<readonly OpcionSnies[]>([]);
  readonly formatoVinculadas = formatoVinculadas;

  /** Subgrupo `proveedores` del `FormGroup` raíz del asistente. */
  @Input({ required: true }) form!: FormGroup;

  /** Resumen de solo lectura que alimenta la tarjeta 1. */
  @Input() resumen: ResumenSolicitudProveedores | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly alerta = inject(AlertService);
  private readonly catalogos = inject(RegistroPersonaJuridicaCatalogosService);

  /** Actividades económicas vinculadas (tabla de la tarjeta 2). */
  readonly actividades = signal<readonly ActividadVinculada[]>([]);

  /** Término del buscador de actividades. */
  readonly busqueda = signal("");

  /** Código CIIU elegido para vincular a la solicitud. */
  readonly actividadSeleccionada = signal("");

  /** Actividades del catálogo que coinciden con el filtro. */
  readonly actividadesFiltradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return this.catalogoCiiu.filter(
      (actividad) =>
        !termino ||
        actividad.codigo.toLowerCase().includes(termino) ||
        actividad.descripcion.toLowerCase().includes(termino),
    );
  });

  /** true cuando la muestra de proveedores está desplegada. */
  readonly mostrarProveedores = signal(false);

  /** Dispara el recálculo cuando cambian los selectores del SNIES. */
  private readonly marcas = signal(0);

  ngOnInit(): void {
    this.catalogos
      .obtenerCatalogoParametro("CIIU")
      .pipe(
        map((opciones) =>
          opciones.map((opcion) => {
            if (!opcion.codigo) {
              throw new Error(
                `El parámetro CIIU con Id ${opcion.id} no contiene CodigoAbreviacion.`,
              );
            }
            const existente = ACTIVIDADES_CIIU.find(
              (actividad) => actividad.codigo === opcion.codigo,
            );
            return {
              codigo: opcion.codigo,
              descripcion: opcion.descripcion || opcion.nombre,
              clase: existente?.clase ?? "CIIU",
            };
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (opciones) => {
          this.catalogoCiiu = opciones;
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar el catálogo CIIU.",
          );
        },
      });

    this.catalogos
      .obtenerTiposParametroPorArea("SNIES", CODIGOS_AREAS_SNIES)
      .pipe(
        map((opciones) => {
          const porCodigo = new Map<
            string,
            (typeof opciones)[number]
          >();
          for (const opcion of opciones) {
            if (typeof opcion.codigo === "string") {
              porCodigo.set(opcion.codigo, opcion);
            }
          }
          const faltantes = CODIGOS_AREAS_SNIES.filter(
            (codigo) => !porCodigo.has(codigo),
          );
          if (faltantes.length > 0) {
            throw new Error(
              `No se encontraron tipos de parámetro SNIES: ${faltantes.join(", ")}.`,
            );
          }
          return CODIGOS_AREAS_SNIES.map((codigo) => {
            const opcion = porCodigo.get(codigo);
            if (!opcion) {
              throw new Error(
                `No se encontró el tipo de parámetro SNIES "${codigo}".`,
              );
            }
            return {
              valor: codigo,
              etiqueta: opcion.nombre,
              icono: "school",
            };
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (opciones) => {
          this.areasSnies.set(opciones);
          this.cargarNucleosSnies();
        },
        error: () => {
          this.alerta.showAlert(
            "Catálogo no disponible",
            "No fue posible cargar las áreas de conocimiento SNIES.",
          );
        },
      });

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

  private cargarNucleosSnies(): void {
    const controlArea = this.controlOpcional("areaSnies");
    if (!controlArea) {
        return;
    }

    const areaGuardada = String(controlArea.value ?? "");
    const areaMigrada = AREAS_SNIES_ANTERIORES[areaGuardada] ?? areaGuardada;
    if (this.areasSnies().some((area) => area.valor === areaMigrada)) {
        if (areaMigrada !== areaGuardada) {
          controlArea.setValue(areaMigrada, { emitEvent: false });
        }
    } else if (areaGuardada) {
        controlArea.setValue("", { emitEvent: false });
        this.controlOpcional("nucleoSnies")?.setValue("", {
          emitEvent: false,
        });
    }

    let primeraSeleccion = true;
    controlArea.valueChanges
        .pipe(
          startWith(controlArea.value),
          distinctUntilChanged(),
          tap(() => {
            this.nucleosSnies.set([]);
            if (!primeraSeleccion) {
              this.controlOpcional("nucleoSnies")?.setValue("", {
                emitEvent: false,
              });
            }
            primeraSeleccion = false;
          }),
          switchMap((valor: unknown) => {
            const area = this.areasSnies().find(
              (opcion) => opcion.valor === String(valor ?? ""),
            );
            if (!area) {
              return of([]);
            }
            return this.catalogos
              .obtenerCatalogoParametro(area.valor, "SNIES")
              .pipe(
                map((opciones) =>
                  opciones.map((opcion) => {
                    if (!opcion.codigo) {
                      throw new Error(
                        `El núcleo SNIES con Id ${opcion.id} no contiene CodigoAbreviacion.`,
                      );
                    }
                    const existente = NUCLEOS_SNIES.find(
                      (nucleo) => nucleo.valor === opcion.codigo,
                    );
                    return {
                      valor: opcion.codigo,
                      etiqueta: opcion.nombre,
                      icono: existente?.icono ?? "school",
                    };
                  }),
                ),
              );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (opciones) => {
            this.nucleosSnies.set(opciones);
            const controlNucleo = this.controlOpcional("nucleoSnies");
            if (
              controlNucleo?.value &&
              !opciones.some(
                (opcion) => opcion.valor === controlNucleo.value,
              )
            ) {
              controlNucleo.setValue("", { emitEvent: false });
            }
          },
          error: () => {
            this.alerta.showAlert(
              "Catálogo no disponible",
              "No fue posible cargar los núcleos básicos de conocimiento para el área seleccionada.",
            );
          },
        });
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
    this.actividadSeleccionada.set("");
  }

  /** Registra el código elegido en el selector de actividades. */
  alSeleccionarActividad(evento: Event): void {
    this.actividadSeleccionada.set(
      (evento.target as HTMLSelectElement).value,
    );
  }

  // ── Acciones de la tarjeta 2 (CIIU) ──────────────────────────────────────

  /** Vincula la actividad seleccionada del catálogo CIIU. */
  agregarActividad(): void {
    const codigo = this.actividadSeleccionada();
    if (!codigo) {
      return;
    }

    const objetivo = this.catalogoCiiu.find(
      (actividad) => actividad.codigo === codigo,
    );

    if (!objetivo) {
      this.alerta.showAlert(
        "Actividad no encontrada",
        "No se halló la actividad CIIU seleccionada. Verifique el catálogo DANE (Revisión 4 A.C.).",
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
    this.actividadSeleccionada.set("");
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
    this.actividadSeleccionada.set("");
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
