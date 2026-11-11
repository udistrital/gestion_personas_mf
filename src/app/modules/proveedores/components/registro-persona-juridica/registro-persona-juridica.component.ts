import { ChangeDetectorRef, Component, DestroyRef, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators, ValidatorFn, ValidationErrors, AbstractControl } from "@angular/forms";
import { Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  asapScheduler,
  catchError,
  forkJoin,
  map,
  observeOn,
  of,
  Subscription,
  timeout,
} from "rxjs";
import { PasoStepperVisual } from "src/app/shared/components/stepper-visual/stepper-visual.component";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { camposPorPaso } from "./registro-persona-juridica.component.utils";
import {
  CatalogosPersonaJuridica,
  OpcionCatalogo,
  RegistroPersonaJuridicaCatalogosService,
} from "./services/registro-persona-juridica-catalogos.service";
import {
  CatalogosUbicacionesPersonaJuridica,
  OpcionLugar,
  RegistroPersonaJuridicaUbicacionesService,
} from "./services/registro-persona-juridica-ubicaciones.service";
import { mapearPersonaJuridicaMid } from "../../services/gestion-personas-mid.mapper";
import {
  GestionPersonasMidService,
  ResultadoEnvioMid,
  resumirErrorMid,
  resumirRespuestaMid,
} from "../../services/gestion-personas-mid.service";
import { ResumenRadicacionProveedor } from "../registro-persona-natural/registro-persona-natural-exito/registro-persona-natural-exito.model";

const SOLO_DIGITOS = /^\d+$/;
const NIT = /^\d{9}$/;
const DIGITO_VERIFICACION = /^\d$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?\d[\d\s().-]*(?:Ext\.\s*\d+)?$/;
const URL_HTTP = /^https?:\/\/[^\s]+$/;
const CUENTA_BANCARIA = /^\d{8,20}$/;

/**
 * Valida el texto visible del editor enriquecido.
 *
 * El editor guarda HTML (`<p><br></p>` cuando está vacío), así que no se
 * puede usar `Validators.required` directo: se cuenta el texto plano y se
 * aplica el máximo de caracteres sobre ese mismo valor.
 */
function validarTextoEnriquecido(maximo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = textoPlanoDesdeHtml(String(control.value ?? "")).trim();
    if (texto.length === 0) {
      return { required: true };
    }
    return texto.length > maximo
      ? { maxlength: { requiredLength: maximo, actualLength: texto.length } }
      : null;
  };
}

