import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, Validators } from '@angular/forms';
import { CatalogosPersonaJuridica } from '../services/registro-persona-juridica-catalogos.service';

interface DocumentoSoporte {
  control: string;
  icono: string;
  codigoTipoDocumento: string;
  descripcion: string;
  accion: string;
}

@Component({
  selector: 'registro-persona-juridica-paso-3',
  templateUrl: './registro-persona-juridica-paso-3.component.html',
  styleUrls: ['./registro-persona-juridica-paso-3.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso3Component implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();
  readonly erroresCarga: Record<string, string> = {};

  documentosExistencia: DocumentoSoporte[] = [
    {
      control: 'rutArchivo',
      icono: 'picture_as_pdf',
      codigoTipoDocumento: 'RUT',
      descripcion: 'Documento vigente validado contra la DIAN.',
      accion: 'Reemplazar',
    },
    {
      control: 'certificadoExistenciaArchivo',
      icono: 'description',
      codigoTipoDocumento: 'CERTIFICADO_EXISTENCIA',
      descripcion: 'Expedido por Cámara de Comercio o RUES.',
      accion: 'Actualizar',
    },
    {
      control: 'cedulaRepresentanteArchivo',
      icono: 'badge',
      codigoTipoDocumento: 'CEDULA_REPRESENTANTE',
      descripcion: 'Documento de identidad del representante vigente.',
      accion: 'Reemplazar',
    },
  ];

  soportesParafiscales: DocumentoSoporte[] = [
    {
      control: 'certificadoParafiscales',
      icono: 'description',
      codigoTipoDocumento: 'CERTIFICACION_APORTES',
      descripcion: 'Soporte firmado por Revisor Fiscal.',
      accion: 'Ver certificación',
    },
  ];

  ngOnInit(): void {
    this.sincronizarValidadoresRup(this.formulario.get('tieneRup')?.value);
    this.formulario.get('tieneRup')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(valor => this.sincronizarValidadoresRup(valor));
  }

  nombreTipoDocumento(codigo: string): string {
    return this.catalogos?.tipoDocumento.find(documento => documento.codigo === codigo)?.nombre ?? '';
  }

  tieneRupVigente(): boolean {
    return this.formulario.get('tieneRup')?.value === true;
  }

  actualizarEstadoRup(valor: boolean | null): void {
    this.formulario.get('tieneRup')?.setValue(valor);
    this.sincronizarValidadoresRup(valor);
    this.formularioChange.emit(this.formulario);
  }

  private sincronizarValidadoresRup(valor: unknown): void {
    const controles = ['rupArchivo', 'vigenciaRup'];
    for (const nombre of controles) {
      const control = this.formulario.get(nombre);
      if (!control) {
        continue;
      }
      if (valor === true) {
        control.setValidators([Validators.required]);
      } else {
        control.clearValidators();
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  nombreArchivo(controlName: string): string {
    const archivo = this.formulario.get(controlName)?.value;
    return typeof File !== 'undefined' && archivo instanceof File
      ? archivo.name
      : 'Ningún archivo seleccionado';
  }

  seleccionarDocumento(controlName: string, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    if (!archivo) {
      return;
    }

    if (archivo.type !== 'application/pdf') {
      this.erroresCarga[controlName] = 'Seleccione un archivo PDF válido.';
      input.value = '';
      return;
    }

    const control = this.formulario.get(controlName);
    if (!control) {
      this.erroresCarga[controlName] = 'No se encontró el campo del documento.';
      input.value = '';
      return;
    }

    control.setValue(archivo);
    control.markAsTouched();
    control.updateValueAndValidity();
    delete this.erroresCarga[controlName];
    input.value = '';
    this.formularioChange.emit(this.formulario);
  }

  visualizarDocumento(controlName: string): void {
    const archivo = this.archivo(controlName);
    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  descargarDocumento(controlName: string): void {
    const archivo = this.archivo(controlName);
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

  private archivo(controlName: string): File | null {
    const value: unknown = this.formulario.get(controlName)?.value;
    return typeof File !== 'undefined' && value instanceof File ? value : null;
  }

  readonly opcionesSiNo = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
