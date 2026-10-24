import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';
import {
  OpcionLugar,
} from '../services/registro-persona-juridica-ubicaciones.service';

@Component({
  selector: 'registro-persona-juridica-paso-2',
  templateUrl: './registro-persona-juridica-paso-2.component.html',
  styleUrls: ['./registro-persona-juridica-paso-2.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso2Component {
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
  errorCertificacionBancaria: string | null = null;

  get opcionesTipoConstitucion(): OpcionCatalogo[] {
    return this.catalogos?.tipoCapital ?? [];
  }

  get opcionesBanco(): OpcionCatalogo[] {
    return this.catalogos?.entidadesBancarias ?? [];
  }

  get opcionesTipoCuenta(): OpcionCatalogo[] {
    return this.catalogos?.tiposCuentaBancaria ?? [];
  }

  readonly opcionesSiNo = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
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

  nombreCertificacionBancaria(): string {
    const archivo = this.archivoCertificacionBancaria();
    return archivo?.name ?? 'Ningún archivo seleccionado';
  }

  seleccionarCertificacionBancaria(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    if (!archivo) {
      return;
    }

    if (archivo.type !== 'application/pdf') {
      this.errorCertificacionBancaria = 'Seleccione un archivo PDF válido.';
      input.value = '';
      return;
    }

    const control = this.formulario.get('certificacionBancaria');
    if (!control) {
      this.errorCertificacionBancaria =
        'No se encontró el campo de certificación bancaria.';
      input.value = '';
      return;
    }

    control.setValue(archivo);
    control.markAsTouched();
    control.updateValueAndValidity();
    this.errorCertificacionBancaria = null;
    input.value = '';
    this.emitirCambio();
  }

  visualizarCertificacionBancaria(): void {
    const archivo = this.archivoCertificacionBancaria();
    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  descargarCertificacionBancaria(): void {
    const archivo = this.archivoCertificacionBancaria();
    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  private archivoCertificacionBancaria(): File | null {
    const value: unknown = this.formulario.get('certificacionBancaria')?.value;
    return typeof File !== 'undefined' && value instanceof File ? value : null;
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