/** Exige el certificado RUP solo cuando el proveedor indicó que aplica. */
function requiereArchivoRup(
  control: AbstractControl,
): ValidationErrors | null {
  const tieneRup = control.parent?.get("tieneRup")?.value;
  return tieneRup === true && !control.value ? { required: true } : null;
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
  /** Catálogo CIIU independiente: es el más pesado del formulario. */
  catalogoCiiu: OpcionCatalogo[] = [];
  cargandoCiiu = false;
  errorCiiu: string | null = null;
  pais: OpcionLugar | null = null;
  departamentos: OpcionLugar[] = [];
  ciudadesDomicilio: OpcionLugar[] = [];
  cargandoDepartamentos = false;
  cargandoCiudadesDomicilio = false;
  errorDepartamentos: string | null = null;
  errorCiudadesDomicilio: string | null = null;
  private solicitudDepartamentos = 0;
  private solicitudCiudadesDomicilio = 0;
  private suscripcionCatalogos?: Subscription;
  estadoMensaje = "Complete el formulario para registrar la persona jurídica.";
  estadoDetalle = "";
  private registroEnviandose = false;
  private registroProcesado = false;
  envioIndeterminado = false;
  proveedorMidId?: number;

  /** true cuando el MID confirmó el registro y debe mostrarse la constancia. */
  registroCompletado = false;
  /** Datos de la constancia; null mientras no se haya radicado. */
  resumenRadicacion: ResumenRadicacionProveedor | null = null;
  /** Identifica la constancia abierta con datos de ejemplo desde el paso 4. */
  esConstanciaEjemplo = false;

  constructor(
    private readonly catalogosService: RegistroPersonaJuridicaCatalogosService,
    private readonly ubicacionesService: RegistroPersonaJuridicaUbicacionesService,
    private readonly gestionPersonasMidService: GestionPersonasMidService,
    private readonly router: Router,
    private readonly destroyRef: DestroyRef,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarCiiu();
    this.cargarDepartamentos();
    this.formulario.get('departamento')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.cargarCiudades(id));
  }

  regresarARegistroInicial(): void {
    void this.router.navigateByUrl("/proveedores/registro-inicio-persona");
  }

  reintentarCargaDepartamentos(): void {
    this.cargarDepartamentos();
  }

  reintentarCatalogos(): void {
    this.cargarCatalogos();
    this.cargarCiiu();
  }

  /** Reintenta solo el catálogo CIIU desde el paso 4. */
  reintentarCiiu(): void {
    this.cargarCiiu();
  }

  reintentarCiudadesDomicilio(): void {
    this.cargarCiudades(this.formulario.get('departamento')?.value);
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
          this.cdr.detectChanges();
        },
        error: error => {
          if (solicitud !== this.solicitudDepartamentos) {
            return;
          }
          console.error('No fue posible cargar los departamentos de Colombia.', error);
          this.errorDepartamentos = 'No se pudieron cargar los departamentos. Intente nuevamente.';
          this.cargandoDepartamentos = false;
          this.cdr.detectChanges();
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
          this.catalogos = {
            ...catalogos,
            tipoVia,
            tipoInterior,
            actividadEconomicaCiiu: [],
          };
          this.errorCatalogos = fallosUbicaciones.length
            ? `No fue posible cargar los catálogos de Ubicaciones: ${fallosUbicaciones.join(' y ')}.`
            : null;
          const codigosDocumentoRepresentante = new Set(["CC", "CE", "PAS"]);
          this.catalogosSinRegistros = [
            catalogos.procedencia,
            catalogos.tipoDocumento.filter(opcion =>
              codigosDocumentoRepresentante.has(opcion.codigo?.toUpperCase() ?? ""),
            ),
            catalogos.regimenContributivo,
            catalogos.tipoConformacion,
            tipoVia,
            tipoInterior,
            catalogos.cargo,
            catalogos.entidadesBancarias,
            catalogos.tiposCuentaBancaria,
          ].some(opciones => opciones.length === 0);
          this.cargandoCatalogos = false;
          this.cdr.detectChanges();
        },
        error: error => {
          console.error('No fue posible cargar los catálogos de Persona Jurídica.', error);
          const detalle = error instanceof Error
            ? error.message
            : 'Verifique su conexión e intente nuevamente.';
          this.errorCatalogos = `No se pudieron cargar uno o más catálogos. ${detalle}`;
          this.catalogosSinRegistros = false;
          this.cargandoCatalogos = false;
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Carga el CIIU por separado del resto de catálogos.
   *
   * Es el catálogo más extenso; si se cargara dentro del `forkJoin` general,
   * un timeout o una respuesta lenta dejaría el paso 4 en "Cargando..."
   * aunque el resto del formulario ya estuviera listo.
   */
  private cargarCiiu(): void {
    if (this.cargandoCiiu) {
      return;
    }
    this.cargandoCiiu = true;
    this.errorCiiu = null;
    this.catalogoCiiu = [];
    console.info('[CIIU] Carga del catálogo iniciada.');

    this.catalogosService
      .obtenerCatalogoCiiu()
      .pipe(
        timeout(60000),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (catalogo) => {
          this.catalogoCiiu = catalogo;
          this.cargandoCiiu = false;
          // La respuesta puede llegar fuera del ciclo de detección de Angular.
          this.cdr.detectChanges();
          console.info(
            `[CIIU] Catálogo cargado: ${catalogo.length} actividades.`,
          );
        },
        error: (error: unknown) => {
          this.cargandoCiiu = false;
          const esTimeout =
            error instanceof Error && error.name === 'TimeoutError';
          this.errorCiiu = esTimeout
            ? 'El catálogo de actividades económicas CIIU tardó demasiado en responder. Intente nuevamente.'
            : 'No fue posible cargar el catálogo de actividades económicas CIIU. Intente nuevamente.';
          this.cdr.detectChanges();
          console.error('[CIIU] Error al cargar el catálogo:', error);
        },
      });
  }

  private cargarCiudades(idDepartamento: unknown): void {
    const solicitud = ++this.solicitudCiudadesDomicilio;
    const departamentoControl = this.formulario.get('departamento');
    const ciudadControl = this.formulario.get('ciudad');

    ciudadControl?.setValue(null, { emitEvent: false });
    ciudadControl?.disable({ emitEvent: false });
    this.ciudadesDomicilio = [];
    this.cargandoCiudadesDomicilio = false;
    this.errorCiudadesDomicilio = null;

    if (typeof idDepartamento !== 'number' || !Number.isInteger(idDepartamento)) {
      return;
    }
    const departamento = this.departamentos.find(opcion => opcion.id === idDepartamento);
    if (!departamento) {
      return;
    }

    this.cargandoCiudadesDomicilio = true;

    // La caché del servicio reemite de forma síncrona; observeOn evita mutar
    // ciudades durante el mismo ciclo de detección de cambios (NG0100).
    this.ubicacionesService.obtenerCiudades(departamento)
      .pipe(observeOn(asapScheduler), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ciudades => {
          if (
            solicitud !== this.solicitudCiudadesDomicilio
            || departamentoControl?.value !== departamento.id
          ) {
            return;
          }
          this.ciudadesDomicilio = ciudades;
          this.cargandoCiudadesDomicilio = false;
          ciudadControl?.enable({ emitEvent: false });
          this.cdr.detectChanges();
        },
        error: error => {
          if (
            solicitud !== this.solicitudCiudadesDomicilio
            || departamentoControl?.value !== departamento.id
          ) {
            return;
          }
          console.error(
            `No fue posible cargar las ciudades del departamento "${departamento.nombre}" (Id ${departamento.id}).`,
            error,
          );
          this.errorCiudadesDomicilio = 'No se pudieron cargar las ciudades. Intente nuevamente.';
          this.cargandoCiudadesDomicilio = false;
          this.cdr.detectChanges();
        },
      });
  }

  // Los controles de ciudad deshabilitados se omiten en Angular, por lo que se validan explícitamente.
  // Las listas se vacían al cambiar el departamento y solo se llenan para el departamento vigente.
  private ciudadValida(): boolean {
    const idDepartamento = this.formulario.get('departamento')?.value;
    const idCiudad = this.formulario.get('ciudad')?.value;

    return !this.cargandoCiudadesDomicilio
      && !this.errorCiudadesDomicilio
      && typeof idDepartamento === 'number'
      && this.departamentos.some(opcion => opcion.id === idDepartamento)
      && typeof idCiudad === 'number'
      && this.ciudadesDomicilio.some(ciudad => ciudad.id === idCiudad);
  }

  pasos: PasoStepperVisual[] = [
    { numero: 1, icono: "person", nombre: "Datos Societarios y Representación" },
    { numero: 2, icono: "account_balance", nombre: "Información Financiera" },
    { numero: 3, icono: "description", nombre: "Documentos, RUES y RUP" },
    { numero: 4, icono: "assignment", nombre: "Actividad y Declaración" },
  ];

  /** El último paso se muestra con sello de verificación y "Éxito". */
  readonly pasosStepperExito = this.pasos.map((paso) =>
    paso.numero === this.pasos.length
      ? { ...paso, icono: "verified", subtitulo: "Éxito" }
      : paso,
  );

  finalizar() {
    if (this.registroEnviandose) {
      return;
    }
    if (this.registroProcesado) {
      this.estadoMensaje = "Este registro ya fue enviado al MID";
      this.estadoDetalle = this.proveedorMidId
        ? `Id del proveedor: ${this.proveedorMidId}. No se enviará un segundo POST.`
        : "No se enviará un segundo POST.";
      return;
    }
    if (this.envioIndeterminado) {
      this.estadoMensaje = "El resultado del envío anterior sigue sin confirmarse";
      this.estadoDetalle =
        "Verifique el estado del registro antes de volver a enviarlo.";
      return;
    }
    const ciudadesValidas = this.ciudadValida();
    if (!this.validarFormulario() || !ciudadesValidas || this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.estadoMensaje = "No se puede finalizar el registro";
      this.estadoDetalle = "Revise los campos obligatorios del formulario.";
      return;
    }

    let mapeo: ReturnType<typeof mapearPersonaJuridicaMid>;
    try {
      mapeo = mapearPersonaJuridicaMid(this.formulario.getRawValue());
    } catch (error) {
      const resultado = resumirErrorMid(error);
      this.estadoMensaje = resultado.mensaje;
      this.estadoDetalle = resultado.detalle;
      return;
    }

    this.registroEnviandose = true;
    this.estadoMensaje = "Enviando el registro al MID";
    this.estadoDetalle = "No cierre esta página mientras se procesa la solicitud.";
    this.gestionPersonasMidService
      .registrarPersonaJuridica(mapeo.payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          const resultado = resumirRespuestaMid(respuesta, mapeo.omisiones);
          this.registroEnviandose = false;
          this.registroProcesado =
            resultado.tipo === "success" || resultado.tipo === "partial";
          this.envioIndeterminado = resultado.tipo === "indeterminate";
          this.proveedorMidId = resultado.proveedorId;
          this.estadoMensaje = resultado.mensaje;
          this.estadoDetalle = resultado.detalle;

          if (resultado.tipo === "success" || resultado.tipo === "partial") {
            this.prepararConstancia(resultado);
          }
        },
        error: (error: unknown) => {
          const resultado = resumirErrorMid(error);
          this.registroEnviandose = false;
          this.envioIndeterminado = resultado.tipo === "indeterminate";
          this.estadoMensaje = resultado.mensaje;
          this.estadoDetalle = resultado.detalle;
        },
      });
  }

  /** Abre la constancia con datos de ejemplo, sin enviar nada al MID. */
  verConstanciaEjemplo(): void {
    const resumen = this.crearResumenEjemplo();
    this.esConstanciaEjemplo = true;
    this.resumenRadicacion = resumen;
    this.registroCompletado = true;

    void this.calcularHashRadicacion(resumen).then((hash) => {
      if (this.resumenRadicacion === resumen) {
        this.resumenRadicacion = { ...resumen, hash };
      }
    });
  }

  /** Vuelve al formulario solo si la constancia abierta es la de ejemplo. */
  volverDesdeConstancia(): void {
    if (!this.esConstanciaEjemplo) {
      this.regresarARegistroInicial();
      return;
    }
    this.esConstanciaEjemplo = false;
    this.registroCompletado = false;
    this.resumenRadicacion = null;
  }

  /** Sustituye el formulario por la constancia cuando el MID confirma. */
  private prepararConstancia(resultado: ResultadoEnvioMid): void {
    const resumen = this.construirResumenRadicacion(resultado);
    this.esConstanciaEjemplo = false;
    this.resumenRadicacion = resumen;
    this.registroCompletado = true;

    void this.calcularHashRadicacion(resumen).then((hash) => {
      if (this.resumenRadicacion === resumen) {
        this.resumenRadicacion = { ...resumen, hash };
      }
    });
  }

  private construirResumenRadicacion(
    resultado: ResultadoEnvioMid,
  ): ResumenRadicacionProveedor {
    const valores = this.formulario.getRawValue() as Record<string, unknown>;
    const nit = String(valores["nit"] ?? "").trim();
    const dv = String(valores["digitoVerificacion"] ?? "").trim();
    const numeroDocumento = dv ? `${nit}-${dv}` : nit;

    const representante = [
      valores["primerNombre"],
      valores["segundoNombre"],
      valores["primerApellido"],
      valores["segundoApellido"],
    ]
      .map((parte) => String(parte ?? "").trim())
      .filter(Boolean)
      .join(" ");

    const tipoDocumentoRepresentante = this.nombreTipoDocumentoRepresentante(
      valores["tipoDocumentoRepresentante"],
    );
    const numeroDocumentoRepresentante = String(
      valores["documentoRepresentante"] ?? "",
    ).trim();
    const documentoRepresentante = [
      tipoDocumentoRepresentante,
      numeroDocumentoRepresentante,
    ]
      .filter(Boolean)
      .join(" ");

    const idsCiiu = Array.isArray(valores["actividadesCiiu"])
      ? (valores["actividadesCiiu"] as unknown[])
      : [];
    const principalId = valores["actividadCiiuPrincipalId"];
    const seleccionadas = idsCiiu
      .map((id) =>
        this.catalogoCiiu.find(
          (opcion) => String(opcion.id) === String(id),
        ),
      )
      .filter((opcion): opcion is OpcionCatalogo => opcion !== undefined);
    const principal =
      seleccionadas.find(
        (opcion) => String(opcion.id) === String(principalId),
      ) ?? seleccionadas[0];
    const secundarias = seleccionadas
      .filter((opcion) => opcion.id !== principal?.id)
      .map((opcion) => this.etiquetaCiiu(opcion));

    const idRadicado = resultado.terceroId ?? resultado.proveedorId;

    return {
      nombreCompleto:
        String(valores["razonSocial"] ?? "").trim()
        || "Sin razón social registrada",
      tipoDocumento: "",
      numeroDocumento: numeroDocumento || "No registrado",
      ciudadExpedicion: this.nombreCiudadDomicilio(),
      tipoSolicitante: "Persona Jurídica - Proveedor",
      representanteLegal: representante || undefined,
      documentoRepresentante: documentoRepresentante || undefined,
      ciiuPrincipal: principal
        ? this.etiquetaCiiu(principal)
        : "No registrada",
      ciiuSecundarias: secundarias,
      correoPersonal: String(
        valores["correoNotificaciones"] ?? "",
      ).trim(),
      correoTesoreria: String(valores["correoPagos"] ?? "").trim(),
      radicado:
        idRadicado !== undefined
          ? `RUPBP-${idRadicado}`
          : "RUPBP-PENDIENTE",
      fechaRadicacion: new Date(),
      hash: null,
      proveedorId: resultado.proveedorId,
      parcial: resultado.tipo === "partial",
      observaciones:
        resultado.tipo === "partial" ? resultado.detalle : undefined,
    };
  }

  private crearResumenEjemplo(): ResumenRadicacionProveedor {
    return {
      nombreCompleto: "Soluciones Tecnológicas e Integraciones S.A.S.",
      tipoDocumento: "",
      numeroDocumento: "900.845.120-3",
      ciudadExpedicion: "Bogotá D.C.",
      tipoSolicitante: "Persona Jurídica - Proveedor",
      representanteLegal: "Carlos Eduardo Rodríguez Patiño",
      documentoRepresentante: "C.C. 80.234.567",
      ciiuPrincipal: "CIIU 6201 - Desarrollo de sistemas informáticos",
      ciiuSecundarias: [
        "CIIU 6202 - Consultoría informática y gestión de instalaciones informáticas",
        "CIIU 6209 - Otras actividades de tecnologías de información y servicios de computación",
      ],
      correoPersonal: "notificaciones@integratech.com.co",
      correoTesoreria: "pagos@integratech.com.co",
      radicado: "RUPBP-74526255769",
      fechaRadicacion: new Date(),
      hash: null,
      proveedorId: 74526255769,
      parcial: false,
    };
  }

  private nombreCiudadDomicilio(): string {
    const idCiudad = this.formulario.get("ciudad")?.value;
    const ciudad = this.ciudadesDomicilio.find(
      (opcion) => String(opcion.id) === String(idCiudad),
    );
    if (ciudad) {
      return ciudad.nombre;
    }
    const idDepartamento = this.formulario.get("departamento")?.value;
    return (
      this.departamentos.find(
        (opcion) => String(opcion.id) === String(idDepartamento),
      )?.nombre ?? ""
    );
  }

  private nombreTipoDocumentoRepresentante(valor: unknown): string {
    const opcion = this.catalogos?.tipoDocumento.find(
      tipoDocumento => tipoDocumento.id === Number(valor),
    );
    switch (opcion?.codigo?.toUpperCase()) {
      case "CC":
        return "C.C.";
      case "CE":
        return "C.E.";
      case "PAS":
        return "Pasaporte";
      default:
        return opcion?.nombre ?? "";
    }
  }

  private etiquetaCiiu(opcion: OpcionCatalogo): string {
    const nombre =
      opcion.nombre?.trim()
      || opcion.descripcion?.trim()
      || "Actividad económica";
    return `CIIU ${opcion.codigo ?? opcion.id} - ${nombre}`;
  }

  /**
   * Hash de referencia local. No sustituye la firma ni el radicado del MID:
   * sirve para que la constancia tenga una huella verificable del envío.
   */
  private async calcularHashRadicacion(
    resumen: ResumenRadicacionProveedor,
  ): Promise<string | null> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return null;
    }
    try {
      const texto = [
        resumen.radicado,
        resumen.proveedorId ?? "",
        resumen.fechaRadicacion.toISOString(),
      ].join("|");
      const digest = await subtle.digest(
        "SHA-256",
        new TextEncoder().encode(texto),
      );
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return null;
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
        || (controlName === 'ciudad' && !this.ciudadValida()));

    if (camposConError.length === 0) {
      return true;
    }

    camposConError.forEach(controlName => this.formulario.get(controlName)?.markAsTouched());
    this.estadoMensaje = "Revise los campos obligatorios del paso";
    this.estadoDetalle = `Campos con error: ${camposConError.join(", ")}.`;
    return false;
  }

  formulario: FormGroup = new FormGroup({
    nit: new FormControl('', [Validators.required, Validators.pattern(NIT)]),
    digitoVerificacion: new FormControl('', Validators.pattern(DIGITO_VERIFICACION)),
    nitConfirmacion: new FormControl('', [Validators.required, Validators.pattern(NIT)]),
    procedencia: new FormControl<number | null>(null, Validators.required),
    razonSocial: new FormControl('', Validators.required),
    tipoDocumentoRepresentante: new FormControl<number | null>(null, Validators.required),
    documentoRepresentante: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    cargoRepresentante: new FormControl<number | null>(null, Validators.required),
    primerApellido: new FormControl('', Validators.required),
    segundoApellido: new FormControl(''),
    primerNombre: new FormControl('', Validators.required),
    segundoNombre: new FormControl(''),
    regimenContributivo: new FormControl<number | null>(null, Validators.required),
    sujetoRetencion: new FormControl<boolean | null>(null, Validators.required),
    agenteRetenedor: new FormControl<boolean | null>(null, Validators.required),
    responsableIca: new FormControl<boolean | null>(null, Validators.required),
    responsableIva: new FormControl<boolean | null>(null, Validators.required),
    clasificacionPyme: new FormControl<boolean | null>(null, Validators.required),
    registroMercantilActivo: new FormControl<boolean | null>(null, Validators.required),
    exclusividadImportacion: new FormControl<boolean | null>(null, Validators.required),
    calidadGranContribuyente: new FormControl<boolean | null>(null, Validators.required),
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
    extension: new FormControl('', Validators.pattern(SOLO_DIGITOS)),
    telefonoAlterno: new FormControl('', [Validators.required, Validators.pattern(TELEFONO)]),
    sitioWeb: new FormControl('', Validators.pattern(URL_HTTP)),
    contactoComercial: new FormControl(''),
    telefonoAsesor: new FormControl('', Validators.pattern(TELEFONO)),
    banco: new FormControl<number | null>(null, Validators.required),
    tipoCuenta: new FormControl<number | null>(null, Validators.required),
    numeroCuenta: new FormControl('', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    numeroCuentaConfirmacion: new FormControl('', [Validators.required, Validators.pattern(CUENTA_BANCARIA)]),
    tipoConformacion: new FormControl<number | null>(null, Validators.required),
    capitalAutorizado: new FormControl('', [Validators.required, Validators.pattern(SOLO_DIGITOS)]),
    correoPagos: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    correoPagosConfirmacion: new FormControl('', [Validators.required, Validators.pattern(CORREO)]),
    rutArchivo: new FormControl<File | null>(null, Validators.required),
    tieneRup: new FormControl<boolean>(false),
    rupArchivo: new FormControl<File | null>(null, requiereArchivoRup),
    actividadesCiiu: new FormControl<number[]>([], Validators.minLength(1)),
    actividadCiiuPrincipalId: new FormControl<number | null>(null, Validators.required),
    descripcionServicios: new FormControl('', validarTextoEnriquecido(2000)),
    aceptaTratamiento: new FormControl(false, Validators.requiredTrue),
  });

}