import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../../../shared/shared.module';
import { OpcionNatural } from '../registro-persona-natural-catalogos.service';

/** Actividad CIIU resuelta contra el catálogo para pintar la tarjeta. */
interface ActividadCiiuSeleccionada {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  disponible: boolean;
}

@Component({
  selector: 'app-registro-persona-natural-paso-4',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    SharedModule,
  ],
  templateUrl: './registro-persona-natural-paso-4.component.html',
  styleUrl: './registro-persona-natural-paso-4.component.scss',
})
export class RegistroPersonaNaturalPaso4Component {
  @Input({ required: true })
  actividadDeclaracionForm!: FormGroup;

  @Input()
  catalogoCiiu: OpcionNatural[] = [];

  @Input()
  cargandoCiiu = false;

  @Input()
  errorCiiu: string | null = null;

  @Output()
  reintentarCiiu = new EventEmitter<void>();

  /** Selección provisional del buscador; se limpia después de agregar. */
  readonly actividadCiiuDisponibleId = new FormControl<number | null>(null);

  /** Anuncio para lectores de pantalla después de agregar o retirar. */
  anuncioCiiu = '';

  /**
   * `app-search-selection` reconstruye sus opciones cuando cambia la
   * referencia de `items`. Se cachea la lista para no reiniciar el buscador en
   * cada ciclo de detección de cambios.
   */
  private cacheOpcionesCiiu: {
    clave: string;
    catalogo: OpcionNatural[];
    opciones: Array<{ id: number; etiqueta: string }>;
  } | null = null;

  get actividadesCiiuSeleccionadas(): ActividadCiiuSeleccionada[] {
    return this.idsSeleccionados.map((id) => {
      const opcion = this.catalogoCiiu.find(
        (actividad) => actividad.id === id,
      );
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

  /** Opciones que todavía no están agregadas, con la etiqueta que muestra el buscador. */
  get opcionesCiiuDisponibles(): Array<{ id: number; etiqueta: string }> {
    const ids = this.idsSeleccionados;
    const clave = ids.join(',');
    if (
      this.cacheOpcionesCiiu
      && this.cacheOpcionesCiiu.clave === clave
      && this.cacheOpcionesCiiu.catalogo === this.catalogoCiiu
    ) {
      return this.cacheOpcionesCiiu.opciones;
    }

    const seleccionadas = new Set(ids);
    const opciones = this.catalogoCiiu
      .filter((actividad) => !seleccionadas.has(actividad.id))
      .map((actividad) => ({
        id: actividad.id,
        etiqueta: `${actividad.codigo ?? actividad.id} — ${actividad.nombre}`,
      }));

    this.cacheOpcionesCiiu = {
      clave,
      catalogo: this.catalogoCiiu,
      opciones,
    };
    return opciones;
  }

  get hayActividadesNoDisponibles(): boolean {
    return this.actividadesCiiuSeleccionadas.some(
      (actividad) => !actividad.disponible,
    );
  }

  get mostrarErrorActividades(): boolean {
    return (
      this.actividadDeclaracionForm.touched &&
      this.actividadDeclaracionForm.hasError('ciiuSinActividades')
    );
  }

  get mostrarErrorPrincipal(): boolean {
    return (
      this.actividadDeclaracionForm.touched &&
      this.actividadDeclaracionForm.hasError('ciiuSinPrincipal')
    );
  }

  esPrincipal(id: number): boolean {
    return this.actividadDeclaracionForm.get('actividadCiiuPrincipalId')?.value
      === id;
  }

  agregarActividadCiiu(): void {
    const id = this.actividadCiiuDisponibleId.value;
    if (id === null || this.idsSeleccionados.includes(id)) {
      return;
    }

    const ids = [...this.idsSeleccionados, id];
    this.actividadDeclaracionForm.get('actividadesCiiu')?.setValue(ids);

    const principal = this.actividadDeclaracionForm.get(
      'actividadCiiuPrincipalId',
    )?.value;
    if (typeof principal !== 'number' || !ids.includes(principal)) {
      this.actividadDeclaracionForm
        .get('actividadCiiuPrincipalId')
        ?.setValue(id);
    }

    this.anuncioCiiu = `Actividad CIIU ${this.codigoActividad(id)} agregada.`;
    this.actividadCiiuDisponibleId.setValue(null);
  }

  quitarActividadCiiu(id: number): void {
    const restantes = this.idsSeleccionados.filter(
      (actividadId) => actividadId !== id,
    );
    this.actividadDeclaracionForm.get('actividadesCiiu')?.setValue(restantes);

    const principal = this.actividadDeclaracionForm.get(
      'actividadCiiuPrincipalId',
    )?.value;
    if (principal === id) {
      this.actividadDeclaracionForm
        .get('actividadCiiuPrincipalId')
        ?.setValue(restantes[0] ?? null);
    }

    this.anuncioCiiu = `Actividad CIIU ${this.codigoActividad(id)} retirada.`;
  }

  reintentar(): void {
    this.reintentarCiiu.emit();
  }

  private get idsSeleccionados(): number[] {
    const valor = this.actividadDeclaracionForm.get('actividadesCiiu')?.value;
    return Array.isArray(valor)
      ? valor.filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id),
        )
      : [];
  }

  private codigoActividad(id: number): string {
    return (
      this.catalogoCiiu.find((actividad) => actividad.id === id)?.codigo
      ?? String(id)
    );
  }
}
