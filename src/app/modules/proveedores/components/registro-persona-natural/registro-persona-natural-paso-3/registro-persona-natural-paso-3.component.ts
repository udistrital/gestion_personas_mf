import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ReactiveFormsModule, FormGroup } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { SharedModule } from "src/app/shared/shared.module";

/**
 * Paso 3: soportes documentales (declaración de renta, RUT y RUP).
 *
 * La pregunta "¿Declarante de Renta?" no se duplica aquí: se recibe del paso 1
 * y solo se informa. La obligatoriedad del adjunto la sincroniza el asistente
 * con `tributario.declaranteRenta`.
 */
@Component({
  selector: "app-registro-persona-natural-paso-3",
  templateUrl: "./registro-persona-natural-paso-3.component.html",
  styleUrls: ["./registro-persona-natural-paso-3.component.scss"],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, SharedModule],
})
export class RegistroPersonaNaturalPaso3Component {
  @Input({ required: true })
  documentosForm!: FormGroup;

  /** Valor del paso 1: true si la persona declara renta. */
  @Input() declaranteRenta: boolean | null = null;

  @Output()
  estadoCambio = new EventEmitter<{
    mensaje: string;
    detalle: string;
  }>();

  @Output()
  solicitarPersistencia = new EventEmitter<boolean>();

  /** Pide volver al paso 1 para corregir la condición de declarante. */
  @Output()
  editarDeclaranteRenta = new EventEmitter<void>();

  /** true si el RUP está activo (el control conserva el contrato "si"/"no"). */
  get aplicaRup(): boolean {
    return this.documentosForm.get("aplicaRup")?.value === "si";
  }

  // ── Declaración de renta ────────────────────────────────────────────────

  onDeclaracionRentaSeleccionada(evento: Event): void {
    this.seleccionarPdf(
      evento,
      "declaracionRentaArchivo",
      "Declaración de renta",
    );
  }

  visualizarDeclaracionRenta(): void {
    this.visualizar("declaracionRentaArchivo");
  }

  // ── RUT ─────────────────────────────────────────────────────────────────

  onRutArchivoSeleccionado(evento: Event): void {
    this.seleccionarPdf(evento, "rutArchivo", "RUT");
  }

  visualizarRut(): void {
    this.visualizar("rutArchivo");
  }

  descargarRut(): void {
    this.descargar("rutArchivo");
  }

  // ── RUP ─────────────────────────────────────────────────────────────────

  onCertificadoRupSeleccionado(evento: Event): void {
    this.seleccionarPdf(evento, "certificadoRup", "certificado RUP");
  }

  visualizarRup(): void {
    this.visualizar("certificadoRup");
  }

  alternarAplicaRup(activado: boolean): void {
    this.documentosForm.patchValue({
      aplicaRup: activado ? "si" : "no",
    });

    if (!activado) {
      this.documentosForm.patchValue({ certificadoRup: null });
    }

    this.solicitarPersistencia.emit(true);
  }

  // ── Utilidades de archivos ──────────────────────────────────────────────

  private seleccionarPdf(evento: Event, control: string, nombre: string): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    if (!archivo) {
      return;
    }

    if (!this.esPdfValido(archivo)) {
      this.emitirEstado(
        "Archivo no válido",
        `El ${nombre} debe cargarse en formato PDF.`,
      );
      input.value = "";
      return;
    }

    const campo = this.documentosForm.get(control);
    campo?.setValue(archivo);
    campo?.markAsTouched();
    campo?.updateValueAndValidity();

    this.emitirEstado(
      `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} cargado`,
      `Se cargó correctamente el archivo "${archivo.name}".`,
    );

    this.solicitarPersistencia.emit(true);
  }

  private visualizar(control: string): void {
    const archivo = this.documentosForm.get(control)?.value as File | null;
    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private descargar(control: string): void {
    const archivo = this.documentosForm.get(control)?.value as File | null;
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

  private esPdfValido(archivo: File): boolean {
    return archivo.type === "application/pdf";
  }

  private emitirEstado(mensaje: string, detalle: string): void {
    this.estadoCambio.emit({ mensaje, detalle });
  }

  /** true cuando el adjunto de renta es obligatorio y está vacío. */
  get faltaDeclaracionRenta(): boolean {
    const campo = this.documentosForm.get("declaracionRentaArchivo");
    return (
      this.declaranteRenta === true &&
      !!campo?.touched &&
      !!campo?.hasError("required")
    );
  }

  /** true cuando el RUT es obligatorio y está vacío. */
  get faltaRut(): boolean {
    const campo = this.documentosForm.get("rutArchivo");
    return !!campo?.touched && !!campo?.hasError("required");
  }

  get nombreDeclaracionRenta(): string | null {
    return (
      (this.documentosForm.get("declaracionRentaArchivo")?.value as File | null)
        ?.name ?? null
    );
  }

  get nombreRut(): string | null {
    return (
      (this.documentosForm.get("rutArchivo")?.value as File | null)?.name ??
      null
    );
  }

  get nombreRup(): string | null {
    return (
      (this.documentosForm.get("certificadoRup")?.value as File | null)?.name ??
      null
    );
  }
}
