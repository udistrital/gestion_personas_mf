import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';

@Component({
  selector: 'registro-persona-juridica-paso-4',
  templateUrl: './registro-persona-juridica-paso-4.component.html',
  styleUrls: ['./registro-persona-juridica-paso-4.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso4Component {
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();

  get actividadesCiiu(): OpcionCatalogo[] {
    return this.catalogos?.actividadEconomicaCiiu ?? [];
  }

  get declaraciones(): OpcionCatalogo[] {
    return this.catalogos?.tipoDeclaracion ?? [];
  }

  get cantidadCaracteres(): number {
    return String(this.formulario.get('descripcionServicios')?.value ?? '').length;
  }

  estaActividadSeleccionada(id: number): boolean {
    return this.formulario.get('actividadesCiiu')?.value?.includes(id) ?? false;
  }

  cambiarActividad(id: number, seleccionada: boolean): void {
    const actividades: number[] = this.formulario.get('actividadesCiiu')?.value ?? [];
    const actualizadas = seleccionada
      ? [...actividades, id]
      : actividades.filter((actividadId: number) => actividadId !== id);

    this.formulario.get('actividadesCiiu')?.setValue([...new Set(actualizadas)]);
    this.emitirCambio();
  }

  estaDeclaracionSeleccionada(id: number): boolean {
    return this.formulario.get('declaraciones')?.value?.includes(id) ?? false;
  }

  cambiarDeclaracion(id: number, seleccionada: boolean): void {
    const declaraciones: number[] = this.formulario.get('declaraciones')?.value ?? [];
    const actualizadas = seleccionada
      ? [...declaraciones, id]
      : declaraciones.filter((declaracionId: number) => declaracionId !== id);

    this.formulario.get('declaraciones')?.setValue([...new Set(actualizadas)]);
    this.emitirCambio();
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
