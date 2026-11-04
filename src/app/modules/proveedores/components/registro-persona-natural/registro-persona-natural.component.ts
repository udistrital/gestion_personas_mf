import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { asapScheduler, of, Subject } from "rxjs";
import {
  catchError,
  debounceTime,
  observeOn,
  switchMap,
  tap,
  timeout,
} from "rxjs/operators";
import { BorradorRegistroService } from "../../services/borrador-registro.service";
import {
  CatalogosPersonaNaturalPaso1,
  CatalogosPersonaNaturalPaso2,
  OpcionNatural,
  RegistroPersonaNaturalCatalogosService,
} from "./registro-persona-natural-catalogos.service";
import {
  mapearPersonaNaturalMid,
} from "../../services/gestion-personas-mid.mapper";
import {
  GestionPersonasMidService,
  ResultadoEnvioMid,
  resumirErrorMid,
  resumirRespuestaMid,
} from "../../services/gestion-personas-mid.service";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { ResumenRadicacionPersonaNatural } from "./registro-persona-natural-exito/registro-persona-natural-exito.model";
import { CIIU_PERSONA_NATURAL } from "./registro-persona-natural-paso-4/ciiu-persona-natural";

export interface EstadoCatalogoNatural {
  cargando: boolean;
  error: string | null;
}

export interface EstadoListaNatural extends EstadoCatalogoNatural {
  opciones: OpcionNatural[];
}

export type ClaveGeografiaNatural =
  | "departamentosExpedicion"
  | "ciudadesExpedicion"
  | "departamentosResidencia"
  | "ciudadesResidencia";

interface EnlaceGeografia {
  clave: ClaveGeografiaNatural;
  tipo: "D" | "C";
  entrada: Subject<{ id: unknown; limpiar: boolean }>;
  ultimoPadre: unknown;
  controlHijo: string | null;
}

@Component({
  selector: "app-registro-persona-natural",
  templateUrl: "./registro-persona-natural.component.html",
  styleUrls: ["./registro-persona-natural.component.scss"],
  standalone: false,
})
export class RegistroPersonaNaturalComponent implements OnInit {
  private static readonly SOLO_DIGITOS = /^\d+$/;
  private static readonly ALFANUMERICO = /^[A-Za-z0-9]+$/;
  private static readonly TELEFONO =
    /^\+?\d[\d\s().-]*(?:Ext\.\s*\d+)?$/;

  /**
   * Máximo de caracteres visibles de un texto enriquecido.
   *
   * El editor guarda HTML; contar el marcado haría que el límite se agotara
   * antes de tiempo. La validación usa el texto plano del editor.
   */
  private static maxTextoEnriquecido(maximo: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const texto = textoPlanoDesdeHtml(String(control.value ?? ""));
      return texto.length > maximo
        ? {
            maxlength: {
              requiredLength: maximo,
              actualLength: texto.length,
            },
          }
        : null;
    };
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly borradorRegistroService = inject(BorradorRegistroService);
  private readonly catalogosService = inject(RegistroPersonaNaturalCatalogosService);
  private readonly gestionPersonasMidService = inject(GestionPersonasMidService);

  catalogosPaso1: CatalogosPersonaNaturalPaso1 | null = null;
  estadoPaso1: EstadoCatalogoNatural = { cargando: false, error: null };
  catalogosPaso2: CatalogosPersonaNaturalPaso2 | null = null;
  estadoPaso2: EstadoCatalogoNatural = { cargando: false, error: null };

  /** Catálogo CIIU que alimenta el paso 4 y la constancia. */
  catalogoCiiu: OpcionNatural[] = [];
  estadoCiiu: EstadoCatalogoNatural = { cargando: false, error: null };

  readonly geografia: Record<ClaveGeografiaNatural, EstadoListaNatural> = {
    departamentosExpedicion: { opciones: [], cargando: false, error: null },
    ciudadesExpedicion: { opciones: [], cargando: false, error: null },
    departamentosResidencia: { opciones: [], cargando: false, error: null },
    ciudadesResidencia: { opciones: [], cargando: false, error: null },
  };

  private readonly enlaces: Record<ClaveGeografiaNatural, EnlaceGeografia> = {
    departamentosExpedicion: this.crearEnlace("departamentosExpedicion", "D", "identificacion.departamentoExpedicion"),
    ciudadesExpedicion: this.crearEnlace("ciudadesExpedicion", "C", "identificacion.ciudadExpedicion"),
    departamentosResidencia: this.crearEnlace("departamentosResidencia", "D", "residencia.departamentoResidencia"),
    ciudadesResidencia: this.crearEnlace("ciudadesResidencia", "C", "residencia.ciudadMunicipioResidencia"),
  };

  currentStep = 1;
  readonly totalSteps = 4;

  borradorRestaurado = false;
  estadoMensaje = "Aún no hay un borrador guardado";
  estadoDetalle =
    "Los cambios se guardarán en este navegador al escribir o al pulsar Guardar Borrador";
  private suspenderAutoguardado = false;
  private registroEnviandose = false;
  private registroProcesado = false;
  envioIndeterminado = false;
  proveedorMidId?: number;

