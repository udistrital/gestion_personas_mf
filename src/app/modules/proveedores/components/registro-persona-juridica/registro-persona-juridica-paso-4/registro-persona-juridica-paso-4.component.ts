import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';
import { OpcionUnspsc } from '../services/registro-persona-juridica-unspsc.service';

@Component({
  selector: 'registro-persona-juridica-paso-4',
  templateUrl: './registro-persona-juridica-paso-4.component.html',
  styleUrls: ['./registro-persona-juridica-paso-4.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso4Component {
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Input() cargandoCatalogos = false;
  @Input() errorCatalogos: string | null = null;
  @Input() catalogoUnspsc: OpcionUnspsc[] = [];
  @Input() cargandoUnspsc = false;
  @Input() errorUnspsc: string | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();
  @Output() reintentarUnspsc = new EventEmitter<void>();

  actividadCiiuDisponibleId = new FormControl<number | null>(null);
  unspscDisponibleId = new FormControl<number | null>(null);
  busquedaCiiu = '';
  busquedaUnspsc = '';

  get actividadesCiiu(): OpcionCatalogo[] {
    return this.catalogos?.actividadEconomicaCiiu ?? [];
  }

  get declaraciones(): OpcionCatalogo[] {
    return this.catalogos?.tipoDeclaracion ?? [];
  }

  get actividadesCiiuDisponibles(): OpcionCatalogo[] {
    const texto = this.busquedaCiiu.trim().toLocaleLowerCase();
    const seleccionadas = new Set(this.idsSeleccionados('actividadesCiiu'));
    return this.actividadesCiiu.filter(
      actividad =>
        !seleccionadas.has(actividad.id)
        && (
          texto.length === 0
          || `${actividad.codigo ?? ''} ${actividad.nombre} ${actividad.descripcion ?? ''}`
            .toLocaleLowerCase()
            .includes(texto)
        ),
    );
  }

  get actividadesCiiuSeleccionadas(): OpcionCatalogo[] {
    const ids = this.idsSeleccionados('actividadesCiiu');
    return ids
      .map(id => this.actividadesCiiu.find(actividad => actividad.id === id))
      .filter((actividad): actividad is OpcionCatalogo => actividad !== undefined);
  }

  get unspscDisponibles(): OpcionUnspsc[] {
    return this.unspscCoincidentesDisponibles.slice(0, 100);
  }

  get unspscCoincidentesDisponibles(): OpcionUnspsc[] {
    const texto = this.busquedaUnspsc.trim().toLocaleLowerCase();
    const seleccionadas = new Set(this.idsSeleccionados('unspscSeleccionados'));
    return this.unspscCoincidentes.filter(opcion => !seleccionadas.has(opcion.id));
  }

  get unspscCoincidentes(): OpcionUnspsc[] {
    const texto = this.busquedaUnspsc.trim().toLocaleLowerCase();
    return this.catalogoUnspsc.filter(
      opcion =>
        `${opcion.codigo} ${opcion.titulo}`.toLocaleLowerCase().includes(texto),
    );
  }

  get hayMasResultadosUnspsc(): boolean {
    return this.unspscCoincidentesDisponibles.length > this.unspscDisponibles.length;
  }

  get unspscSeleccionados(): OpcionUnspsc[] {
    const ids = this.idsSeleccionados('unspscSeleccionados');
    return ids
      .map(id => this.catalogoUnspsc.find(opcion => opcion.id === id))
      .filter((opcion): opcion is OpcionUnspsc => opcion !== undefined);
  }

  get cantidadCaracteres(): number {
    return String(this.formulario.get('descripcionServicios')?.value ?? '').length;
  }

  agregarActividadCiiu(): void {
    const id = this.actividadCiiuDisponibleId.value;
    if (id === null || this.idsSeleccionados('actividadesCiiu').includes(id)) {
      return;
    }
    this.formulario.get('actividadesCiiu')?.setValue([
      ...this.idsSeleccionados('actividadesCiiu'),
      id,
    ]);
    this.actividadCiiuDisponibleId.setValue(null);
    this.emitirCambio();
  }

  quitarActividadCiiu(id: number): void {
    this.formulario.get('actividadesCiiu')?.setValue(
      this.idsSeleccionados('actividadesCiiu').filter(actividadId => actividadId !== id),
    );
    this.emitirCambio();
  }

  agregarUnspsc(): void {
    const id = this.unspscDisponibleId.value;
    if (id === null || this.idsSeleccionados('unspscSeleccionados').includes(id)) {
      return;
    }
    this.formulario.get('unspscSeleccionados')?.setValue([
      ...this.idsSeleccionados('unspscSeleccionados'),
      id,
    ]);
    this.unspscDisponibleId.setValue(null);
    this.emitirCambio();
  }

  quitarUnspsc(id: number): void {
    this.formulario.get('unspscSeleccionados')?.setValue(
      this.idsSeleccionados('unspscSeleccionados').filter(codigoId => codigoId !== id),
    );
    this.emitirCambio();
  }

  estaDeclaracionSeleccionada(id: number): boolean {
    return this.formulario.get('declaraciones')?.value?.includes(id) ?? false;
  }

  cambiarDeclaracion(id: number, seleccionada: boolean): void {
    const declaraciones = this.idsSeleccionados('declaraciones');
    const actualizadas = seleccionada
      ? [...declaraciones, id]
      : declaraciones.filter((declaracionId: number) => declaracionId !== id);

    this.formulario.get('declaraciones')?.setValue([...new Set(actualizadas)]);
    this.emitirCambio();
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }

  private idsSeleccionados(controlName: string): number[] {
    const valor: unknown = this.formulario.get(controlName)?.value;
    return Array.isArray(valor)
      ? valor.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
      : [];
  }
}
