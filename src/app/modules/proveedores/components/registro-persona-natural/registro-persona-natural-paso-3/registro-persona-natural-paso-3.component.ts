import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-registro-persona-natural-paso-3',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
  ],
  templateUrl: './registro-persona-natural-paso-3.component.html',
  styleUrl: './registro-persona-natural-paso-3.component.scss',
})
export class RegistroPersonaNaturalPaso3Component {
  @Input({ required: true })
  documentosForm!: FormGroup;

  @Output()
  estadoCambio = new EventEmitter<{
    mensaje: string;
    detalle: string;
  }>();

  @Output()
  solicitarPersistencia = new EventEmitter<boolean>();

  onRutArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (!archivo) {
      return;
    }

    if (!this.esPdfValido(archivo)) {
      this.emitirEstado(
        "Archivo no válido",
        "El RUT debe cargarse en formato PDF.",
      );
      input.value = "";
      return;
    }

    this.documentosForm.patchValue({
      rutArchivo: archivo,
    });

    this.emitirEstado(
      'RUT cargado',
      `Se cargó correctamente el archivo "${archivo.name}".`,
    );

    this.solicitarPersistencia.emit(true);
  }

  private esPdfValido(archivo: File): boolean {
    return archivo.type === "application/pdf";
  }

  visualizarRut(): void {
    const archivo = this.documentosForm.get("rutArchivo")?.value as File | null;

    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, "_blank", "noopener,noreferrer");

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  descargarRut(): void {
    const archivo = this.documentosForm.get("rutArchivo")?.value as File | null;

    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();

    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  alternarAplicaRup(): void {
    const valorActual = this.documentosForm.get('aplicaRup')?.value;

    const nuevoValor = valorActual === 'si' ? 'no' : 'si';

    this.documentosForm.patchValue({
      aplicaRup: nuevoValor,
    });

    if (nuevoValor === 'no') {
      this.documentosForm.patchValue({
        certificadoRup: null,
      });
    }

    this.solicitarPersistencia.emit(true);
  }

  onCertificadoRupSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (!archivo) {
      return;
    }

    if (!this.esPdfValido(archivo)) {
      this.emitirEstado(
        "Archivo no válido",
        "El certificado RUP debe cargarse en formato PDF.",
      );
      input.value = "";
      return;
    }

    this.documentosForm.patchValue({
      certificadoRup: archivo,
    });

    this.emitirEstado(
      'Certificado RUP cargado',
      `Se cargó correctamente el archivo "${archivo.name}".`,
    );

    this.solicitarPersistencia.emit(true);
  }

  visualizarRup(): void {
    const archivo =
      this.documentosForm.get("certificadoRup")?.value as File | null;

    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, "_blank", "noopener,noreferrer");

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private emitirEstado(mensaje: string, detalle: string): void {
    this.estadoCambio.emit({
      mensaje,
      detalle,
    });
  }
}
