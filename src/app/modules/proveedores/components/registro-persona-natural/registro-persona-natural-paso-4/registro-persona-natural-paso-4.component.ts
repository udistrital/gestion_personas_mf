import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from '../../../../../shared/shared.module';
import { OpcionCatalogo } from '../../registro-persona-juridica/services/registro-persona-juridica-catalogos.service';

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
  @Input() actividadesCiiu: OpcionCatalogo[] = [];
  @Input() cargandoCiiu = false;
  @Input() errorCiiu: string | null = null;
  @Output() reintentarCiiu = new EventEmitter<void>();

  actividadCiiuDisponibleId: number | null = null;
  busquedaCiiu = '';

  get actividadesCiiuDisponibles(): OpcionCatalogo[] {
    const texto = this.busquedaCiiu.trim().toLocaleLowerCase();
    const seleccionadas = new Set(this.idsActividadesSeleccionadas());
    return this.actividadesCiiu.filter(
      (actividad) =>
        !seleccionadas.has(actividad.id) &&
        `${actividad.codigo ?? ''} ${actividad.nombre} ${actividad.descripcion ?? ''}`
          .toLocaleLowerCase()
          .includes(texto),
    );
  }

  get actividadesCiiuSeleccionadas(): OpcionCatalogo[] {
    return this.idsActividadesSeleccionadas()
      .map((id) => this.actividadesCiiu.find((actividad) => actividad.id === id))
      .filter((actividad): actividad is OpcionCatalogo => actividad !== undefined);
  }

  actualizarBusquedaCiiu(event: Event): void {
    this.busquedaCiiu = (event.target as HTMLInputElement).value;
  }

  seleccionarActividadCiiu(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.actividadCiiuDisponibleId = valor ? Number(valor) : null;
  }

  agregarActividadCiiu(): void {
    const id = this.actividadCiiuDisponibleId;
    const seleccionadas = this.idsActividadesSeleccionadas();
    if (id === null || seleccionadas.includes(id)) {
      return;
    }

    const control = this.actividadDeclaracionForm.get('actividadesCiiu');
    control?.setValue([...seleccionadas, id]);
    control?.markAsTouched();
    this.actividadCiiuDisponibleId = null;
  }

  quitarActividadCiiu(id: number): void {
    const control = this.actividadDeclaracionForm.get('actividadesCiiu');
    control?.setValue(
      this.idsActividadesSeleccionadas().filter((actividadId) => actividadId !== id),
    );
    control?.markAsTouched();
  }

  private idsActividadesSeleccionadas(): number[] {
    const value: unknown = this.actividadDeclaracionForm.get('actividadesCiiu')?.value;
    return Array.isArray(value)
      ? value.filter(
          (id): id is number => typeof id === 'number' && Number.isInteger(id),
        )
      : [];
  }
}
