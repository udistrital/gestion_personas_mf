import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
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
} from "rxjs/operators";
import { BorradorRegistroService } from "../../services/borrador-registro.service";
import {
  CatalogosPersonaNaturalPaso1,
  CatalogosPersonaNaturalPaso2,
  OpcionNatural,
  RegistroPersonaNaturalCatalogosService,
} from "./registro-persona-natural-catalogos.service";

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
export class RegistroPersonaNaturalComponent implements OnInit, AfterViewInit {
  private static readonly SOLO_DIGITOS = /^\d+$/;
  private static readonly ALFANUMERICO = /^[A-Za-z0-9]+$/;
  private static readonly TELEFONO =
    /^\+?\d[\d\s().-]*(?:Ext\.\s*\d+)?$/;
  private readonly destroyRef = inject(DestroyRef);
  private readonly borradorRegistroService = inject(BorradorRegistroService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly catalogosService = inject(RegistroPersonaNaturalCatalogosService);

  catalogosPaso1: CatalogosPersonaNaturalPaso1 | null = null;
  estadoPaso1: EstadoCatalogoNatural = { cargando: false, error: null };
  catalogosPaso2: CatalogosPersonaNaturalPaso2 | null = null;
  estadoPaso2: EstadoCatalogoNatural = { cargando: false, error: null };

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

  readonly pasosStepper = [
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

  personaNaturalForm: FormGroup;

  ngAfterViewInit(): void {
    this.alinearBarraAcciones();
  }

  @HostListener("window:resize")
  onWindowResize(): void {
    this.alinearBarraAcciones();
  }

  private alinearBarraAcciones(): void {
    const raiz = this.elementRef.nativeElement;

    const contenedor = raiz.querySelector(
      ".registro-persona-natural-contenido"
    ) as HTMLElement | null;

    const barra = raiz.querySelector(
      "barra-acciones-formulario"
    ) as HTMLElement | null;

    if (!contenedor || !barra) {
      return;
    }

    const rect = contenedor.getBoundingClientRect();

    barra.style.setProperty("left", `${rect.left}px`, "important");
    barra.style.setProperty("width", `${rect.width}px`, "important");
    barra.style.setProperty("right", "auto", "important");
    barra.style.setProperty("transform", "none", "important");

  }

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

        indiceLiquidezReferencial: [
          {
            value: "",
            disabled: true,
          },
        ],
      }),

      // =======================================================
      // PASO 3 - DOCUMENTOS
      // =======================================================

      documentos: this.fb.group({
        // RUT
        rutArchivo: [null, Validators.required],
        rutNitCedula: [""],
        rutDv: ["", Validators.maxLength(1)],
        rutRazonSocialNombre: [""],
        rutResponsabilidades: [""],
        rutFechaGeneracion: [""],

        // RUP
        aplicaRup: ["", Validators.required],
        certificadoRup: [null],
        matriculaMercantil: [null],
        capacidadResidual: [""],
        fechaVencimientoRup: [""],
      }),

      // =======================================================
      // PASO 4 - ACTIVIDAD Y DECLARACIÓN
      // =======================================================

      actividadDeclaracion: this.fb.group({
        portafolioCapacidadEntrega: [
          "",
          Validators.maxLength(2000),
        ],

        consentimientoExpreso: [
          false,
          Validators.requiredTrue,
        ],

        declaracionJuramentada: [
          false,
          Validators.requiredTrue,
        ],
      }),
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
    void this.router.navigateByUrl("/proveedores");
  }

  ngOnInit(): void {
    this.restaurarBorrador();
    this.cargarCatalogosPaso1();
    this.cargarCatalogosPaso2();
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