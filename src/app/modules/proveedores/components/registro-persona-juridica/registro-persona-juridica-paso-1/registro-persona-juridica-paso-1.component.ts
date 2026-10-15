import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
} from '../services/registro-persona-juridica-catalogos.service';
import {
  OpcionLugar,
} from '../services/registro-persona-juridica-ubicaciones.service';

interface Opcion<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'registro-persona-juridica-paso-1',
  templateUrl: './registro-persona-juridica-paso-1.component.html',
  styleUrls: ['./registro-persona-juridica-paso-1.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaPaso1Component {

  @Input() formulario: FormGroup = new FormGroup({});
  @Input() catalogos: CatalogosPersonaJuridica | null = null;
  @Input() cargandoCatalogos = false;
  @Input() errorCatalogos: string | null = null;
  @Input() pais: OpcionLugar | null = null;
  @Input() departamentos: OpcionLugar[] = [];
  @Input() ciudades: OpcionLugar[] = [];
  @Input() cargandoDepartamentos = false;
  @Input() cargandoCiudades = false;
  @Input() errorDepartamentos: string | null = null;
  @Input() errorCiudades: string | null = null;
  @Output() formularioChange = new EventEmitter<FormGroup>();
  @Output() reintentarCatalogos = new EventEmitter<void>();
  @Output() reintentarDepartamentos = new EventEmitter<void>();
  @Output() reintentarCiudades = new EventEmitter<void>();

  get opcionesProcedencia(): OpcionCatalogo[] {
    return this.catalogos?.procedencia ?? [];
  }

  get opcionesCamaraComercio(): OpcionCatalogo[] {
    return this.catalogos?.camaraComercio ?? [];
  }

  get opcionesTipoOrganizacion(): OpcionCatalogo[] {
    return this.catalogos?.tipoOrganizacion ?? [];
  }

  get opcionesTamanoEmpresarial(): OpcionCatalogo[] {
    return this.catalogos?.tamanoEmpresa ?? [];
  }

  get opcionesCargo(): OpcionCatalogo[] {
    return this.catalogos?.cargo ?? [];
  }

  get opcionesResponsabilidadesFiscales(): OpcionCatalogo[] {
    return this.catalogos?.responsabilidadFiscal ?? [];
  }

  get opcionesBeneficiariosFinales(): OpcionCatalogo[] {
    return this.catalogos?.beneficiariosFinalesRub ?? [];
  }

  get opcionesCotizaBolsa(): OpcionCatalogo[] {
    return this.catalogos?.cotizaBvc ?? [];
  }

  get opcionesRevisorFiscal(): OpcionCatalogo[] {
    return this.catalogos?.obligacionRevisorFiscal ?? [];
  }

  get opcionesGranContribuyente(): OpcionCatalogo[] {
    return this.catalogos?.granContribuyenteDian ?? [];
  }

  get opcionesAutorretenedor(): OpcionCatalogo[] {
    return this.catalogos?.autorretenedorRenta ?? [];
  }

  get opcionesExencionIca(): OpcionCatalogo[] {
    return this.catalogos?.exencionIcaBogota ?? [];
  }

  opcionesLimitacionEstatutaria: Opcion<boolean>[] = [
    { label: 'No, facultades amplias y suficientes sin límite de cuantía (Estatutos tipo S.A.S.)', value: false },
    { label: 'Sí, requiere autorización previa de Junta Directiva / Asamblea de Accionistas', value: true }
  ];

  opcionesTipoVia: Opcion<string>[] = [
    { label: 'Calle', value: 'cl' },
    { label: 'Carrera', value: 'cr' },
    { label: 'Avenida', value: 'av' },
    { label: 'Transversal', value: 'tv' },
    { label: 'Diagonal', value: 'dg' }
  ];

  opcionesTipoInterior: Opcion<string>[] = [
    { label: 'Oficina', value: 'of' },
    { label: 'Local', value: 'lc' },
    { label: 'Piso', value: 'p' },
    { label: 'Edificio', value: 'ed' }
  ];

  get direccionGenerada(): string {
    const tipoVia = this.formulario.get('tipoVia')?.value ?? '';
    const detalleVia = this.formulario.get('detalleVia')?.value ?? '';
    const numeroCruce = this.formulario.get('numeroCruce')?.value ?? '';
    const placaPuerta = this.formulario.get('placaPuerta')?.value ?? '';
    const interiorTipo = this.formulario.get('interiorTipo')?.value ?? '';
    const detalleInterior = this.formulario.get('detalleInterior')?.value ?? '';
    const via = [tipoVia, detalleVia].filter(Boolean).join(' ').toUpperCase();
    const cruce = [numeroCruce, placaPuerta].filter(Boolean).join(' - ');
    const interior = [interiorTipo, detalleInterior].filter(Boolean).join(' ').toUpperCase();

    return [via, cruce ? `# ${cruce}` : '', interior].filter(Boolean).join(' ');
  }

  cambiarResponsabilidad(valor: number, seleccionado: boolean): void {
    const responsabilidades: number[] = this.formulario.get('responsabilidades')?.value ?? [];
    const actualizadas = seleccionado
      ? [...responsabilidades, valor]
      : responsabilidades.filter((responsabilidad: number) => responsabilidad !== valor);

    this.formulario.get('responsabilidades')?.setValue([...new Set(actualizadas)]);
    this.formularioChange.emit(this.formulario);
  };

}
