import { HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators, ValidatorFn, ValidationErrors, AbstractControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  asapScheduler,
  catchError,
  forkJoin,
  map,
  observeOn,
  of,
  Subscription,
  switchMap,
} from "rxjs";
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
import {
  ErrorRelacionMid,
  ProveedorMidRespuesta,
  RespuestaEscrituraProveedorMid,
  RespuestaProveedorMid,
} from "../../models/gestion-personas-mid.model";
import {
  mapearActualizacionPersonaJuridica,
  mapearCreacionPersonaJuridica,
} from "../../mappers/gestion-personas-mid.mapper";
import {
  CAMPOS_PROVEEDOR_JURIDICO_MID_PARA_EDICION,
  GestionPersonasMidService,
} from "../../services/gestion-personas-mid.service";
import { AlertService } from "src/app/shared/services/alert.service";

const SOLO_DIGITOS = /^\d+$/;
const NIT = /^\d{9}$/;
const DIGITO_VERIFICACION = /^\d$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?\d[\d\s().-]*(?:Ext\.\s*\d+)?$/;
const URL_HTTP = /^https?:\/\/[^\s]+$/;
const CUENTA_BANCARIA = /^\d{8,20}$/;
const OTP = /^\d{6}$/;

// Validador que requiere al menos un elemento en un array
function minArrayLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || !Array.isArray(value)) {
      return null;
    }
    return value.length >= min ? null : { minArrayLength: { requiredLength: min, actualLength: value.length } };
  };
}

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
  private solicitudEdicionMid = 0;
  private suscripcionCatalogos?: Subscription;
  estadoMid = "";
  mensajeMid = "";
  cargandoMid = false;
  idProveedorMid: number | null = null;
  erroresMid: ErrorRelacionMid[] = [];
  private idProveedorEdicion: number | null = null;
  private idTerceroMid: number | null = null;
  private idTipoRegistroMid: number | null = null;
  private idTipoContribuyenteMid: number | null = null;
  private nitDocumentoNoResuelto = false;
  private idCuentaBancariaMid: number | undefined;
  private puedeCrearCuentaBancariaEnEdicion = false;
  private modoEdicionMid = false;

  constructor(
    private readonly catalogosService: RegistroPersonaJuridicaCatalogosService,
    private readonly ubicacionesService: RegistroPersonaJuridicaUbicacionesService,
    private readonly unspscService: RegistroPersonaJuridicaUnspscService,
    private readonly gestionPersonasMidService: GestionPersonasMidService,
    private readonly alertaService: AlertService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarUnspsc();
    this.cargarDepartamentos();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idTexto = params.get("id");
        if (idTexto === null) {
          return;
        }
        this.modoEdicionMid = true;
        const id = Number(idTexto);
        if (!Number.isSafeInteger(id) || id <= 0) {
          this.solicitudEdicionMid++;
          this.idProveedorEdicion = null;
          this.idProveedorMid = null;
          this.idTerceroMid = null;
          this.idTipoRegistroMid = null;
          this.idTipoContribuyenteMid = null;
          this.nitDocumentoNoResuelto = false;
          this.idCuentaBancariaMid = undefined;
          this.puedeCrearCuentaBancariaEnEdicion = false;
          this.cargandoMid = false;
          this.estadoMid = "error";
          this.mensajeMid = "El ID de proveedor para editar debe ser un entero positivo.";
          return;
        }
        if (this.idProveedorEdicion !== id) {
          this.idProveedorEdicion = id;
          this.cargarProveedorParaEdicion(id, ++this.solicitudEdicionMid);
        }
      });
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
    const fallosUbicaciones: string[] = [];
    const aOpcionesCatalogo = map((lugares: { id: number; nombre: string }[]) =>
      lugares.map(lugar => ({ id: lugar.id, nombre: lugar.nombre })),
    );
    this.suscripcionCatalogos = forkJoin({
      catalogos: this.catalogosService.obtenerCatalogos(),
      tipoVia: this.ubicacionesService.obtenerTiposVia().pipe(
        aOpcionesCatalogo,
        catchError(error => {
          console.error('No fue posible cargar los tipos de vía de Ubicaciones.', error);
          fallosUbicaciones.push('tipos de vía');
          return of([]);
        }),
      ),
      tipoInterior: this.ubicacionesService.obtenerTiposInterior().pipe(
        aOpcionesCatalogo,
        catchError(error => {
          console.error('No fue posible cargar los tipos de interior de Ubicaciones.', error);
          fallosUbicaciones.push('tipos de interior');
          return of([]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalogos, tipoVia, tipoInterior }) => {
          this.catalogos = { ...catalogos, tipoVia, tipoInterior };
          this.errorCatalogos = fallosUbicaciones.length
            ? `No fue posible cargar los catálogos de Ubicaciones: ${fallosUbicaciones.join(' y ')}.`
            : null;
          this.catalogosSinRegistros = [
            catalogos.procedencia,
            tipoVia,
            tipoInterior,
            catalogos.tipoOrganizacion,
            catalogos.tamanoEmpresa,
            catalogos.tipoCapital,
            catalogos.cargo,
            catalogos.camaraComercio,
            catalogos.entidadesBancarias,
            catalogos.tiposCuentaBancaria,
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
    if (this.cargandoMid) {
      return;
    }
    if (this.modoEdicionMid && !this.idProveedorEdicion) {
      void this.alertaService.showErrorAlert(
        "No se puede guardar: el ID de proveedor para editar no es válido.",
      );
      return;
    }
    if (!this.modoEdicionMid) {
      const ciudadesValidas =
        this.ciudadValida("domicilio") && this.ciudadValida("apertura");
      if (
        !this.validarFormulario()
        || !ciudadesValidas
        || this.formulario.invalid
      ) {
        this.formulario.markAllAsTouched();
        console.error(
          "No se puede finalizar el registro porque el formulario contiene campos inválidos.",
        );
        return;
      }
    } else if (!this.idTerceroMid) {
      void this.alertaService.showErrorAlert(
        "La consulta no entregó el ID del tercero; no es seguro actualizar este proveedor.",
      );
      return;
    }

    this.cargandoMid = true;
    this.estadoMid = "loading";
    this.mensajeMid = this.idProveedorEdicion
      ? "Actualizando proveedor en Gestión de Personas MID..."
      : "Creando proveedor en Gestión de Personas MID...";
    const idTerceroActualizacion = this.idProveedorEdicion
      ? this.idTerceroMid
      : null;
    this.catalogosService
      .obtenerIdTipoContribuyente("P_JURIDICA")
      .pipe(
        switchMap((tipoContribuyenteId) => {
          this.idTipoContribuyenteMid = tipoContribuyenteId;
          const valores = this.formulario.getRawValue();
          if (this.idProveedorEdicion) {
            if (idTerceroActualizacion === null) {
              throw new Error(
                "La consulta no entregó el ID del tercero; no es seguro actualizar este proveedor.",
              );
            }
            const payload = mapearActualizacionPersonaJuridica(
              valores,
              this.exigirTipoRegistroEdicion(),
              tipoContribuyenteId,
              idTerceroActualizacion,
              this.idCuentaBancariaMid,
              this.puedeCrearCuentaBancariaEnEdicion,
            );
            return this.gestionPersonasMidService.actualizar(payload);
          }
          return this.catalogosService.obtenerIdTipoDocumentoNit().pipe(
            catchError((error) => {
              console.error(
                "No fue posible resolver el tipo documental NIT en Terceros.",
                error,
              );
              return of(undefined);
            }),
            switchMap((tipoDocumentoNitId) => {
              this.nitDocumentoNoResuelto = tipoDocumentoNitId === undefined;
              const payload = mapearCreacionPersonaJuridica(
                valores,
                tipoContribuyenteId,
                tipoContribuyenteId,
                tipoDocumentoNitId,
              );
              return this.gestionPersonasMidService.crear(payload);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.procesarRespuestaEscritura(response),
        error: (error: unknown) => this.procesarErrorMid(error),
      });
  }

  private cargarProveedorParaEdicion(id: number, solicitud: number): void {
    this.idProveedorMid = null;
    this.idTerceroMid = null;
    this.idTipoRegistroMid = null;
    this.idTipoContribuyenteMid = null;
    this.nitDocumentoNoResuelto = false;
    this.idCuentaBancariaMid = undefined;
    this.puedeCrearCuentaBancariaEnEdicion = false;
    this.erroresMid = [];
    this.cargandoMid = true;
    this.estadoMid = "loading";
    this.mensajeMid = "Cargando los datos disponibles del proveedor...";
    this.gestionPersonasMidService
      .consultar(id, CAMPOS_PROVEEDOR_JURIDICO_MID_PARA_EDICION)
      .pipe(
        switchMap((response) =>
          this.catalogosService
            .obtenerIdTipoContribuyente("P_JURIDICA")
            .pipe(map((tipoContribuyenteId) => ({
              response,
              tipoContribuyenteId,
            }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ response, tipoContribuyenteId }) => {
          if (solicitud !== this.solicitudEdicionMid) {
            return;
          }
          this.cargandoMid = false;
          const envelope = response.body;
          if (
            !envelope
            || !envelope.Success
            || !envelope.Data
            || (response.status !== 200 && response.status !== 206)
            || envelope.Status !== String(response.status)
          ) {
            this.estadoMid = "error";
            this.mensajeMid = envelope?.Message
              || "El MID devolvió una respuesta inesperada al consultar el proveedor.";
            return;
          }
          const tipoRegistroId = envelope.Data.TipoRegistroId;
          const tipoContribuyenteRespuesta =
            envelope.Data.Tercero?.TipoContribuyenteId;
          if (
            envelope.Data.Id !== id
            || typeof tipoRegistroId !== "number"
            || !Number.isSafeInteger(tipoRegistroId)
            || tipoRegistroId <= 0
            || tipoRegistroId !== tipoContribuyenteId
            || tipoContribuyenteRespuesta !== tipoContribuyenteId
          ) {
            this.estadoMid = "error";
            this.mensajeMid =
              "El proveedor consultado no tiene tipos de registro y contribuyente válidos para persona jurídica.";
            return;
          }
          this.idProveedorMid = envelope.Data.Id ?? id;
          this.idTerceroMid = envelope.Data.Tercero?.Id ?? null;
          this.idTipoRegistroMid = tipoRegistroId;
          this.idTipoContribuyenteMid = tipoContribuyenteId;
          const cuentasPrincipales = envelope.Data.CuentaBancaria?.filter(
            (cuenta) => cuenta.EsPrincipal === true,
          ) ?? [];
          const cuentaPrincipal =
            cuentasPrincipales.length === 1 ? cuentasPrincipales[0] : undefined;
          const idCuentaBancaria = cuentaPrincipal?.Id;
          this.idCuentaBancariaMid =
            typeof idCuentaBancaria === "number"
            && Number.isSafeInteger(idCuentaBancaria)
            && idCuentaBancaria > 0
              ? idCuentaBancaria
              : undefined;
          this.erroresMid = envelope.MetaData?.Errors ?? [];
          this.puedeCrearCuentaBancariaEnEdicion =
            response.status === 200
            && Array.isArray(envelope.Data.CuentaBancaria)
            && envelope.Data.CuentaBancaria.length === 0
            && this.erroresMid.length === 0;
          this.hidratarFormulario(envelope.Data);
          this.estadoMid = response.status === 206 ? "partial" : "success";
          this.mensajeMid = response.status === 206
            ? `${envelope.Message} Revise los datos disponibles antes de actualizar.`
            : "Se cargaron los datos del proveedor disponibles en el contrato del MID.";
        },
        error: (error: unknown) => {
          if (solicitud === this.solicitudEdicionMid) {
            this.procesarErrorMid(error);
          }
        },
      });
  }

  private hidratarFormulario(proveedor: ProveedorMidRespuesta): void {
    const identificaciones = proveedor.Tercero?.DatosIdentificacion ?? [];
    const identificacion = identificaciones.length === 1
      ? identificaciones[0]
      : undefined;
    const juridico = proveedor.ProveedorJuridico;
    const cuentasPrincipales = proveedor.CuentaBancaria?.filter(
      (elemento) => elemento.EsPrincipal === true,
    ) ?? [];
    const cuenta = cuentasPrincipales.length === 1
      ? cuentasPrincipales[0]
      : undefined;
    this.formulario.patchValue(
      {
        ...(proveedor.Tercero?.NombreCompleto
          ? { razonSocial: proveedor.Tercero.NombreCompleto }
          : {}),
        ...(juridico?.NombreComercial
          ? { nombreComercial: juridico.NombreComercial }
          : {}),
        ...(juridico?.MatriculaMercantil !== undefined
          ? { matriculaMercantil: String(juridico.MatriculaMercantil) }
          : {}),
        ...(juridico?.FechaConstitucion
          ? { fechaConstitucion: juridico.FechaConstitucion }
          : {}),
        ...(identificacion?.Numero
          ? { nit: identificacion.Numero, nitConfirmacion: identificacion.Numero }
          : {}),
        ...(cuenta?.EntidadBancariaId !== undefined
          ? { banco: cuenta.EntidadBancariaId }
          : {}),
        ...(cuenta?.TipoCuentaId !== undefined
          ? { tipoCuenta: cuenta.TipoCuentaId }
          : {}),
        ...(cuenta?.NumeroCuenta
          ? {
              numeroCuenta: cuenta.NumeroCuenta,
              numeroCuentaConfirmacion: cuenta.NumeroCuenta,
            }
          : {}),
        ...(cuenta?.NombreTitular
          ? { titularCuenta: cuenta.NombreTitular }
          : {}),
        ...(cuenta?.CiudadAperturaId !== undefined
          ? { ciudadApertura: cuenta.CiudadAperturaId }
          : {}),
      },
      { emitEvent: false },
    );
  }

  private exigirTipoRegistroEdicion(): number {
    if (
      this.idTipoRegistroMid === null
      || !Number.isSafeInteger(this.idTipoRegistroMid)
      || this.idTipoRegistroMid <= 0
    ) {
      throw new Error(
        "La consulta no entregó un TipoRegistroId válido; no es seguro actualizar este proveedor.",
      );
    }
    return this.idTipoRegistroMid;
  }

  private procesarRespuestaEscritura(
    response: HttpResponse<RespuestaEscrituraProveedorMid>,
  ): void {
    this.cargandoMid = false;
    const envelope = response.body;
    if (
      !envelope
      || !envelope.Success
      || (response.status !== 200 && response.status !== 206)
      || envelope.Status !== String(response.status)
      || !envelope.Data
    ) {
      this.estadoMid = "error";
      this.mensajeMid = envelope?.Message
        || "El MID devolvió una respuesta inesperada al guardar el proveedor.";
      void this.alertaService.showErrorAlert(this.mensajeMid);
      return;
    }

    const idProveedorRespuesta = envelope.Data.Id;
    const idTerceroRespuesta = envelope.Data.Tercero?.Id;
    const tipoRegistroRespuesta = envelope.Data.TipoRegistroId;
    if (
      typeof idProveedorRespuesta !== "number"
      || !Number.isSafeInteger(idProveedorRespuesta)
      || idProveedorRespuesta <= 0
      || typeof idTerceroRespuesta !== "number"
      || !Number.isSafeInteger(idTerceroRespuesta)
      || idTerceroRespuesta <= 0
      || (tipoRegistroRespuesta !== undefined
        && (typeof tipoRegistroRespuesta !== "number"
          || !Number.isSafeInteger(tipoRegistroRespuesta)
          || tipoRegistroRespuesta <= 0))
    ) {
      this.estadoMid = "error";
      this.mensajeMid =
        "El MID no devolvió IDs válidos de proveedor y tercero; no se puede confirmar la operación.";
      void this.alertaService.showErrorAlert(this.mensajeMid);
      return;
    }
    if (
      (this.idProveedorEdicion !== null
        && idProveedorRespuesta !== this.idProveedorEdicion)
      || (this.idTerceroMid !== null && idTerceroRespuesta !== this.idTerceroMid)
      || (this.idTipoRegistroMid !== null
        && tipoRegistroRespuesta !== undefined
        && tipoRegistroRespuesta !== this.idTipoRegistroMid)
      || (this.idTipoContribuyenteMid !== null
        && tipoRegistroRespuesta !== undefined
        && tipoRegistroRespuesta !== this.idTipoContribuyenteMid)
      || (this.idTipoContribuyenteMid !== null
        && envelope.Data.Tercero?.TipoContribuyenteId !== undefined
        && envelope.Data.Tercero.TipoContribuyenteId !== this.idTipoContribuyenteMid)
    ) {
      this.estadoMid = "error";
      this.mensajeMid =
        "Los IDs devueltos por el MID no coinciden con el proveedor y tercero consultados.";
      void this.alertaService.showErrorAlert(this.mensajeMid);
      return;
    }

    this.idProveedorMid = idProveedorRespuesta;
    this.idProveedorEdicion = idProveedorRespuesta;
    this.idTerceroMid = idTerceroRespuesta;
    if (typeof tipoRegistroRespuesta === "number") {
      this.idTipoRegistroMid = tipoRegistroRespuesta;
    }
    this.puedeCrearCuentaBancariaEnEdicion = false;
    const cuentasBancarias = envelope.Data.CuentaBancaria;
    if (cuentasBancarias?.length) {
      const cuentasPrincipales = cuentasBancarias.filter(
        (cuenta) => cuenta.EsPrincipal === true,
      );
      const idCuentaBancaria = cuentasPrincipales.length === 1
        ? cuentasPrincipales[0].Id
        : undefined;
      this.idCuentaBancariaMid =
        typeof idCuentaBancaria === "number"
        && Number.isSafeInteger(idCuentaBancaria)
        && idCuentaBancaria > 0
          ? idCuentaBancaria
          : undefined;
    }
    this.erroresMid = envelope.MetaData?.Errors ?? [];
    const respuestaParcial =
      response.status === 206 || this.nitDocumentoNoResuelto;
    this.estadoMid = respuestaParcial ? "partial" : "success";
    const advertenciaNit = this.nitDocumentoNoResuelto
      ? " El NIT no se envió porque el catálogo no permitió resolver de forma única su tipo documental."
      : "";
    this.mensajeMid = `${envelope.Message}${advertenciaNit}`;
    if (respuestaParcial) {
      const detalle = this.erroresMid
        .map((error) => `${error.path ?? "Relación"}: ${error.message ?? "materialización parcial"}`)
        .join("; ");
      const detalleNit = this.nitDocumentoNoResuelto
        ? advertenciaNit.trim()
        : "";
      void this.alertaService.showAlert(
        "Registro parcial",
        [detalle, detalleNit].filter(Boolean).join("; ") || this.mensajeMid,
      );
      return;
    }
    void this.alertaService.showSuccessAlert(
      `${this.mensajeMid}${this.idProveedorMid ? ` ID del proveedor: ${this.idProveedorMid}.` : ""}`,
    );
  }

  private procesarErrorMid(error: unknown): void {
    this.cargandoMid = false;
    this.estadoMid = "error";
    this.mensajeMid = error instanceof HttpErrorResponse
      ? this.mensajeErrorHttp(error)
      : error instanceof Error
        ? error.message
        : "No fue posible completar la operación con Gestión de Personas MID.";
    void this.alertaService.showErrorAlert(this.mensajeMid);
  }

  private mensajeErrorHttp(error: HttpErrorResponse): string {
    const body: unknown = error.error;
    if (
      body
      && typeof body === "object"
      && !Array.isArray(body)
      && typeof (body as Record<string, unknown>)["Message"] === "string"
    ) {
      const mensaje = (body as Record<string, unknown>)["Message"];
      if (typeof mensaje === "string") {
        return mensaje;
      }
    }
    return error.status === 0
      ? "No fue posible conectar con Gestión de Personas MID. Verifique URL, red y autenticación."
      : `Gestión de Personas MID respondió HTTP ${error.status}.`;
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
    nit: new FormControl('', [Validators.required, Validators.pattern(NIT)]),
    digitoVerificacion: new FormControl('', Validators.pattern(DIGITO_VERIFICACION)),
    nitConfirmacion: new FormControl('', [Validators.required, Validators.pattern(NIT)]),
    procedencia: new FormControl<number | null>(null, Validators.required),
    razonSocial: new FormControl('', Validators.required),
    nombreComercial: new FormControl(''),
    matriculaMercantil: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    camaraComercio: new FormControl<number | null>(null, Validators.required),
    fechaConstitucion: new FormControl('', Validators.required),
    fechaRenovacion: new FormControl('', Validators.required),
    tipoOrganizacion: new FormControl<number | null>(null, Validators.required),
    tamanoEmpresarial: new FormControl<number | null>(null, Validators.required),
    documentoRepresentante: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    cargoRepresentante: new FormControl<number | null>(null, Validators.required),
    representanteRelacionado: new FormControl(false),
    primerApellido: new FormControl('', Validators.required),
    segundoApellido: new FormControl(''),
    primerNombre: new FormControl('', Validators.required),
    segundoNombre: new FormControl(''),
    correoRepresentante: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    telefonoRepresentante: new FormControl('', [Validators.required, Validators.pattern(TELEFONO)]),
    limitacionEstatutaria: new FormControl(null, Validators.required),
    registrarSuplente: new FormControl(false),
    beneficiariosFinales: new FormControl<boolean | null>(null, Validators.required),
    cotizaBolsa: new FormControl<boolean | null>(null, Validators.required),
    revisorFiscal: new FormControl<boolean | null>(null, Validators.required),
    granContribuyente: new FormControl<boolean | null>(null, Validators.required),
    autorretenedor: new FormControl<boolean | null>(null, Validators.required),
    exencionIca: new FormControl<boolean | null>(null, Validators.required),
    responsabilidades: new FormControl<number[]>([], [Validators.required, minArrayLength(1)]),
    departamento: new FormControl<number | null>(null, Validators.required),
    ciudad: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
    tipoVia: new FormControl<number | null>(null, Validators.required),
    detalleVia: new FormControl('', Validators.required),
    numeroCruce: new FormControl('', Validators.required),
    placaPuerta: new FormControl('', Validators.required),
    interiorTipo: new FormControl<number | null>(null),
    detalleInterior: new FormControl(''),
    correoNotificaciones: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    correoNotificacionesConfirmacion: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    telefonoFijo: new FormControl('', [Validators.required, Validators.pattern(TELEFONO)]),
    extension: new FormControl('', Validators.pattern(SOLO_DIGITOS)),
    telefonoAlterno: new FormControl('', [Validators.required, Validators.pattern(TELEFONO)]),
    sitioWeb: new FormControl('', Validators.pattern(URL_HTTP)),
    contactoComercial: new FormControl(''),
    telefonoAsesor: new FormControl('', Validators.pattern(TELEFONO)),
    aceptaTerminos: new FormControl(false),
    tipoConstitucion: new FormControl<number | null>(null, Validators.required),
    capitalAutorizado: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    capitalSuscritoPagado: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    activosTotales: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    pasivosTotales: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    banco: new FormControl<number | null>(null, Validators.required),
    tipoCuenta: new FormControl<number | null>(null, Validators.required),
    departamentoApertura: new FormControl<number | null>(null, Validators.required),
    ciudadApertura: new FormControl<number | null>(
      { value: null, disabled: true },
      Validators.required,
    ),
    numeroCuenta: new FormControl('', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    numeroCuentaConfirmacion: new FormControl('', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    titularCuenta: new FormControl(''),
    correoPagos: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    correoPagosConfirmacion: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    responsableTesoreria: new FormControl('', Validators.required),
    telefonoTesoreria: new FormControl('', [Validators.required, Validators.pattern(TELEFONO)]),
    obligadoFacturar: new FormControl<boolean | null>(null, Validators.required),
    prefijoFacturacion: new FormControl(''),
    resolucionDian: new FormControl(''),
    monedaExtranjera: new FormControl<boolean | null>(null),
    certificacionBancaria: new FormControl<File | null>(null, Validators.required),
    rutArchivo: new FormControl<File | null>(null, Validators.required),
    certificadoExistenciaArchivo: new FormControl<File | null>(null, Validators.required),
    cedulaRepresentanteArchivo: new FormControl<File | null>(null, Validators.required),
    tieneRup: new FormControl<boolean | null>(null, Validators.required),
    rupArchivo: new FormControl<File | null>(null),
    vigenciaRup: new FormControl(''),
    certificadoParafiscales: new FormControl<File | null>(null, Validators.required),
    aportesSeguridadSocial: new FormControl(false, Validators.requiredTrue),
    actividadesCiiu: new FormControl<number[]>([], Validators.required),
    unspscSeleccionados: new FormControl<number[]>([]),
    descripcionServicios: new FormControl('', Validators.required),
    declaraciones: new FormControl<number[]>([], Validators.required),
    tokenOtp: new FormControl('', [Validators.required, Validators.pattern(OTP)]),
    aceptaTratamiento: new FormControl(false, Validators.requiredTrue)
  });

}
