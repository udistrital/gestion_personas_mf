import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';
import {
  OpcionLugar,
} from '../services/registro-persona-juridica-ubicaciones.service';

interface Opcion<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'registro-persona-juridica-paso-1',
  templateUrl: './registro-persona-juridica-paso-1.component.html',
  styleUrls: ['./registro-persona-juridica-paso-1.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso1Component {

  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Input() pais: OpcionLugar | null = null;
  @Input() departamentos: OpcionLugar[] = [];
  @Input() ciudades: OpcionLugar[] = [];
  @Input() cargandoDepartamentos = false;
  @Input() cargandoCiudades = false;
  @Input() errorDepartamentos: string | null = null;
  @Input() errorCiudades: string | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();
  @Output() reintentarDepartamentos = new EventEmitter<void>();
  @Output() reintentarCiudades = new EventEmitter<void>();

  /** Referencia estable para no recrear el arreglo en cada detección de cambios. */
  private readonly sinOpciones: OpcionCatalogo[] = [];

  get opcionesProcedencia(): OpcionCatalogo[] {
    return this.catalogos?.procedencia ?? this.sinOpciones;
  }

  get opcionesCargo(): OpcionCatalogo[] {
    return this.catalogos?.cargo ?? this.sinOpciones;
  }

  get opcionesTipoDocumentoRepresentante(): OpcionCatalogo[] {
    const codigosPermitidos = new Set(['CC', 'CE', 'PAS']);
    return this.catalogos?.tipoDocumento.filter(opcion =>
      codigosPermitidos.has(opcion.codigo?.toUpperCase() ?? ''),
    ) ?? this.sinOpciones;
  }

  get opcionesRegimenContributivo(): OpcionCatalogo[] {
    return this.catalogos?.regimenContributivo ?? this.sinOpciones;
  }

  get opcionesTipoVia(): OpcionCatalogo[] {
    return this.catalogos?.tipoVia ?? this.sinOpciones;
  }

  get opcionesTipoInterior(): OpcionCatalogo[] {
    return this.catalogos?.tipoInterior ?? this.sinOpciones;
  }

  readonly opcionesSiNo: Opcion<boolean>[] = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  /** true cuando los dos NIT coinciden y no están vacíos. */
  get nitConfirmado(): boolean {
    const nit = String(this.formulario.get('nit')?.value ?? '').trim();
    const confirmacion = String(
      this.formulario.get('nitConfirmacion')?.value ?? '',
    ).trim();
    return nit.length > 0 && nit === confirmacion;
  }

  /** true cuando el control es obligatorio, está vacío y fue tocado. */
  errorRequerido(form: FormGroup, control: string): boolean {
    const campo = form.get(control);
    return !!campo && campo.touched && campo.hasError('required');
  }

  /** true cuando el control tocado tiene el error indicado. */
  errorCampo(form: FormGroup, control: string, error: string): boolean {
    const campo = form.get(control);
    return !!campo && campo.touched && campo.hasError(error);
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
