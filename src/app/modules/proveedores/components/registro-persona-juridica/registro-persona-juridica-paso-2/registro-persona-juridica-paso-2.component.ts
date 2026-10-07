import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';

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
  @Output() formularioChange = new EventEmitter<FormGroup>();

  get opcionesTipoConstitucion(): OpcionCatalogo[] {
    return this.catalogos?.tipoCapital ?? [];
  }

  opcionesBanco: Opcion<string>[] = [
    { label: '001 - BANCO DE BOGOTÁ', value: 'banco_bogota' },
    { label: '007 - BANCOLOMBIA S.A.', value: 'bancolombia' },
    { label: '051 - BANCO DAVIVIENDA', value: 'davivienda' },
    { label: '013 - BBVA COLOMBIA', value: 'bbva' },
    { label: '023 - BANCO DE OCCIDENTE', value: 'occidente' },
    { label: '002 - BANCO POPULAR', value: 'popular' },
    { label: '040 - BANCO AGRARIO DE COLOMBIA', value: 'agrario' },
  ];

  opcionesTipoCuenta: Opcion<string>[] = [
    { label: 'Cuenta Corriente Empresarial', value: 'corriente' },
    { label: 'Cuenta de Ahorros Empresarial', value: 'ahorros' },
  ];

  opcionesCiudadApertura: Opcion<string>[] = [
    { label: 'Bogotá D.C. (Cundinamarca)', value: 'bogota' },
    { label: 'Medellín (Antioquia)', value: 'medellin' },
    { label: 'Cali (Valle del Cauca)', value: 'cali' },
    { label: 'Barranquilla (Atlántico)', value: 'barranquilla' },
    { label: 'Bucaramanga (Santander)', value: 'bucaramanga' },
  ];

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
