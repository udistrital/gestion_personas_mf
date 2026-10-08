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
import { debounceTime } from "rxjs/operators";
import { BorradorRegistroService } from "../../services/borrador-registro.service";

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

        esMigrante: ["", Validators.required],
        victimaConflictoArmado: ["", Validators.required],

        tieneHijos: ["", Validators.required],
        numeroHijos: ["", [Validators.min(1), Validators.max(10)]],

        esCabezaFamilia: ["", Validators.required],
        esPep: ["", Validators.required],
        personasACargo: ["", Validators.required],

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
        declaranteRenta: ["", Validators.required],
        medicinaPrepagada: ["", Validators.required],
        cuentaAfc: ["", Validators.required],
        responsableIva: ["", Validators.required],
        resideFiscalmenteColombia: ["", Validators.required],
        aportesPensionVoluntaria: ["", Validators.required],
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
      ?.valueChanges.subscribe((tieneHijos) => {
        const numeroHijos = this.personaNaturalForm.get(
          "caracterizacion.numeroHijos",
        );

        if (tieneHijos === "si") {
          numeroHijos?.setValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(10),
          ]);
        } else {
          numeroHijos?.clearValidators();
          numeroHijos?.setValue("");
        }

        numeroHijos?.updateValueAndValidity();
      });
  }

  regresarARegistroInicial(): void {
    void this.router.navigateByUrl("/proveedores");
  }

  ngOnInit(): void {
    this.restaurarBorrador();
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

    // Solo permite volver a pasos ya alcanzados.
    if (paso <= this.currentStep) {
      this.currentStep = paso;
      this.persistirBorrador(true);
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
      tipoDocumento === "CC" || tipoDocumento === "CE"
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

    if (tieneHijos === "si") {
      numeroHijos?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(10),
      ]);
    } else {
      numeroHijos?.clearValidators();
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