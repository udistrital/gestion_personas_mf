import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { PasoStepperVisual } from "src/app/shared/components/stepper-visual/stepper-visual.component";
import { camposPorPaso } from "./registro-persona-juridica.component.utils";
import { PersonaJuridicaCatalogosPayload } from "./models/registro-persona-juridica-payload.model";
import {
  CatalogosPersonaJuridica,
  RegistroPersonaJuridicaCatalogosService,
} from "./services/registro-persona-juridica-catalogos.service";
import {
  CatalogosUbicacionesPersonaJuridica,
  RegistroPersonaJuridicaUbicacionesService,
} from "./services/registro-persona-juridica-ubicaciones.service";

const SOLO_DIGITOS = /^\d+$/;
const NIT = /^\d{9}$/;
const DIGITO_VERIFICACION = /^\d$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?\d[\d\s().-]*(?:Ext\.\s*\d+)?$/;
const URL_HTTP = /^https?:\/\/[^\s]+$/;
const CUENTA_BANCARIA = /^\d{8,20}$/;
const ARCHIVO_PDF = /^[\wáéíóúüñ(). -]+\.pdf$/i;
const OTP = /^\d{6}$/;

@Component({
  selector: "app-registro-persona-juridica",
  templateUrl: "./registro-persona-juridica.component.html",
  styleUrls: ["./registro-persona-juridica.component.scss"],
  standalone: false,
})
export class RegistroPersonaJuridicaComponent implements OnInit {
  titulo = "Módulo de Registro de Persona Jurídica";
  pasoActual = 1;
  payloadCatalogos?: PersonaJuridicaCatalogosPayload;
  catalogos: CatalogosPersonaJuridica | null = null;
  catalogosUbicaciones: CatalogosUbicacionesPersonaJuridica | null = null;

  constructor(
    private readonly catalogosService: RegistroPersonaJuridicaCatalogosService,
    private readonly ubicacionesService: RegistroPersonaJuridicaUbicacionesService,
  ) {}

  ngOnInit(): void {
    this.catalogosService.obtenerCatalogos().subscribe({
      next: catalogos => this.catalogos = catalogos,
      error: error => console.error('No fue posible cargar los catálogos de Persona Jurídica.', error),
    });
    this.ubicacionesService.obtenerCatalogos().subscribe({
      next: catalogos => this.catalogosUbicaciones = catalogos,
      error: error => console.error('No fue posible cargar las ubicaciones de Persona Jurídica.', error),
    });

    // TODO: Bloque temporal para pruebas de desarrollo. Eliminar al implementar lógica del negocio.
    for (const controlName in this.formulario.controls) {
      this.formulario.get(controlName)?.valueChanges.subscribe(value => {
        console.log(`Valor del control ${controlName} cambiado a:`, value);
      });
    }
  }

  constructor(private readonly router: Router) {}

  regresarARegistroInicial(): void {
    void this.router.navigateByUrl("/proveedores/registro-inicio-persona");
  }

  pasos: PasoStepperVisual[] = [
    { numero: 1, icono: "person", nombre: "Datos Societarios y Representación" },
    { numero: 2, icono: "account_balance", nombre: "Información Financiera" },
    { numero: 3, icono: "description", nombre: "Documentos, RUES y RUP" },
    { numero: 4, icono: "assignment", nombre: "Actividad y Declaración" },
  ];

  finalizar() {
    if (!this.validarFormulario() || this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      console.error('No se genera el payload de Persona Jurídica porque el formulario contiene campos inválidos.');
      return;
    }
    this.payloadCatalogos = this.construirPayloadCatalogos();
    alert("Se ha presionado el botón Finalizar. Se puede redirigir a otra página o mostrar un mensaje de éxito.");
  }

