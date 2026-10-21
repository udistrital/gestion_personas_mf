import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
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
export class RegistroPersonaJuridicaPaso3Component {
  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();

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

  nombreTipoDocumento(codigo: string): string {
    return this.catalogos?.tipoDocumento.find(documento => documento.codigo === codigo)?.nombre ?? '';
  }

  tieneRupVigente(): boolean {
    return this.formulario.get('tieneRup')?.value === true;
  }

  actualizarEstadoRup(valor: boolean | null): void {
    this.formulario.get('tieneRup')?.setValue(valor);
    this.formularioChange.emit(this.formulario);
  }

  readonly opcionesSiNo = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  emitirCambio(): void {
    this.formularioChange.emit(this.formulario);
  }
}
