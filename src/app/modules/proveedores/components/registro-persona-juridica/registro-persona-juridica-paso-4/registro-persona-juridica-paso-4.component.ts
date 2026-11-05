import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { OpcionCatalogo } from '../services/registro-persona-juridica-catalogos.service';

/** Actividad CIIU resuelta contra el catálogo para pintar la tarjeta. */
interface ActividadCiiuSeleccionada {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  disponible: boolean;
}

/** Opción del buscador de actividades CIIU. */
interface OpcionCiiu {
  id: number;
  etiqueta: string;
}

@Component({
  selector: 'registro-persona-juridica-paso-4',
  templateUrl: './registro-persona-juridica-paso-4.component.html',
  styleUrls: ['./registro-persona-juridica-paso-4.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso4Component
  implements OnInit, OnChanges
{
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogoCiiu: OpcionCatalogo[] = [];
  @Input() cargandoCiiu = false;
  @Input() errorCiiu: string | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();
  @Output() reintentarCiiu = new EventEmitter<void>();

  /** Selección provisional del buscador; se limpia después de agregar. */
  readonly actividadCiiuDisponibleId = new FormControl<number | null>(null);

  /** Opciones ya filtradas; se recalculan al cambiar catálogo o selección. */
  actividadesCiiuDisponibles: OpcionCiiu[] = [];

  /** Anuncio para lectores de pantalla después de agregar o retirar. */
  anuncioCiiu = '';

  ngOnInit(): void {
    this.actualizarOpcionesCiiu();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['catalogoCiiu']) {
      this.actualizarOpcionesCiiu();
    }
  }

  get actividadesCiiuSeleccionadas(): ActividadCiiuSeleccionada[] {
    return this.idsSeleccionados().map(id => {
      const opcion = this.catalogoCiiu.find(actividad => actividad.id === id);
      if (!opcion) {
        return {
          id,
          codigo: String(id),
          nombre: 'Actividad no disponible en el catálogo',
          descripcion: '',
          disponible: false,
        };
      }
      return {
        id,
        codigo: opcion.codigo ?? String(opcion.id),
        nombre: opcion.nombre,
        descripcion: opcion.descripcion ?? '',
        disponible: true,
      };
    });
  }

  get hayActividadesNoDisponibles(): boolean {
    return this.actividadesCiiuSeleccionadas.some(
      actividad => !actividad.disponible,
    );
  }

  get mostrarErrorActividades(): boolean {
    const campo = this.formulario.get('actividadesCiiu');
    return !!campo && campo.touched && campo.hasError('minlength');
  }

  get mostrarErrorPrincipal(): boolean {
    const campo = this.formulario.get('actividadCiiuPrincipalId');
    return !!campo && campo.touched && campo.hasError('required');
  }

  get excedeDescripcion(): boolean {
    const campo = this.formulario.get('descripcionServicios');
    return !!campo && campo.touched && campo.hasError('maxlength');
  }

  esPrincipal(id: number): boolean {
    return this.formulario.get('actividadCiiuPrincipalId')?.value === id;
  }

  /** Permite seleccionar la actividad principal haciendo clic en toda la píldora. */
  seleccionarPrincipal(id: number): void {
    if (this.esPrincipal(id)) {
      return;
    }
    this.formulario.get('actividadCiiuPrincipalId')?.setValue(id);
    this.emitirCambio();
  }

  agregarActividadCiiu(): void {
    const id = this.actividadCiiuDisponibleId.value;
    if (id === null || this.idsSeleccionados().includes(id)) {
      return;
    }

    const ids = [...this.idsSeleccionados(), id];
    this.formulario.get('actividadesCiiu')?.setValue(ids);

    const principal = this.formulario.get('actividadCiiuPrincipalId')?.value;
    if (typeof principal !== 'number' || !ids.includes(principal)) {
      this.formulario.get('actividadCiiuPrincipalId')?.setValue(id);
    }

    this.anuncioCiiu = `Actividad CIIU ${this.codigoActividad(id)} agregada.`;
    this.actividadCiiuDisponibleId.setValue(null);
    this.actualizarOpcionesCiiu();
    this.emitirCambio();
  }

  quitarActividadCiiu(id: number): void {
    const restantes = this.idsSeleccionados().filter(
      actividadId => actividadId !== id,
    );
    this.formulario.get('actividadesCiiu')?.setValue(restantes);

    const principal = this.formulario.get('actividadCiiuPrincipalId')?.value;
    if (principal === id) {
      this.formulario
        .get('actividadCiiuPrincipalId')
        ?.setValue(restantes[0] ?? null);
    }

    this.anuncioCiiu = `Actividad CIIU ${this.codigoActividad(id)} retirada.`;
    this.actualizarOpcionesCiiu();
    this.emitirCambio();
  }

  reintentar(): void {
    this.reintentarCiiu.emit();
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }

  /** Recalcula las opciones disponibles sin perder la búsqueda del usuario. */
  private actualizarOpcionesCiiu(): void {
    const seleccionadas = new Set(this.idsSeleccionados());
    this.actividadesCiiuDisponibles = this.catalogoCiiu
      .filter(actividad => !seleccionadas.has(actividad.id))
      .map(actividad => ({
        id: actividad.id,
        etiqueta: `${actividad.codigo ?? actividad.id} — ${actividad.nombre}`,
      }));
  }

  private idsSeleccionados(): number[] {
    const valor: unknown = this.formulario.get('actividadesCiiu')?.value;
    return Array.isArray(valor)
      ? valor.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
      : [];
  }

  private codigoActividad(id: number): string {
    return (
      this.catalogoCiiu.find(actividad => actividad.id === id)?.codigo
      ?? String(id)
    );
  }
}