  construirPayloadCatalogos(): PersonaJuridicaCatalogosPayload {
    const idsResponsabilidades = this.obtenerIds('responsabilidades');
    const idsActividades = this.obtenerIds('actividadesCiiu');
    const idsDeclaraciones = this.obtenerIds('declaraciones');

    return {
      procedencia_id: this.obtenerId('procedencia'),
      tipo_organizacion_id: this.obtenerId('tipoOrganizacion'),
      tamano_empresa_id: this.obtenerId('tamanoEmpresarial'),
      tipo_capital_id: this.obtenerId('tipoConstitucion'),
      camara_comercio_id: this.obtenerId('camaraComercio'),
      responsabilidad_fiscal_perfil: idsResponsabilidades.map(id => ({
        responsabilidad_fiscal_id: id,
      })),
      actividad_economica_proveedor: idsActividades.map(id => ({
        actividad_economica_id: id,
      })),
      representacion: { cargo_id: this.obtenerId('cargoRepresentante') },
      declaracion: idsDeclaraciones.map(id => ({ tipo_declaracion_id: id })),
    };
  }

  continuar(): void {
    if (this.validarFormulario()) {
      this.pasoActual += 1;
    }
  }

  private validarFormulario(): boolean {
    const nombresControles = camposPorPaso[this.pasoActual] ?? [];
    const camposConError = nombresControles
      .filter(controlName => this.formulario.get(controlName)?.invalid);

    if (camposConError.length === 0) {
      return true;
    }

    camposConError.forEach(controlName => this.formulario.get(controlName)?.markAsTouched());
    alert(`Hay campos con error: ${camposConError.join(', ')}.`);
    return false;
  }

