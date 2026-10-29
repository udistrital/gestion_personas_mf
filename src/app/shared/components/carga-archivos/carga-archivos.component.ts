import { Component, ElementRef, forwardRef, Input, ViewChild } from "@angular/core";
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from "@angular/forms";

@Component({
  selector: "carga-archivos",
  templateUrl: "./carga-archivos.component.html",
  styleUrls: ["./carga-archivos.component.scss"],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CargaArchivosComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CargaArchivosComponent),
      multi: true,
    },
  ],
})
export class CargaArchivosComponent implements ControlValueAccessor, Validator {
  @Input() etiqueta = "Seleccionar archivo";
  @Input() formatos: readonly string[] = [
    "pdf",
    "xls",
    "xlsx",
    "doc",
    "docx",
  ];
  @Input() tamanoMaxMb = 10;
  @Input() multiple = false;
  @Input() requerido = false;
  @Input() compacto = false;
  @Input() id = "carga-archivos";

  @ViewChild("entradaArchivo")
  private entradaArchivo?: ElementRef<HTMLInputElement>;

  archivos: File[] = [];
  error = "";
  deshabilitado = false;
  arrastrando = false;
  private cambio: (archivos: File[]) => void = () => {};
  private tocado: () => void = () => {};
  private cambioValidador: () => void = () => {};

  get formatosAceptados(): string {
    return this.formatos.map((formato) => `.${formato}`).join(",");
  }

  get etiquetaFormatos(): string {
    return this.formatos.map((formato) => formato.toUpperCase()).join(", ");
  }

  get pesoTotal(): string {
    return this.formatearBytes(
      this.archivos.reduce((total, archivo) => total + archivo.size, 0),
    );
  }

  get tituloCarga(): string {
    if (this.archivos.length > 0) {
      return this.archivos.length === 1
        ? "Archivo cargado"
        : "Archivos cargados";
    }
    return this.compacto
      ? "Adjunte el documento solicitado"
      : "Arrastre su archivo o haga clic para seleccionar";
  }

  writeValue(archivos: File[] | null): void {
    this.archivos = archivos ?? [];
  }

  registerOnChange(fn: (archivos: File[]) => void): void {
    this.cambio = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.tocado = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const archivos = control.value as File[] | null;
    return this.requerido && (!archivos || archivos.length === 0)
      ? { required: true }
      : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.cambioValidador = fn;
  }

  abrirSelector(): void {
    if (!this.deshabilitado) {
      this.entradaArchivo?.nativeElement.click();
    }
  }

  seleccionar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.procesar(Array.from(entrada.files ?? []));
    entrada.value = "";
  }

  alArrastrar(evento: DragEvent): void {
    if (this.deshabilitado) {
      return;
    }
    evento.preventDefault();
    evento.stopPropagation();
    this.arrastrando = true;
  }

  alSalirArrastre(evento: DragEvent): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.arrastrando = false;
  }

  alSoltar(evento: DragEvent): void {
    if (this.deshabilitado) {
      return;
    }
    evento.preventDefault();
    evento.stopPropagation();
    this.arrastrando = false;
    this.procesar(Array.from(evento.dataTransfer?.files ?? []));
  }

  private procesar(elegidos: readonly File[]): void {
    if (elegidos.length === 0) {
      return;
    }
    this.error = "";
    const validos = elegidos.filter((archivo) => {
      const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
      if (!this.formatos.includes(extension)) {
        this.error = `Formato no permitido. Use: ${this.etiquetaFormatos}.`;
        return false;
      }
      if (archivo.size > this.tamanoMaxMb * 1024 * 1024) {
        this.error = `El archivo supera el máximo de ${this.tamanoMaxMb} MB.`;
        return false;
      }
      return true;
    });
    this.archivos = this.multiple
      ? [...this.archivos, ...validos]
      : validos.slice(0, 1);
    this.cambio(this.archivos);
    this.cambioValidador();
    this.tocado();
  }

  eliminar(indice: number): void {
    this.archivos = this.archivos.filter((_, posicion) => posicion !== indice);
    this.cambio(this.archivos);
    this.cambioValidador();
    this.tocado();
  }

  marcarTocado(): void {
    this.tocado();
  }

  tamano(archivo: File): string {
    return this.formatearBytes(archivo.size);
  }

  private formatearBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes === 0) {
      return "0 B";
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
