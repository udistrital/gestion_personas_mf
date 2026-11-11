import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';

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

  /** Referencia estable para no recrear el arreglo en cada detección de cambios. */
  private readonly sinOpciones: OpcionCatalogo[] = [];

  get opcionesBanco(): OpcionCatalogo[] {
    return this.catalogos?.entidadesBancarias ?? this.sinOpciones;
  }

  get opcionesTipoCuenta(): OpcionCatalogo[] {
    return this.catalogos?.tiposCuentaBancaria ?? this.sinOpciones;
  }

  get opcionesTipoConformacion(): OpcionCatalogo[] {
    return this.catalogos?.tipoConformacion ?? this.sinOpciones;
  }

  /** true cuando los dos números de cuenta coinciden y no están vacíos. */
  get coincideCuenta(): boolean {
    const cuenta = String(this.formulario.get('numeroCuenta')?.value ?? '').trim();
    const confirmacion = String(
      this.formulario.get('numeroCuentaConfirmacion')?.value ?? '',
    ).trim();
    return cuenta.length > 0 && cuenta === confirmacion;
  }

  /** true cuando los dos correos de tesorería coinciden y no están vacíos. */
  get correosPagoConfirmados(): boolean {
    const correo = String(this.formulario.get('correoPagos')?.value ?? '')
      .trim()
      .toLocaleLowerCase();
    const confirmacion = String(
      this.formulario.get('correoPagosConfirmacion')?.value ?? '',
    )
      .trim()
      .toLocaleLowerCase();
    return correo.length > 0 && correo === confirmacion;
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
