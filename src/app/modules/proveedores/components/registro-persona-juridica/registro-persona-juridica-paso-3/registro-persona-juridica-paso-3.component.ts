import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';

/** Tamaño máximo por soporte, alineado con el mockup (25 MB). */
const TAMANO_MAXIMO_PDF = 25 * 1024 * 1024;

@Component({
  selector: 'registro-persona-juridica-paso-3',
  templateUrl: './registro-persona-juridica-paso-3.component.html',
  styleUrls: ['./registro-persona-juridica-paso-3.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso3Component {
  @Input() formulario: FormGroup = new FormGroup({});
  @Output() formularioChange = new EventEmitter<FormGroup>();

  /** Errores de carga independientes por soporte. */
  errorRut: string | null = null;
  errorRup: string | null = null;

  get tieneRup(): boolean {
    return this.formulario.get('tieneRup')?.value === true;
  }

  get nombreRut(): string | null {
    return this.archivo('rutArchivo')?.name ?? null;
  }

  get nombreRup(): string | null {
    return this.archivo('rupArchivo')?.name ?? null;
  }

  get tamanoRut(): string | null {
    return this.formatearTamano(this.archivo('rutArchivo')?.size);
  }

  get tamanoRup(): string | null {
    return this.formatearTamano(this.archivo('rupArchivo')?.size);
  }

  get faltaRut(): boolean {
    const campo = this.formulario.get('rutArchivo');
    return !!campo && campo.touched && campo.hasError('required');
  }

  get faltaRup(): boolean {
    const campo = this.formulario.get('rupArchivo');
    return !!campo && campo.touched && campo.hasError('required');
  }

  onRutSeleccionado(evento: Event): void {
    this.seleccionarPdf(evento, 'rutArchivo', 'RUT', 'errorRut');
  }

  onRupSeleccionado(evento: Event): void {
    this.seleccionarPdf(evento, 'rupArchivo', 'certificado RUP', 'errorRup');
  }

  alCambiarRup(activado: boolean): void {
    this.formulario.get('tieneRup')?.setValue(activado);
    const controlRup = this.formulario.get('rupArchivo');
    if (!activado) {
      controlRup?.setValue(null);
      this.errorRup = null;
    }
    controlRup?.updateValueAndValidity();
    this.emitirCambio();
  }

  visualizarRut(): void {
    this.visualizar('rutArchivo');
  }

  visualizarRup(): void {
    this.visualizar('rupArchivo');
  }

  descargarRut(): void {
    this.descargar('rutArchivo');
  }

  descargarRup(): void {
    this.descargar('rupArchivo');
  }

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }

  private seleccionarPdf(
    evento: Event,
    control: string,
    etiqueta: string,
    campoError: 'errorRut' | 'errorRup',
  ): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    // Permite volver a seleccionar el mismo archivo después de reemplazarlo.
    entrada.value = '';

    if (!archivo) {
      return;
    }
    if (archivo.type !== 'application/pdf') {
      this[campoError] = `El ${etiqueta} debe ser un archivo PDF.`;
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PDF) {
      this[campoError] = `El ${etiqueta} no puede superar los 25 MB.`;
      return;
    }

    this[campoError] = null;
    const campo = this.formulario.get(control);
    campo?.setValue(archivo);
    campo?.markAsTouched();
    campo?.updateValueAndValidity();
    this.emitirCambio();
  }

  private visualizar(control: string): void {
    const archivo = this.archivo(control);
    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private descargar(control: string): void {
    const archivo = this.archivo(control);
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

  private archivo(control: string): File | null {
    const valor = this.formulario.get(control)?.value;
    return valor instanceof File ? valor : null;
  }

  private formatearTamano(bytes: number | undefined): string | null {
    if (!bytes) {
      return null;
    }
    const megas = bytes / (1024 * 1024);
    return megas >= 1
      ? `${megas.toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