  /** true cuando el MID confirmó el registro y debe mostrarse la constancia. */
  registroCompletado = false;
  /** Datos de la constancia; null mientras no se haya radicado. */
  resumenRadicacion: ResumenRadicacionPersonaNatural | null = null;

  /**
   * TEMPORAL: identifica la constancia abierta con datos de ejemplo desde el
   * paso 4. Permite volver al formulario sin navegar fuera del registro.
   */
  esConstanciaEjemplo = false;

  readonly pasosStepper: Array<{
    numero: number;
    nombre: string;
    subtitulo?: string;
  }> = [
    {
      numero: 1,
      nombre: "Identificación y Caracterización",
    },
    {
      numero: 2,
      nombre: "Afiliaciones y Finanzas",
    },
    {
      numero: 3,
      nombre: "Documentos y RUT",
    },
    {
      numero: 4,
      nombre: "Actividad y Declaración",
    },
  ];

  /** El paso 4 se muestra activo, con el sello de verificación y "Éxito". */
  readonly pasosStepperExito = this.pasosStepper.map((paso) =>
    paso.numero === this.totalSteps
      ? { ...paso, icono: "verified", subtitulo: "Éxito" }
      : paso,
  );

  personaNaturalForm: FormGroup;

  // =========================================================
  // PASO 1
  // =========================================================

  get identificacionForm(): FormGroup {
    return this.personaNaturalForm.get("identificacion") as FormGroup;
  }

  get caracterizacionForm(): FormGroup {
    return this.personaNaturalForm.get("caracterizacion") as FormGroup;
  }

  get experienciaForm(): FormGroup {
    return this.personaNaturalForm.get("experiencia") as FormGroup;
  }

  get tributarioForm(): FormGroup {
    return this.personaNaturalForm.get("tributario") as FormGroup;
  }

  get residenciaForm(): FormGroup {
    return this.personaNaturalForm.get("residencia") as FormGroup;
  }

  get contactoForm(): FormGroup {
    return this.personaNaturalForm.get("contacto") as FormGroup;
  }

  /** Respuesta del paso 1 sobre declaración de renta (fuente única). */
  get declaranteRenta(): boolean | null {
    return this.tributarioForm.get("declaranteRenta")?.value ?? null;
  }

  // =========================================================
  // PASO 2
  // =========================================================

  get afiliacionesFinanzasForm(): FormGroup {
    return this.personaNaturalForm.get("afiliacionesFinanzas") as FormGroup;
  }

  // =========================================================
  // PASO 3
  // =========================================================

  get documentosForm(): FormGroup {
    return this.personaNaturalForm.get("documentos") as FormGroup;
  }

  // =========================================================
  // PASO 4
  // =========================================================

