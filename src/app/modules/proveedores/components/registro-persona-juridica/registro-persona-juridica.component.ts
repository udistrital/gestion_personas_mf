import { Component, DestroyRef, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { asapScheduler, forkJoin, map, observeOn, Subscription } from "rxjs";
import { PasoStepperVisual } from "src/app/shared/components/stepper-visual/stepper-visual.component";
import { camposPorPaso } from "./registro-persona-juridica.component.utils";
import {
  CatalogosPersonaJuridica,
  RegistroPersonaJuridicaCatalogosService,
} from "./services/registro-persona-juridica-catalogos.service";
import {
  CatalogosUbicacionesPersonaJuridica,
  OpcionLugar,
  RegistroPersonaJuridicaUbicacionesService,
} from "./services/registro-persona-juridica-ubicaciones.service";
import {
  OpcionUnspsc,
  RegistroPersonaJuridicaUnspscService,
} from "./services/registro-persona-juridica-unspsc.service";

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
  catalogos: CatalogosPersonaJuridica | null = null;
  cargandoCatalogos = false;
  errorCatalogos: string | null = null;
  catalogosSinRegistros = false;
  catalogoUnspsc: OpcionUnspsc[] = [];
  cargandoUnspsc = false;
  errorUnspsc: string | null = null;
  pais: OpcionLugar | null = null;
  departamentos: OpcionLugar[] = [];
  ciudadesDomicilio: OpcionLugar[] = [];
  ciudadesApertura: OpcionLugar[] = [];
  cargandoDepartamentos = false;
  cargandoCiudadesDomicilio = false;
  cargandoCiudadesApertura = false;
  errorDepartamentos: string | null = null;
  errorCiudadesDomicilio: string | null = null;
  errorCiudadesApertura: string | null = null;
  private solicitudDepartamentos = 0;
  private solicitudCiudadesDomicilio = 0;
  private solicitudCiudadesApertura = 0;
  private suscripcionCatalogos?: Subscription;

  constructor(
    private readonly catalogosService: RegistroPersonaJuridicaCatalogosService,
    private readonly ubicacionesService: RegistroPersonaJuridicaUbicacionesService,
    private readonly unspscService: RegistroPersonaJuridicaUnspscService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarUnspsc();
    this.cargarDepartamentos();
    this.formulario.get('departamento')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.cargarCiudades(id, 'domicilio'));
    this.formulario.get('departamentoApertura')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.cargarCiudades(id, 'apertura'));

  }

  regresarARegistroInicial(): void {
    void this.router.navigateByUrl("/proveedores");
  }

  reintentarCargaDepartamentos(): void {
    this.cargarDepartamentos();
  }

  reintentarCatalogos(): void {
    this.cargarCatalogos();
  }

  reintentarUnspsc(): void {
    this.cargarUnspsc();
  }

  reintentarCiudadesDomicilio(): void {
    this.cargarCiudades(this.formulario.get('departamento')?.value, 'domicilio');
  }

  reintentarCiudadesApertura(): void {
    this.cargarCiudades(this.formulario.get('departamentoApertura')?.value, 'apertura');
  }

  private cargarDepartamentos(): void {
    const solicitud = ++this.solicitudDepartamentos;
    this.cargandoDepartamentos = true;
    this.errorDepartamentos = null;
    this.pais = null;
    this.departamentos = [];

    this.ubicacionesService.obtenerDepartamentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogos: CatalogosUbicacionesPersonaJuridica) => {
          if (solicitud !== this.solicitudDepartamentos) {
            return;
          }
          this.pais = catalogos.pais;
          this.departamentos = catalogos.departamentos;
          this.cargandoDepartamentos = false;
        },
        error: error => {
          if (solicitud !== this.solicitudDepartamentos) {
            return;
          }
          console.error('No fue posible cargar los departamentos de Colombia.', error);
          this.errorDepartamentos = 'No se pudieron cargar los departamentos. Intente nuevamente.';
          this.cargandoDepartamentos = false;
        },
      });
  }

  private cargarCatalogos(): void {
    this.suscripcionCatalogos?.unsubscribe();
    this.cargandoCatalogos = true;
    this.errorCatalogos = null;
    this.catalogosSinRegistros = false;
    this.catalogos = null;
    const aOpcionesCatalogo = map((lugares: { id: number; nombre: string }[]) =>
      lugares.map(lugar => ({ id: lugar.id, nombre: lugar.nombre })),
    );
    this.suscripcionCatalogos = forkJoin({
      catalogos: this.catalogosService.obtenerCatalogos(),
      procedencia: this.ubicacionesService.obtenerProcedencias().pipe(aOpcionesCatalogo),
      tipoVia: this.ubicacionesService.obtenerTiposVia().pipe(aOpcionesCatalogo),
      tipoInterior: this.ubicacionesService.obtenerTiposInterior().pipe(aOpcionesCatalogo),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalogos, procedencia, tipoVia, tipoInterior }) => {
          this.catalogos = { ...catalogos, procedencia, tipoVia, tipoInterior };
          this.catalogosSinRegistros = [
            procedencia,
            tipoVia,
            tipoInterior,
            catalogos.tipoOrganizacion,
            catalogos.tamanoEmpresa,
            catalogos.tipoCapital,
            catalogos.cargo,
            catalogos.camaraComercio,
            catalogos.beneficiariosFinalesRub,
            catalogos.cotizaBvc,
            catalogos.obligacionRevisorFiscal,
            catalogos.granContribuyenteDian,
            catalogos.autorretenedorRenta,
            catalogos.exencionIcaBogota,
            catalogos.entidadesBancarias,
            catalogos.tiposCuentaBancaria,
            catalogos.obligadoFacturar,
            catalogos.monedaExtranjera,
            catalogos.rupVigente,
            catalogos.actividadEconomicaCiiu,
          ].some(opciones => opciones.length === 0);
          this.cargandoCatalogos = false;
        },
        error: error => {
          console.error('No fue posible cargar los catálogos de Persona Jurídica.', error);
          const detalle = error instanceof Error
            ? error.message
            : 'Verifique su conexión e intente nuevamente.';
          this.errorCatalogos = `No se pudieron cargar uno o más catálogos. ${detalle}`;
          this.catalogosSinRegistros = false;
          this.cargandoCatalogos = false;
        },
      });
  }

  private cargarUnspsc(): void {
    this.cargandoUnspsc = true;
    this.errorUnspsc = null;
    this.catalogoUnspsc = [];
    this.unspscService.obtenerCatalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: catalogo => {
          this.catalogoUnspsc = catalogo;
          this.cargandoUnspsc = false;
        },
        error: error => {
          console.error('No fue posible cargar el catálogo UNSPSC de UNGM.', error);
          this.errorUnspsc = 'No se pudo cargar el catálogo UNSPSC. Intente nuevamente.';
          this.cargandoUnspsc = false;
        },
      });
  }

  private cargarCiudades(idDepartamento: unknown, destino: 'domicilio' | 'apertura'): void {
    const solicitud = destino === 'domicilio'
      ? ++this.solicitudCiudadesDomicilio
      : ++this.solicitudCiudadesApertura;
    const controlDepartamento = destino === 'domicilio' ? 'departamento' : 'departamentoApertura';
    const controlCiudad = destino === 'domicilio' ? 'ciudad' : 'ciudadApertura';
    const departamentoControl = this.formulario.get(controlDepartamento);
    const ciudadControl = this.formulario.get(controlCiudad);

    ciudadControl?.setValue(null, { emitEvent: false });
    ciudadControl?.disable({ emitEvent: false });
    if (destino === 'domicilio') {
      this.ciudadesDomicilio = [];
      this.cargandoCiudadesDomicilio = false;
      this.errorCiudadesDomicilio = null;
    } else {
      this.ciudadesApertura = [];
      this.cargandoCiudadesApertura = false;
      this.errorCiudadesApertura = null;
    }

    if (typeof idDepartamento !== 'number' || !Number.isInteger(idDepartamento)) {
      return;
    }
    const departamento = this.departamentos.find(opcion => opcion.id === idDepartamento);
    if (!departamento) {
      return;
    }

    if (destino === 'domicilio') {
      this.cargandoCiudadesDomicilio = true;
    } else {
      this.cargandoCiudadesApertura = true;
    }

    // La caché del servicio reemite de forma síncrona; observeOn evita mutar
    // ciudades durante el mismo ciclo de detección de cambios (NG0100).
    this.ubicacionesService.obtenerCiudades(departamento)
      .pipe(observeOn(asapScheduler), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ciudades => {
          if (
            !this.esSolicitudActual(solicitud, destino)
            || departamentoControl?.value !== departamento.id
          ) {
            return;
          }
          if (destino === 'domicilio') {
            this.ciudadesDomicilio = ciudades;
            this.cargandoCiudadesDomicilio = false;
          } else {
            this.ciudadesApertura = ciudades;
            this.cargandoCiudadesApertura = false;
          }
          ciudadControl?.enable({ emitEvent: false });
        },
        error: error => {
          if (
            !this.esSolicitudActual(solicitud, destino)
            || departamentoControl?.value !== departamento.id
          ) {
            return;
          }
          console.error(
            `No fue posible cargar las ciudades del departamento "${departamento.nombre}" (Id ${departamento.id}).`,
            error,
          );
          if (destino === 'domicilio') {
            this.errorCiudadesDomicilio = 'No se pudieron cargar las ciudades. Intente nuevamente.';
            this.cargandoCiudadesDomicilio = false;
          } else {
            this.errorCiudadesApertura = 'No se pudieron cargar las ciudades. Intente nuevamente.';
            this.cargandoCiudadesApertura = false;
          }
        },
      });
  }

  private esSolicitudActual(solicitud: number, destino: 'domicilio' | 'apertura'): boolean {
    return destino === 'domicilio'
      ? solicitud === this.solicitudCiudadesDomicilio
      : solicitud === this.solicitudCiudadesApertura;
  }

  // Los controles de ciudad deshabilitados se omiten en Angular, por lo que se validan explícitamente.
  // Las listas se vacían al cambiar el departamento y solo se llenan para el departamento vigente.
  private ciudadValida(destino: 'domicilio' | 'apertura'): boolean {
    const domicilio = destino === 'domicilio';
    const idDepartamento = this.formulario.get(domicilio ? 'departamento' : 'departamentoApertura')?.value;
    const idCiudad = this.formulario.get(domicilio ? 'ciudad' : 'ciudadApertura')?.value;
    const cargando = domicilio ? this.cargandoCiudadesDomicilio : this.cargandoCiudadesApertura;
    const error = domicilio ? this.errorCiudadesDomicilio : this.errorCiudadesApertura;
    const ciudades = domicilio ? this.ciudadesDomicilio : this.ciudadesApertura;

    return !cargando
      && !error
      && typeof idDepartamento === 'number'
      && this.departamentos.some(opcion => opcion.id === idDepartamento)
      && typeof idCiudad === 'number'
      && ciudades.some(ciudad => ciudad.id === idCiudad);
  }

  pasos: PasoStepperVisual[] = [
    { numero: 1, icono: "person", nombre: "Datos Societarios y Representación" },
    { numero: 2, icono: "account_balance", nombre: "Información Financiera" },
    { numero: 3, icono: "description", nombre: "Documentos, RUES y RUP" },
    { numero: 4, icono: "assignment", nombre: "Actividad y Declaración" },
  ];

  finalizar() {
    const ciudadesValidas = this.ciudadValida('domicilio') && this.ciudadValida('apertura');
    if (!this.validarFormulario() || !ciudadesValidas || this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      console.error('No se puede finalizar el registro porque el formulario contiene campos inválidos.');
      return;
    }
  }

  continuar(): void {
    if (this.validarFormulario()) {
      this.pasoActual += 1;
    }
  }

  irAlPaso(paso: number): void {
    if (paso < 1 || paso > this.pasos.length) {
      return;
    }

    if (paso < this.pasoActual) {
      this.pasoActual = paso;
      return;
    }

    // Avanzar solo es posible validando cada paso intermedio, igual que el botón Continuar.
    while (this.pasoActual < paso) {
      const pasoPrevio = this.pasoActual;
      this.continuar();
      if (this.pasoActual === pasoPrevio) {
        break;
      }
    }
  }

  private validarFormulario(): boolean {
    const nombresControles = camposPorPaso[this.pasoActual] ?? [];
    const camposConError = nombresControles
      .filter(controlName => this.formulario.get(controlName)?.invalid
        || (controlName === 'ciudad' && !this.ciudadValida('domicilio'))
        || (controlName === 'ciudadApertura' && !this.ciudadValida('apertura')));

    if (camposConError.length === 0) {
      return true;
    }

    camposConError.forEach(controlName => this.formulario.get(controlName)?.markAsTouched());
    alert(`Hay campos con error: ${camposConError.join(', ')}.`);
    return false;
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
    beneficiariosFinales: new FormControl<number | null>(null, Validators.required),
    cotizaBolsa: new FormControl<number | null>(null, Validators.required),
    revisorFiscal: new FormControl<number | null>(null, Validators.required),
    granContribuyente: new FormControl<number | null>(null, Validators.required),
    autorretenedor: new FormControl<number | null>(null, Validators.required),
    exencionIca: new FormControl<number | null>(null, Validators.required),
    responsabilidades: new FormControl<number[]>([], Validators.required),
    departamento: new FormControl<number | null>(null, Validators.required),
    ciudad: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
    tipoVia: new FormControl<number | null>(null, Validators.required),
    detalleVia: new FormControl('68', Validators.required),
    numeroCruce: new FormControl('45', Validators.required),
    placaPuerta: new FormControl('20', Validators.required),
    interiorTipo: new FormControl<number | null>(null),
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
    banco: new FormControl<number | null>(null, Validators.required),
    tipoCuenta: new FormControl<number | null>(null, Validators.required),
    departamentoApertura: new FormControl<number | null>(null, Validators.required),
    ciudadApertura: new FormControl<number | null>(
      { value: null, disabled: true },
      Validators.required,
    ),
    numeroCuenta: new FormControl('21004598210', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    numeroCuentaConfirmacion: new FormControl('21004598210', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    titularCuenta: new FormControl('SOLUCIONES TECNOLÓGICAS E INTEGRACIONES S.A.S.'),
    correoPagos: new FormControl('pagos@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    correoPagosConfirmacion: new FormControl('pagos@integratech.com.co', [Validators.required, Validators.pattern(CORREO)]),
    responsableTesoreria: new FormControl('Diana Marcela Mendoza Castro', Validators.required),
    telefonoTesoreria: new FormControl('+57 (601) 745 8900 Ext. 105', [Validators.required, Validators.pattern(TELEFONO)]),
    obligadoFacturar: new FormControl<number | null>(null, Validators.required),
    prefijoFacturacion: new FormControl('SETT - 001 hasta 50000'),
    resolucionDian: new FormControl('18764039201934 del 14/01/2024'),
    monedaExtranjera: new FormControl<number | null>(null),
    certificacionBancaria: new FormControl('Certificacion_Bancaria_BancoBogota_2025.pdf', Validators.pattern(ARCHIVO_PDF)),
    rutArchivo: new FormControl('RUT_Integratech_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    certificadoExistenciaArchivo: new FormControl('Certificado_CCB_Integratech_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    cedulaRepresentanteArchivo: new FormControl('Cedula_Representante_Legal.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    tieneRup: new FormControl<number | null>(null, Validators.required),
    rupArchivo: new FormControl('Certificado_RUP_Vigente_2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    vigenciaRup: new FormControl('2025-12-31', Validators.required),
    certificadoParafiscales: new FormControl('Cert_Parafiscales_Feb2025.pdf', [Validators.required, Validators.pattern(ARCHIVO_PDF)]),
    aportesSeguridadSocial: new FormControl(true, Validators.requiredTrue),
    actividadesCiiu: new FormControl<number[]>([], Validators.required),
    unspscSeleccionados: new FormControl<number[]>([]),
    descripcionServicios: new FormControl('Soluciones de infraestructura tecnológica de misión crítica, desarrollo de arquitecturas cloud, ciberseguridad aplicada, soporte integral de hardware institucional y licenciamiento corporativo para entidades de educación superior pública y sectores gubernamentales del Distrito Capital.', Validators.required),
    declaraciones: new FormControl<number[]>([], Validators.required),
    tokenOtp: new FormControl('482913', [Validators.required, Validators.pattern(OTP)]),
    aceptaTratamiento: new FormControl(true, Validators.requiredTrue)
  });

}
