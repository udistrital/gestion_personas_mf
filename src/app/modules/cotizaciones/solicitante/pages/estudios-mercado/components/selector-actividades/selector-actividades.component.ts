import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, FormGroup } from "@angular/forms";
import type { TipoNecesidadSolicitud } from "../../../../../models/items.model";
import type {
  ActividadVinculada,
  OpcionSnies,
} from "../../../../../models/proveedores.model";
import { ActividadesEconomicasService } from "../../../../../services/actividades-economicas.service";

/** Cambio emitido al panel de búsqueda de S-13. */
export interface CambioActividadesEstudio {
  readonly actividades: readonly ActividadVinculada[];
  readonly areaSnies: string;
  readonly nucleoSnies: string;
}

/**
 * Selector compacto de actividades CIIU y SNIES para S-13.
 *
 * No se usa en el Paso 5 de S-02: ese paso se deja intacto por decisión de
 * producto. Comparte con él los catálogos y el cruce de proveedores a través
 * de `ActividadesEconomicasService`, y mantiene el contrato del formulario
 * (`actividades`, `areaSnies`, `nucleoSnies`) para que el borrador y el
 * servicio de estudios lo lean sin traducciones.
 */
@Component({
  selector: "selector-actividades-estudio",
  templateUrl: "./selector-actividades.component.html",
  styleUrls: ["./selector-actividades.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class SelectorActividadesEstudioComponent
  implements OnInit, OnChanges
{
  @Input({ required: true }) form!: FormGroup;
  @Input() tipoNecesidad: TipoNecesidadSolicitud = "bienes";
  @Input() deshabilitado = false;

  @Output() cambio = new EventEmitter<CambioActividadesEstudio>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogo = inject(ActividadesEconomicasService);

  readonly actividadesCiiu = this.catalogo.actividadesCiiu;
  readonly areasSnies = this.catalogo.areasSnies;
  readonly nucleosSnies = this.catalogo.nucleosSnies;

  readonly actividades = signal<readonly ActividadVinculada[]>([]);
  readonly actividadSeleccionada = signal("");

  /** true cuando el tipo de necesidad admite clasificación SNIES. */
  get sniesAplica(): boolean {
    return this.tipoNecesidad === "servicios" || this.tipoNecesidad === "mixta";
  }

  readonly codigosVinculados = computed(() =>
    this.actividades()
      .map((actividad) => actividad.codigo)
      .join(", "),
  );

  readonly opcionesCiiu: readonly { codigo: string; etiqueta: string }[] =
    this.actividadesCiiu.map((actividad) => ({
      codigo: actividad.codigo,
      etiqueta: `${actividad.codigo} - ${actividad.descripcion}`,
    }));

  ngOnInit(): void {
    const guardadas = this.control("actividades")?.value;
    if (Array.isArray(guardadas)) {
      this.actividades.set(guardadas as readonly ActividadVinculada[]);
    }

    for (const nombre of ["areaSnies", "nucleoSnies"]) {
      this.control(nombre)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.emitirCambio());
    }
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios["tipoNecesidad"] && !this.sniesAplica) {
      this.control("areaSnies")?.setValue("", { emitEvent: false });
      this.control("nucleoSnies")?.setValue("", { emitEvent: false });
      this.emitirCambio();
    }
  }

  seleccionarActividad(codigo: string): void {
    this.actividadSeleccionada.set(codigo);
  }

  agregarActividad(): void {
    const codigo = this.actividadSeleccionada();
    if (!codigo) {
      return;
    }
    const actividad = this.actividadesCiiu.find(
      (candidata) => candidata.codigo === codigo,
    );
    if (!actividad) {
      return;
    }
    if (
      this.actividades().some(
        (vinculada) => vinculada.codigo === actividad.codigo,
      )
    ) {
      this.actividadSeleccionada.set("");
      return;
    }
    this.actividades.update((lista) => [
      ...lista,
      { ...actividad, id: `act-${actividad.codigo}-${Date.now()}` },
    ]);
    this.actividadSeleccionada.set("");
    this.sincronizar();
  }

  eliminarActividad(id: string): void {
    if (this.deshabilitado) {
      return;
    }
    this.actividades.update((lista) =>
      lista.filter((actividad) => actividad.id !== id),
    );
    this.sincronizar();
  }

  etiquetaArea(valor: string): string {
    return (
      this.areasSnies.find((area) => area.valor === valor)?.etiqueta ?? valor
    );
  }

  etiquetaNucleo(valor: string): string {
    return (
      this.nucleosSnies.find((nucleo: OpcionSnies) => nucleo.valor === valor)
        ?.etiqueta ?? valor
    );
  }

  private sincronizar(): void {
    this.control("actividades")?.setValue([...this.actividades()]);
    this.emitirCambio();
  }

  private emitirCambio(): void {
    this.cambio.emit({
      actividades: [...this.actividades()],
      areaSnies: String(this.control("areaSnies")?.value ?? ""),
      nucleoSnies: String(this.control("nucleoSnies")?.value ?? ""),
    });
  }

  private control(nombre: string): AbstractControl | null {
    return this.form.get(nombre);
  }
}
