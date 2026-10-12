import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';
import {
  CatalogosUbicacionesPersonaJuridica,
  OpcionLugar,
} from '../services/registro-persona-juridica-ubicaciones.service';

interface Opcion<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'registro-persona-juridica-paso-2',
  templateUrl: './registro-persona-juridica-paso-2.component.html',
  styleUrls: ['./registro-persona-juridica-paso-2.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso2Component {
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Input() ubicaciones: CatalogosUbicacionesPersonaJuridica | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();

  get opcionesTipoConstitucion(): OpcionCatalogo[] {
    return this.catalogos?.tipoCapital ?? [];
  }

  get opcionesBanco(): OpcionCatalogo[] {
    return this.catalogos?.entidadesBancarias ?? [];
  }

  get opcionesTipoCuenta(): OpcionCatalogo[] {
    return this.catalogos?.tiposCuentaBancaria ?? [];
  }

  get opcionesCiudadApertura(): OpcionLugar[] {
    return this.ubicaciones?.ciudades ?? [];
  }

  opcionesSiNo: Opcion<string>[] = [
    { label: 'Sí', value: 'si' },
    { label: 'No', value: 'no' },
  ];

  umbralMinimo = 1.50;

  get indicadorLiquidez(): string {
    // TODO: Mock
    const activos = Number(this.formulario.get('activosTotales')?.value ?? 0);
    const pasivos = Number(this.formulario.get('pasivosTotales')?.value ?? 0);
    return pasivos > 0 ? (activos / pasivos).toFixed(2) : '0.00';
  }

  get cumpleIndicadorLiquidez(): boolean {
    return Number(this.indicadorLiquidez) > this.umbralMinimo;
  }

  darFormatoDinero(number: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(number);
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