  get actividadDeclaracionForm(): FormGroup {
    return this.personaNaturalForm.get("actividadDeclaracion") as FormGroup;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
  ) {
    this.personaNaturalForm = this.fb.group({
      // =======================================================
      // PASO 1 - IDENTIFICACIÓN
      // =======================================================

      identificacion: this.fb.group(
        {
          primerApellido: ["", Validators.required],
          segundoApellido: [""],
          primerNombre: ["", Validators.required],
          segundoNombre: [""],

          tipoDocumento: ["", Validators.required],
          confirmarTipoDocumento: ["", Validators.required],

          numeroDocumento: ["", Validators.required],
          confirmarNumeroDocumento: ["", Validators.required],

          dv: ["", Validators.maxLength(1)],

          fechaExpedicion: ["", Validators.required],
          paisExpedicion: ["", Validators.required],
          departamentoExpedicion: ["", Validators.required],
          ciudadExpedicion: ["", Validators.required],

          fechaNacimiento: ["", Validators.required],
          genero: ["", Validators.required],
          paisNacimiento: ["", Validators.required],

          perfilRolPrincipal: ["", Validators.required],
        },
        {
          validators: [
            this.camposCoinciden(
              "tipoDocumento",
              "confirmarTipoDocumento",
            ),
            this.camposCoinciden(
              "numeroDocumento",
              "confirmarNumeroDocumento",
            ),
          ],
        },
      ),

      // =======================================================
      // PASO 1 - CARACTERIZACIÓN
      // =======================================================

      caracterizacion: this.fb.group({
        grupoEtnico: ["", Validators.required],
        seReconoceComo: [""],
        orientacionSexual: [""],

        esMigrante: this.fb.control<boolean | null>(null, Validators.required),
        victimaConflictoArmado: this.fb.control<boolean | null>(null, Validators.required),

        tieneHijos: this.fb.control<boolean | null>(null, Validators.required),
        numeroHijos: ["", [Validators.min(0), Validators.pattern(/^\d+$/)]],

        esCabezaFamilia: this.fb.control<boolean | null>(null, Validators.required),
        esPep: this.fb.control<boolean | null>(null, Validators.required),
        personasACargo: this.fb.control<boolean | null>(null, Validators.required),

        estadoCivil: ["", Validators.required],
        discapacidad: ["", Validators.required],
      }),

      // =======================================================
      // PASO 1 - EXPERIENCIA
      // =======================================================

      experiencia: this.fb.group({
        experienciaLaboralTotal: [
          "",
          [Validators.required, Validators.min(0)],
        ],
        experienciaProfesional: [
          "",
          [Validators.required, Validators.min(0)],
        ],
      }),

      // =======================================================
      // PASO 1 - INFORMACIÓN TRIBUTARIA
      // =======================================================

      tributario: this.fb.group({
        declaranteRenta: this.fb.control<boolean | null>(null, Validators.required),
        medicinaPrepagada: this.fb.control<boolean | null>(null, Validators.required),
        cuentaAfc: this.fb.control<boolean | null>(null, Validators.required),
        responsableIva: this.fb.control<boolean | null>(null, Validators.required),
        resideFiscalmenteColombia: this.fb.control<boolean | null>(null, Validators.required),
        aportesPensionVoluntaria: this.fb.control<boolean | null>(null, Validators.required),
      }),

      // =======================================================
      // PASO 1 - RESIDENCIA Y DIRECCIÓN
      // =======================================================

      residencia: this.fb.group({
        departamentoResidencia: ["", Validators.required],
        ciudadMunicipioResidencia: ["", Validators.required],

        via: ["", Validators.required],
        detalleVia: ["", Validators.required],
        numeroCruce: ["", Validators.required],
        placaPuerta: ["", Validators.required],

        interior1: [""],
        detalleInterior: [""],
      }),

      // =======================================================
      // PASO 1 - CONTACTO
      // =======================================================

      contacto: this.fb.group(
        {
          correoElectronico: [
            "",
            [Validators.required, Validators.email],
          ],

          confirmarCorreoElectronico: [
            "",
            [Validators.required, Validators.email],
          ],

          telefonoCelular: [
            "",
            [
              Validators.required,
              Validators.pattern(
                RegistroPersonaNaturalComponent.TELEFONO,
              ),
            ],
          ],
          otroContacto: [
            "",
            [
              Validators.required,
              Validators.pattern(
                RegistroPersonaNaturalComponent.TELEFONO,
              ),
            ],
          ],

          extensionTelefonica: [""],

          sitioWebPortafolio: [
            "",
            Validators.pattern(/^https?:\/\/.+/),
          ],

          contactoEmergencia: [""],
          telefonoContactoEmergencia: [""],
        },
        {
          validators: [
            this.camposCoinciden(
              "correoElectronico",
              "confirmarCorreoElectronico",
            ),
          ],
        },
      ),

      // =======================================================
      // PASO 2 - AFILIACIONES Y FINANZAS
      // =======================================================

      afiliacionesFinanzas: this.fb.group({
        pensionadoAsignacionRetiro: ["", Validators.required],

        eps: ["", Validators.required],
        afp: ["", Validators.required],
        ccf: [""],

        entidadBancaria: ["", Validators.required],
        tipoCuenta: ["", Validators.required],
        numeroCuentaBancaria: ["", Validators.required],

        correoNotificacionesTesoreria: [
          "",
          [Validators.required, Validators.email],
        ],

        autorizacionGiro: [false],

        capitalAutorizadoPatrimonio: [
          "",
          Validators.required,
        ],
      }),

      // =======================================================
      // PASO 3 - DOCUMENTOS
      // =======================================================

      documentos: this.fb.group({
        // Declaración de Renta
        declaracionRentaArchivo: [null],

        // RUT
        rutArchivo: [null, Validators.required],
        rutNitCedula: [""],
        rutDv: ["", Validators.maxLength(1)],
        rutRazonSocialNombre: [""],
        rutResponsabilidades: [""],
        rutFechaGeneracion: [""],

        // RUP
        aplicaRup: ["no"],
        certificadoRup: [null],
      }),

      // =======================================================
      // PASO 4 - ACTIVIDAD Y DECLARACIÓN
      // =======================================================

      actividadDeclaracion: this.fb.group(
        {
          actividadesCiiu: this.fb.control<number[]>([]),
          actividadCiiuPrincipalId: this.fb.control<number | null>(null),

          portafolioCapacidadEntrega: [
            "",
            RegistroPersonaNaturalComponent.maxTextoEnriquecido(2000),
          ],

          consentimientoExpreso: [
            false,
            Validators.requiredTrue,
          ],
        },
        { validators: [this.validarCiiu.bind(this)] },
      ),
    });

    // =========================================================
    // VALIDACIÓN CONDICIONAL: NÚMERO DE HIJOS
    // =========================================================

    this.personaNaturalForm
      .get("identificacion.tipoDocumento")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sincronizarValidadoresDocumento();
      });

    this.personaNaturalForm
      .get("caracterizacion.tieneHijos")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tieneHijos) => {
        const numeroHijos = this.personaNaturalForm.get(
          "caracterizacion.numeroHijos",
        );

        if (this.esRespuestaAfirmativa(tieneHijos)) {
          numeroHijos?.setValidators([
            Validators.required,
            Validators.min(0),
            Validators.pattern(/^\d+$/),
          ]);
        } else {
          numeroHijos?.clearValidators();
          numeroHijos?.setValue("");
        }

        numeroHijos?.updateValueAndValidity();
      });

    this.personaNaturalForm
      .get("tributario.declaranteRenta")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sincronizarValidadoresDeclaracionRenta();
      });

    this.enlazarGeografia(
      this.enlaces.departamentosExpedicion,
      "identificacion.paisExpedicion",
    );
    this.enlazarGeografia(
      this.enlaces.ciudadesExpedicion,
      "identificacion.departamentoExpedicion",
    );
    this.enlazarGeografia(
      this.enlaces.ciudadesResidencia,
      "residencia.departamentoResidencia",
    );
    this.suscribirEnlace(this.enlaces.departamentosResidencia);
  }

  private crearEnlace(
    clave: ClaveGeografiaNatural,
    tipo: "D" | "C",
    controlHijo: string,
  ): EnlaceGeografia {
    return { clave, tipo, entrada: new Subject(), ultimoPadre: "", controlHijo };
  }

  private enlazarGeografia(enlace: EnlaceGeografia, controlPadre: string): void {
    this.suscribirEnlace(enlace);
    this.personaNaturalForm
      .get(controlPadre)
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => enlace.entrada.next({ id, limpiar: true }));
  }

  // Cada cambio de padre cancela la consulta anterior (switchMap) para evitar resultados obsoletos.
  private suscribirEnlace(enlace: EnlaceGeografia): void {
    const lista = this.geografia[enlace.clave];
    enlace.entrada
      .pipe(
        tap(({ id, limpiar }) => {
          enlace.ultimoPadre = id;
          lista.opciones = [];
          lista.error = null;
          lista.cargando = false;
          if (limpiar && enlace.controlHijo) {
            this.personaNaturalForm.get(enlace.controlHijo)?.setValue("");
          }
        }),
        switchMap(({ id }) => {
          if (typeof id !== "number") {
            return of(null);
          }
          lista.cargando = true;
          return this.catalogosService.obtenerHijos(id, enlace.tipo).pipe(
            observeOn(asapScheduler),
            catchError(() => {
              lista.error =
                enlace.tipo === "D"
                  ? "No fue posible cargar los departamentos. Intente nuevamente."
                  : "No fue posible cargar las ciudades. Intente nuevamente.";
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((opciones) => {
        lista.cargando = false;
        if (opciones) {
          lista.opciones = opciones;
        }
      });
  }

  reintentarGeografia(clave: ClaveGeografiaNatural): void {
    const enlace = this.enlaces[clave];
    if (this.geografia[clave].cargando) {
      return;
    }
    enlace.entrada.next({ id: enlace.ultimoPadre, limpiar: false });
  }

  private ubicacionesPaso1Cargadas = false;
  private tercerosPaso1Cargados = false;

  // Ubicaciones y Terceros se cargan de forma independiente; el reintento solo repite el origen que falló.
  cargarCatalogosPaso1(): void {
    if (this.estadoPaso1.cargando) {
      return;
    }
    this.estadoPaso1 = { cargando: true, error: null };
    const fallos: string[] = [];
    let pendientes = 0;
    const terminar = (): void => {
      pendientes--;
      if (pendientes > 0) {
        return;
      }
      this.estadoPaso1 = {
        cargando: false,
        error: fallos.length
          ? `No fue posible cargar: ${fallos.join(" y ")}. Intente nuevamente.`
          : null,
      };
    };
    const combinar = (parcial: Partial<CatalogosPersonaNaturalPaso1>): void => {
      this.catalogosPaso1 = {
        ...(this.catalogosPaso1 ?? this.catalogosPaso1Vacios()),
        ...parcial,
      };
    };

    if (!this.ubicacionesPaso1Cargadas) {
      pendientes++;
      this.catalogosService
        .obtenerCatalogosUbicacionesPaso1()
        .pipe(observeOn(asapScheduler), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (catalogos) => {
            this.ubicacionesPaso1Cargadas = true;
            combinar(catalogos);
            this.cargarGeografiaInicial(catalogos.paises);
            terminar();
          },
          error: () => {
            fallos.push("países, tipos de vía e interior (Ubicaciones)");
            terminar();
          },
        });
    }

    if (!this.tercerosPaso1Cargados) {
      pendientes++;
      this.catalogosService
        .obtenerCatalogosTercerosPaso1()
        .pipe(observeOn(asapScheduler), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (catalogos) => {
            this.tercerosPaso1Cargados = true;
            combinar(catalogos);
            this.sincronizarValidadoresCondicionales();
            terminar();
          },
          error: () => {
            fallos.push("catálogos de identificación, caracterización y tributario (Terceros)");
            terminar();
          },
        });
    }

    if (pendientes === 0) {
      this.estadoPaso1 = { cargando: false, error: null };
    }
  }

  private catalogosPaso1Vacios(): CatalogosPersonaNaturalPaso1 {
    return {
      tiposDocumento: [], paises: [], genero: [], perfilRolPrincipal: [],
      grupoEtnico: [], seReconoceComo: [], orientacionSexual: [],
      estadoCivil: [], discapacidad: [],
      tiposVia: [], tiposInterior: [],
    };
  }

  cargarCatalogosPaso2(): void {
    if (this.estadoPaso2.cargando) {
      return;
    }
    this.estadoPaso2 = { cargando: true, error: null };
    this.catalogosService
      .obtenerCatalogosPaso2()
      .pipe(observeOn(asapScheduler), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogos) => {
          this.catalogosPaso2 = catalogos;
          this.estadoPaso2 = { cargando: false, error: null };
        },
        error: () => {
          this.estadoPaso2 = {
            cargando: false,
            error:
              "No fue posible cargar los catálogos de afiliaciones y finanzas. Intente nuevamente.",
          };
        },
      });
  }

  cargarCatalogoCiiu(): void {
    if (this.estadoCiiu.cargando) {
      return;
    }
    this.estadoCiiu = { cargando: true, error: null };
    console.info("[CIIU] Carga del catálogo iniciada.");

    this.catalogosService
      .obtenerCatalogoCiiu()
      .pipe(
        timeout(60000),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (catalogo) => {
          this.catalogoCiiu = catalogo;
          this.estadoCiiu = { cargando: false, error: null };
          // Revalida el paso 4: un borrador puede traer IDs que ya no existen.
          this.actividadDeclaracionForm?.updateValueAndValidity();
          // El catálogo llega en un callback asíncrono; se fuerza la
          // detección para que el paso 4 salga inmediatamente del estado de
          // carga en cuanto los datos están disponibles.
          this.cdr.detectChanges();
          console.info(
            `[CIIU] Catálogo cargado: ${catalogo.length} actividades.`,
          );
        },
        error: (error: unknown) => {
          this.estadoCiiu = {
            cargando: false,
            error:
              "No fue posible cargar el catálogo de actividades económicas CIIU. Intente nuevamente.",
          };
          this.cdr.detectChanges();
          console.error("[CIIU] Error al cargar el catálogo:", error);
        },
      });
  }

  // Recupera las listas dependientes de un borrador restaurado y fija Colombia para la residencia.
  private cargarGeografiaInicial(paises: OpcionNatural[]): void {
    const valor = (ruta: string): unknown => this.personaNaturalForm.get(ruta)?.value;
    this.enlaces.departamentosExpedicion.entrada.next({
      id: valor("identificacion.paisExpedicion"),
      limpiar: false,
    });
    this.enlaces.ciudadesExpedicion.entrada.next({
      id: valor("identificacion.departamentoExpedicion"),
      limpiar: false,
    });
    this.enlaces.ciudadesResidencia.entrada.next({
      id: valor("residencia.departamentoResidencia"),
      limpiar: false,
    });
    const colombia = paises.find(
      (pais) => this.normalizar(pais.nombre) === "colombia",
    );
    this.enlaces.departamentosResidencia.entrada.next({
      id: colombia?.id ?? "",
      limpiar: false,
    });
    if (!colombia) {
      this.geografia.departamentosResidencia.error =
        "No se encontró Colombia en el catálogo de países; no es posible cargar los departamentos de residencia.";
    }
  }

  private normalizar(texto: unknown): string {
    return typeof texto === "string"
      ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
      : "";
  }

  private esRespuestaAfirmativa(valor: unknown): boolean {
    return valor === true;
  }

  private codigoTipoDocumento(id: unknown): string | undefined {
    return this.catalogosPaso1?.tiposDocumento.find((o) => o.id === id)?.codigo;
  }

  regresarARegistroInicial(): void {
    void this.router.navigateByUrl("/proveedores/registro-inicio-persona");
  }

  // =========================================================
  // TEMPORAL: VISTA PREVIA DE LA CONSTANCIA
  // =========================================================
  // Permite revisar el diseño de la constancia desde el paso 4 con datos de
  // ejemplo, sin enviar el registro al MID. Eliminar este bloque y el botón
  // "Ver constancia de ejemplo" cuando ya no se necesite.

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

  private crearResumenEjemplo(): ResumenRadicacionPersonaNatural {
    const ciiu =
      CIIU_PERSONA_NATURAL.find((actividad) => actividad.principal)
      ?? CIIU_PERSONA_NATURAL[0];
    const secundarias = CIIU_PERSONA_NATURAL
      .filter((actividad) => !actividad.principal)
      .map((actividad) => `CIIU ${actividad.codigo} - ${actividad.nombre}`);
    return {
      nombreCompleto: "Carlos Julián González Parra",
      tipoDocumento: "C.C.",
      numeroDocumento: "1.018.472.930",
      ciudadExpedicion: "Bogotá D.C.",
      tipoSolicitante: "Persona Natural - Contratista de Servicios",
      ciiuPrincipal: ciiu
        ? `CIIU ${ciiu.codigo} - ${ciiu.nombre}`
        : "No registrada",
      ciiuSecundarias: secundarias,
      correoPersonal: "cjgonzalezp@udistrital.edu.co",
      correoTesoreria: "pagos.contratos@udistrital.edu.co",
      radicado: "RUPBP-74526255769",
      fechaRadicacion: new Date(),
      hash: null,
      proveedorId: 74526255769,
      parcial: false,
    };
  }

  ngOnInit(): void {
    this.restaurarBorrador();
    this.cargarCatalogosPaso1();
    this.cargarCatalogosPaso2();
    this.cargarCatalogoCiiu();
    this.personaNaturalForm.valueChanges
      .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistirBorrador(true));
  }

  // =========================================================
  // PASO 3 - DOCUMENTOS
  // =========================================================

  // =========================================================
  // NAVEGACIÓN
  // =========================================================

  continuar(): void {
    if (!this.validarPasoActual()) {
      this.marcarPasoActualComoTouched();
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.persistirBorrador(true);
    }
  }

  finalizarRegistro(): void {
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
    if (this.personaNaturalForm.invalid) {
      this.personaNaturalForm.markAllAsTouched();
      this.estadoMensaje = "No se puede finalizar el registro";
      this.estadoDetalle = "Revise los campos obligatorios del formulario.";
      return;
    }

    let mapeo: ReturnType<typeof mapearPersonaNaturalMid>;
    try {
      mapeo = mapearPersonaNaturalMid(this.personaNaturalForm.getRawValue());
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
      .registrarPersonaNatural(mapeo.payload)
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

  /**
   * Sustituye el formulario del paso 4 por la constancia de radicación y
   * cierra el borrador: un registro ya enviado no debe restaurarse al volver.
   */
  private prepararConstancia(resultado: ResultadoEnvioMid): void {
    const resumen = this.construirResumenRadicacion(resultado);
    this.resumenRadicacion = resumen;
    this.registroCompletado = true;
    this.borradorRestaurado = false;
    this.suspenderAutoguardado = true;
    this.borradorRegistroService.eliminar();

    void this.calcularHashRadicacion(resumen).then((hash) => {
      if (this.resumenRadicacion === resumen) {
        this.resumenRadicacion = { ...resumen, hash };
      }
    });
  }

  private construirResumenRadicacion(
    resultado: ResultadoEnvioMid,
  ): ResumenRadicacionPersonaNatural {
    const valores = this.personaNaturalForm.getRawValue() as Record<
      string,
      Record<string, unknown> | undefined
    >;
    const identificacion = valores["identificacion"] ?? {};
    const finanzas = valores["afiliacionesFinanzas"] ?? {};
    const contacto = valores["contacto"] ?? {};

    const nombreCompleto = [
      identificacion["primerNombre"],
      identificacion["segundoNombre"],
      identificacion["primerApellido"],
      identificacion["segundoApellido"],
    ]
      .map((parte) => String(parte ?? "").trim())
      .filter(Boolean)
      .join(" ");

    const actividadDeclaracion = valores["actividadDeclaracion"] ?? {};
    const idsCiiu = Array.isArray(actividadDeclaracion["actividadesCiiu"])
      ? actividadDeclaracion["actividadesCiiu"]
      : [];
    const principalId = actividadDeclaracion["actividadCiiuPrincipalId"];
    const seleccionadas = (idsCiiu as unknown[])
      .map((id) =>
        this.catalogoCiiu.find(
          (opcion) => String(opcion.id) === String(id),
        ),
      )
      .filter((opcion): opcion is OpcionNatural => opcion !== undefined);
    const principal =
      seleccionadas.find(
        (opcion) => String(opcion.id) === String(principalId),
      )
      ?? seleccionadas[0];
    const secundarias = seleccionadas
      .filter((opcion) => opcion.id !== principal?.id)
      .map((opcion) => this.etiquetaCiiu(opcion));
    const idRadicado = resultado.terceroId ?? resultado.proveedorId;

    return {
      nombreCompleto: nombreCompleto || "Sin nombre registrado",
      tipoDocumento: this.nombreTipoDocumento(identificacion["tipoDocumento"]),
      numeroDocumento: String(
        identificacion["numeroDocumento"] ?? "",
      ).trim(),
      ciudadExpedicion: this.nombreCiudadExpedicion(
        identificacion["ciudadExpedicion"],
      ),
      tipoSolicitante: this.nombreTipoSolicitante(
        identificacion["perfilRolPrincipal"],
      ),
      ciiuPrincipal: principal
        ? this.etiquetaCiiu(principal)
        : "No registrada",
      ciiuSecundarias: secundarias,
      correoPersonal: String(contacto["correoElectronico"] ?? "").trim(),
      correoTesoreria: String(
        finanzas["correoNotificacionesTesoreria"] ?? "",
      ).trim(),
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

  private nombreTipoDocumento(valor: unknown): string {
    const opcion = this.catalogosPaso1?.tiposDocumento.find(
      (tipo) => String(tipo.id) === String(valor),
    );
    return opcion?.nombre ?? this.codigoTipoDocumento(valor) ?? "Documento";
  }

  private nombreCiudadExpedicion(valor: unknown): string {
    return (
      this.geografia.ciudadesExpedicion.opciones.find(
        (ciudad) => String(ciudad.id) === String(valor),
      )?.nombre ?? ""
    );
  }

  private nombreTipoSolicitante(valor: unknown): string {
    const nombre = this.catalogosPaso1?.perfilRolPrincipal
      .find((perfil) => String(perfil.id) === String(valor))
      ?.nombre?.trim();
    if (!nombre) {
      return "Persona Natural";
    }
    return nombre.toLowerCase().includes("persona natural")
      ? nombre
      : `Persona Natural - ${nombre}`;
  }

  private etiquetaCiiu(opcion: OpcionNatural): string {
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
    resumen: ResumenRadicacionPersonaNatural,
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

  regresar(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.persistirBorrador(true);
    }
  }

  irAlPaso(paso: number): void {
    if (paso < 1 || paso > this.totalSteps) {
      return;
    }
    if (paso < this.currentStep) {
      this.currentStep = paso;
      this.persistirBorrador(true);
      return;
    }

    // Avanzar solo es posible validando cada paso intermedio, igual que el botón Continuar.
    while (this.currentStep < paso) {
      const pasoPrevio = this.currentStep;
      this.continuar();
      if (this.currentStep === pasoPrevio) {
        break;
      }
    }
  }

  guardarBorrador(): void {
    this.persistirBorrador(false);
  }

  descartarBorrador(): void {
    this.suspenderAutoguardado = true;
    this.borradorRegistroService.eliminar();
    this.borradorRestaurado = false;
    this.personaNaturalForm.reset();
    this.currentStep = 1;
    this.estadoMensaje = "Borrador descartado";
    this.estadoDetalle =
      "Puede empezar de nuevo. Los cambios nuevos se guardarán en este navegador.";

    setTimeout(() => {
      this.suspenderAutoguardado = false;
    }, 900);
  }

  // =========================================================
  // VALIDACIÓN DE PASOS
  // =========================================================

  private validarPasoActual(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.validarPasoUno();

      case 2:
        return this.afiliacionesFinanzasForm.valid;

      case 3:
        return this.documentosForm.valid;

      case 4:
        return this.actividadDeclaracionForm.valid;

      default:
        return false;
    }
  }

  private validarPasoUno(): boolean {
    const gruposPasoUno = [
      "identificacion",
      "caracterizacion",
      "experiencia",
      "tributario",
      "residencia",
      "contacto",
    ];

    return gruposPasoUno.every(
      (nombreGrupo) =>
        this.personaNaturalForm.get(nombreGrupo)?.valid ?? false,
    );
  }

  /**
   * Exige al menos una actividad CIIU y que la principal esté dentro de la
   * selección. Los IDs viven en el formulario porque el paso 4 los administra.
   */
  private validarCiiu(group: AbstractControl): ValidationErrors | null {
    const seleccion = group.get("actividadesCiiu")?.value;
    const principal = group.get("actividadCiiuPrincipalId")?.value;
    const ids: unknown[] = Array.isArray(seleccion) ? seleccion : [];

    if (ids.length === 0) {
      return { ciiuSinActividades: true };
    }

    // Cuando el catálogo ya cargó, la selección debe seguir existiendo en él.
    if (this.catalogoCiiu.length > 0) {
      const existentes = new Set(this.catalogoCiiu.map((opcion) => opcion.id));
      if (ids.some((id) => !existentes.has(Number(id)))) {
        return { ciiuNoDisponible: true };
      }
    }

    if (!principal || !ids.includes(principal)) {
      return { ciiuSinPrincipal: true };
    }
    return null;
  }

  private marcarPasoActualComoTouched(): void {
    switch (this.currentStep) {
      case 1:
        this.marcarGruposPasoUnoComoTouched();
        break;

      case 2:
        this.afiliacionesFinanzasForm.markAllAsTouched();
        break;

      case 3:
        this.documentosForm.markAllAsTouched();
        break;

      case 4:
        this.actividadDeclaracionForm.markAllAsTouched();
        break;
    }
  }

  private marcarGruposPasoUnoComoTouched(): void {
    const gruposPasoUno = [
      "identificacion",
      "caracterizacion",
      "experiencia",
      "tributario",
      "residencia",
      "contacto",
    ];

    gruposPasoUno.forEach((nombreGrupo) => {
      this.personaNaturalForm
        .get(nombreGrupo)
        ?.markAllAsTouched();
    });
  }

  // =========================================================
  // ARCHIVOS
  // =========================================================

  seleccionarArchivo(
    controlName: string,
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    const control = this.documentosForm.get(controlName);

    if (!control) {
      return;
    }

    control.setValue(archivo);
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  obtenerNombreArchivo(controlName: string): string {
    const archivo = this.documentosForm.get(controlName)
      ?.value as File | null;

    return archivo?.name ?? "Ningún archivo seleccionado";
  }

  visualizarArchivo(controlName: string): void {
    const archivo = this.documentosForm.get(controlName)
      ?.value as File | null;

    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);

    window.open(url, "_blank");

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
  }

  descargarArchivo(controlName: string): void {
    const archivo = this.documentosForm.get(controlName)
      ?.value as File | null;

    if (!archivo) {
      return;
    }

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = archivo.name;
    enlace.click();

    URL.revokeObjectURL(url);
  }

  // =========================================================
  // BORRADOR
  // =========================================================

  private restaurarBorrador(): void {
    const borrador = this.borradorRegistroService.cargar();
    if (!borrador) {
      return;
    }

    this.personaNaturalForm.patchValue(borrador.formValue, {
      emitEvent: false,
    });
    this.sincronizarValidadoresCondicionales();
    this.currentStep = Math.min(
      Math.max(borrador.currentStep, 1),
      this.totalSteps,
    );
    this.borradorRestaurado = true;
    this.actualizarEstadoGuardado(borrador.savedAt, true);
  }

  private sincronizarValidadoresDocumento(): void {
    const tipoDocumento = this.personaNaturalForm.get(
      "identificacion.tipoDocumento",
    )?.value;

    const numeroDocumento = this.personaNaturalForm.get(
      "identificacion.numeroDocumento",
    );

    const confirmarNumeroDocumento = this.personaNaturalForm.get(
      "identificacion.confirmarNumeroDocumento",
    );

    const validator =
      ["CC", "CE"].includes(this.codigoTipoDocumento(tipoDocumento) ?? "")
        ? Validators.pattern(RegistroPersonaNaturalComponent.SOLO_DIGITOS)
        : Validators.pattern(RegistroPersonaNaturalComponent.ALFANUMERICO);

    numeroDocumento?.setValidators([
      Validators.required,
      validator,
    ]);

    confirmarNumeroDocumento?.setValidators([
      Validators.required,
      validator,
    ]);

    numeroDocumento?.updateValueAndValidity({
      emitEvent: false,
    });

    confirmarNumeroDocumento?.updateValueAndValidity({
      emitEvent: false,
    });
  }

  private sincronizarValidadoresCondicionales(): void {
    this.sincronizarValidadoresDocumento();
    this.sincronizarValidadoresDeclaracionRenta();

    const tieneHijos = this.personaNaturalForm.get(
      "caracterizacion.tieneHijos",
    )?.value;
    const numeroHijos = this.personaNaturalForm.get(
      "caracterizacion.numeroHijos",
    );

    if (this.esRespuestaAfirmativa(tieneHijos)) {
      numeroHijos?.setValidators([
        Validators.required,
        Validators.min(0),
        Validators.pattern(/^\d+$/),
      ]);
    } else {
      numeroHijos?.clearValidators();
      numeroHijos?.setValue("", { emitEvent: false });
    }

    numeroHijos?.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Exige el adjunto de la declaración de renta solo si el paso 1 indicó que
   * la persona es declarante. La pregunta no se duplica en el paso 3.
   */
  private sincronizarValidadoresDeclaracionRenta(): void {
    const declarante = this.personaNaturalForm.get(
      "tributario.declaranteRenta",
    )?.value;
    const adjunto = this.documentosForm.get("declaracionRentaArchivo");
    if (!adjunto) {
      return;
    }

    if (declarante === true) {
      adjunto.setValidators([Validators.required]);
    } else {
      adjunto.clearValidators();
      adjunto.setValue(null, { emitEvent: false });
    }
    adjunto.updateValueAndValidity({ emitEvent: false });
  }

  persistirBorrador(esAutoguardado: boolean): void {
    if (this.suspenderAutoguardado) {
      return;
    }

    const savedAt = new Date().toISOString();
    const ok = this.borradorRegistroService.guardar({
      version: 1,
      currentStep: this.currentStep,
      savedAt,
      formValue: this.personaNaturalForm.getRawValue() as Record<
        string,
        unknown
      >,
    });

    if (!ok) {
      this.estadoMensaje = "No se pudo guardar el borrador";
      this.estadoDetalle =
        "El almacenamiento del navegador no está disponible o está lleno.";
      return;
    }

    this.actualizarEstadoGuardado(savedAt, esAutoguardado);
  }

  private actualizarEstadoGuardado(
    savedAt: string,
    esAutoguardado: boolean,
  ): void {
    const momento = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(savedAt));

    this.estadoMensaje = esAutoguardado
      ? "Borrador Persona Natural autoguardado con éxito"
      : "Borrador Persona Natural guardado con éxito";
    this.estadoDetalle = `${momento} · Guardado en este navegador`;
  }

  // =========================================================
  // VALIDADORES
  // =========================================================

  private camposCoinciden(
    campoPrincipal: string,
    campoConfirmacion: string,
  ): ValidatorFn {
    return (
      control: AbstractControl,
    ): ValidationErrors | null => {
      const valorPrincipal =
        control.get(campoPrincipal)?.value;

      const valorConfirmacion =
        control.get(campoConfirmacion)?.value;

      if (!valorPrincipal || !valorConfirmacion) {
        return null;
      }

      return valorPrincipal === valorConfirmacion
        ? null
        : {
            camposNoCoinciden: {
              campoPrincipal,
              campoConfirmacion,
            },
          };
    };
  }
}