  private obtenerId(controlName: string): number {
    const valor: unknown = this.formulario.get(controlName)?.value;
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      throw new Error(`El control paramétrico "${controlName}" no contiene un ID válido.`);
    }
    return valor;
  }

  private obtenerIds(controlName: string): number[] {
    const valor: unknown = this.formulario.get(controlName)?.value;
    if (!Array.isArray(valor) || !valor.every(id => typeof id === 'number' && Number.isInteger(id))) {
      throw new Error(`El control paramétrico "${controlName}" no contiene una lista válida de IDs.`);
    }
    return valor;
  }

  formulario: FormGroup = new FormGroup({
    nit: new FormControl('900845120', [Validators.required, Validators.pattern(NIT)]),
    digitoVerificacion: new FormControl('3', Validators.pattern(DIGITO_VERIFICACION)),
    nitConfirmacion: new FormControl('900845120', [Validators.required, Validators.pattern(NIT)]),
    procedencia: new FormControl<number | null>(null, Validators.required),
    razonSocial: new FormControl('SOLUCIONES TECNOLÓGICAS E INTEGRACIONES S.A.S.', Validators.required),
    nombreComercial: new FormControl('INTEGRATECH S.A.S.'),
    matriculaMercantil: new FormControl('03148920', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    camaraComercio: new FormControl<number | null>(null, Validators.required),
    fechaConstitucion: new FormControl('2016-04-14', Validators.required),
    fechaRenovacion: new FormControl('2025-02-18', Validators.required),
    tipoOrganizacion: new FormControl<number | null>(null, Validators.required),
    tamanoEmpresarial: new FormControl<number | null>(null, Validators.required),
    documentoRepresentante: new FormControl('80234567', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    cargoRepresentante: new FormControl<number | null>(null, Validators.required),
    primerApellido: new FormControl('RODRÍGUEZ', Validators.required),
    segundoApellido: new FormControl('PATIÑO'),
    primerNombre: new FormControl('CARLOS', Validators.required),
    segundoNombre: new FormControl('EDUARDO'),
    correoRepresentante: new FormControl('gerencia@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    telefonoRepresentante: new FormControl('+57 310 456 7890', [Validators.required, Validators.pattern(TELEFONO)]),
    limitacionEstatutaria: new FormControl(false, Validators.required),
    registrarSuplente: new FormControl(false),
    beneficiariosFinales: new FormControl(false, Validators.required),
    cotizaBolsa: new FormControl(false, Validators.required),
    revisorFiscal: new FormControl(true, Validators.required),
    granContribuyente: new FormControl(false, Validators.required),
    autorretenedor: new FormControl(false, Validators.required),
    exencionIca: new FormControl(false, Validators.required),
    responsabilidades: new FormControl<number[]>([], Validators.required),
    departamento: new FormControl<number | null>(null, Validators.required),
    ciudad: new FormControl<number | null>(null, Validators.required),
    tipoVia: new FormControl('cr', Validators.required),
    detalleVia: new FormControl('68', Validators.required),
    numeroCruce: new FormControl('45', Validators.required),
    placaPuerta: new FormControl('20', Validators.required),
    interiorTipo: new FormControl('of'),
    detalleInterior: new FormControl('502'),
    correoNotificaciones: new FormControl('notificaciones@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    correoNotificacionesConfirmacion: new FormControl('notificaciones@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    telefonoFijo: new FormControl('+57 (601) 745 8900', [Validators.required, Validators.pattern(TELEFONO)]),
    extension: new FormControl('104', Validators.pattern(SOLO_DIGITOS)),
    telefonoAlterno: new FormControl('3158890012', [Validators.required, Validators.pattern(TELEFONO)]),
    sitioWeb: new FormControl('https://www.integratech.com.co', Validators.pattern(URL_HTTP)),
    contactoComercial: new FormControl('MARCELA GÓMEZ RINCÓN'),
    telefonoAsesor: new FormControl('3186749920', Validators.pattern(TELEFONO)),
    aceptaTerminos: new FormControl(false),
    tipoConstitucion: new FormControl<number | null>(null, Validators.required),
    capitalAutorizado: new FormControl('500000000', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    capitalSuscritoPagado: new FormControl('350000000', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    activosTotales: new FormControl('1240850000', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    pasivosTotales: new FormControl('385200000', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    banco: new FormControl('banco_bogota', Validators.required),
    tipoCuenta: new FormControl('corriente', Validators.required),
    ciudadApertura: new FormControl<number | null>(null, Validators.required),
    numeroCuenta: new FormControl('21004598210', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    numeroCuentaConfirmacion: new FormControl('21004598210', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    titularCuenta: new FormControl('SOLUCIONES TECNOLÓGICAS E INTEGRACIONES S.A.S.'),
    correoPagos: new FormControl('pagos@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    correoPagosConfirmacion: new FormControl('pagos@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    responsableTesoreria: new FormControl('Diana Marcela Mendoza Castro', Validators.required),
    telefonoTesoreria: new FormControl('+57 (601) 745 8900 Ext. 105', [Validators.required, Validators.pattern(TELEFONO)]),
    obligadoFacturar: new FormControl('si', Validators.required),
    prefijoFacturacion: new FormControl('SETT - 001 hasta 50000'),
    resolucionDian: new FormControl('18764039201934 del 14/01/2024'),
    monedaExtranjera: new FormControl('no'),
    certificacionBancaria: new FormControl('Certificacion_Bancaria_BancoBogota_2025.pdf', Validators.pattern(ARCHIVO_PDF)),
    rutArchivo: new FormControl('RUT_Integratech_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    certificadoExistenciaArchivo: new FormControl('Certificado_CCB_Integratech_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    cedulaRepresentanteArchivo: new FormControl('Cedula_Representante_Legal.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    tieneRup: new FormControl(true),
    rupArchivo: new FormControl('Certificado_RUP_Vigente_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    vigenciaRup: new FormControl('2025-12-31', Validators.required),
    certificadoParafiscales: new FormControl('Cert_Parafiscales_Feb2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    aportesSeguridadSocial: new FormControl(true, Validators.requiredTrue),
    actividadesCiiu: new FormControl<number[]>([], Validators.required),
    descripcionServicios: new FormControl('Soluciones de infraestructura tecnológica de misión crítica, desarrollo de arquitecturas cloud, ciberseguridad aplicada, soporte integral de hardware institucional y licenciamiento corporativo para entidades de educación superior pública y sectores gubernamentales del Distrito Capital.', Validators.required),
    declaraciones: new FormControl<number[]>([], Validators.required),
    tokenOtp: new FormControl('482913', [Validators.required, Validators.pattern(OTP)]),
    aceptaTratamiento: new FormControl(true, Validators.requiredTrue)
  });

}
