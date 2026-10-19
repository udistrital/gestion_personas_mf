import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime } from "rxjs";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  BorradorSolicitudNueva,
  BorradorSolicitudService,
} from "../../../services/borrador-solicitud.service";
import { ResultadoCruce } from "../../../models/necesidad.model";
import { MIN_CARACTERES_CRITERIO, MIN_CARACTERES_PLAN } from "../../../models/datos-generales.model";
import { PASOS_SOLICITUD } from "./asistente-solicitud.const";
import { EstadoCruce } from "./paso-1-necesidad/paso-necesidad.component";
import {
  minCaracteres,
  validadorCronograma,
} from "./paso-2-datos-generales/paso-datos-generales.component";
import { alMenosUnItem } from "./paso-3-items/paso-items.component";
import { sumaPorcentajes } from "./paso-4-contratacion/paso-contratacion.component";

const PRIMER_PASO = 1;
const SEGUNDO_PASO = 2;
const TERCER_PASO = 3;
const CUARTO_PASO = 4;
const ULTIMO_PASO = 7;

/**
 * Asistente de nueva solicitud de cotización (S-02).
 *
 * Posee el `FormGroup` raíz —un subgrupo por paso—, el borrador automático y
 * la barra de acciones. Los pasos 1 (necesidad y presupuesto), 2 (datos
 * generales), 3 (bienes y servicios a cotizar) y 4 (tipo de contratación e
 * información de pago) están implementados en esta fase: el resto se muestra
 * como `paso-pendiente` y el avance queda bloqueado hasta que cada paso exija
 * sus validaciones.
 */
@Component({
  selector: "asistente-solicitud",
  templateUrl: "./asistente-solicitud.component.html",
  styleUrls: ["./asistente-solicitud.component.scss"],
  standalone: false,
})
export class AsistenteSolicitudComponent implements OnInit {
  readonly pasos = PASOS_SOLICITUD;

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Mis Solicitudes de Cotización › <b>Nueva solicitud</b></p>";

  readonly asistenteForm: FormGroup;

  /** Paso visible. */
  pasoActual = PRIMER_PASO;

  /** Último paso alcanzado; el stepper no permite saltarse los intermedios. */
  pasoAlcanzado = PRIMER_PASO;

  /** Estado del cruce con SICAPITAL (lo informa el paso 1). */
  readonly estadoCruce = signal<EstadoCruce>("inicial");

  /** true cuando el acuerdo marco (si lo hay) ya fue aceptado. */
  readonly acuerdoAceptado = signal(false);

  /** Resultado del cruce del paso 1; alimenta las tarjetas de solo lectura del paso 2. */
  readonly resultadoCruce = signal<ResultadoCruce | null>(null);

  /** true cuando al entrar había un borrador persistido en el equipo. */
  readonly borradorRestaurado = signal(false);

  /** Textos del bloque de estado de la barra de acciones. */
  estadoMensaje = "Borrador de solicitud autoguardado";
  estadoDetalle =
    "Los cambios se guardan automáticamente en este equipo · Sesión cifrada SSL 256-bit Universidad Distrital";

  constructor(
    fb: FormBuilder,
    private readonly borrador: BorradorSolicitudService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.asistenteForm = fb.group({
      // Paso 1 (implementado)
      necesidad: fb.group({
        unidadEjecutora: ["", Validators.required],
        vigencia: ["", Validators.required],
        numeroNecesidad: ["", Validators.required],
      }),
      // Paso 2 (implementado)
      datosGenerales: fb.group(
        {
          dependenciaSolicitante: ["", Validators.required],
          dependenciaDestino: ["", Validators.required],
          fechaApertura: ["", Validators.required],
          fechaCierre: ["", Validators.required],
          criterioSeleccion: ["", minCaracteres(MIN_CARACTERES_CRITERIO)],
          planAccion: ["", minCaracteres(MIN_CARACTERES_PLAN)],
        },
        { validators: validadorCronograma() },
      ),
      // Pasos 3 en adelante: se habilitan con su implementación.
      items: fb.group(
        {
          modo: ["individual", Validators.required],
          archivo: [""],
          procesado: [false],
          registros: [[]],
        },
        { validators: alMenosUnItem() },
      ),
      // Paso 4 (implementado)
      contratacion: fb.group(
        {
          tipoContrato: ["", Validators.required],
          medioPago: ["", Validators.required],
          formaPago: ["", Validators.required],
          // Arreglo plano de parámetros de pago; el validador de grupo exige
          // que sumen exactamente 100 %.
          parametros: [[]],
        },
        { validators: sumaPorcentajes() },
      ),
      proveedores: fb.group({}),
      documentos: fb.group({}),
      revision: fb.group({}),
    });

    // Se restaura en el constructor para que los valores ya estén puestos
    // antes de que el paso 1 se instancie y dispare el cruce.
    this.restaurarBorrador();
  }

  ngOnInit(): void {
    this.asistenteForm.valueChanges
      .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.guardarBorrador(true));
  }

  get necesidadForm(): FormGroup {
    return this.asistenteForm.get("necesidad") as FormGroup;
  }

  get datosGeneralesForm(): FormGroup {
    return this.asistenteForm.get("datosGenerales") as FormGroup;
  }

  get itemsForm(): FormGroup {
    return this.asistenteForm.get("items") as FormGroup;
  }

  get contratacionForm(): FormGroup {
    return this.asistenteForm.get("contratacion") as FormGroup;
  }

  /** Siguiente componente según el paso activo. */
  get nombrePasoActual(): string {
    return (
      this.pasos.find((paso) => paso.numero === this.pasoActual)?.nombre ?? ""
    );
  }

  /** Paso resaltado en rojo cuando el cruce con SICAPITAL falló. */
  get pasoConError(): number | null {
    return this.estadoCruce() === "error" && this.pasoActual === PRIMER_PASO
      ? PRIMER_PASO
      : null;
  }

  /**
   * Habilita "Continuar": el paso 1 avanza cuando la necesidad es válida, el
   * cruce terminó bien y el acuerdo marco está aceptado (cuando aplica); el
   * paso 2, cuando su formulario (dependencias, cronograma y editores) es válido.
   */
  get pasoValido(): boolean {
    if (this.pasoActual === PRIMER_PASO) {
      return (
        !!this.necesidadForm.valid &&
        this.estadoCruce() === "cargado" &&
        this.acuerdoAceptado()
      );
    }
    if (this.pasoActual === SEGUNDO_PASO) {
      return !!this.datosGeneralesForm.valid;
    }
    if (this.pasoActual === TERCER_PASO) {
      return !!this.itemsForm.valid;
    }
    if (this.pasoActual === CUARTO_PASO) {
      return !!this.contratacionForm.valid;
    }
    return false;
  }

  /** Motivo por el que "Continuar" está deshabilitado (título del botón). */
  get ayudaContinuar(): string {
    if (this.pasoActual === SEGUNDO_PASO) {
      return this.ayudaPaso2();
    }
    if (this.pasoActual === TERCER_PASO) {
      return this.ayudaPaso3();
    }
    if (this.pasoActual === CUARTO_PASO) {
      return this.ayudaPaso4();
    }
    if (this.pasoActual !== PRIMER_PASO) {
      return "Este paso aún no está implementado en esta fase del desarrollo.";
    }
    switch (this.estadoCruce()) {
      case "error":
        return "Acción bloqueada: debe resolver la sincronización con SICAPITAL.";
      case "cargando":
        return "Espere a que finalice el cruce con SICAPITAL.";
      case "inicial":
        return "Seleccione la necesidad presupuestal para validar el paso.";
      case "cargado":
        break;
    }
    if (!this.necesidadForm.valid) {
      return "Complete los campos obligatorios del paso 1.";
    }
    if (!this.acuerdoAceptado()) {
      return "Debe aceptar el acuerdo marco para continuar.";
    }
    return "";
  }

  /** Explica el bloqueo del paso 2 según el primer error encontrado. */
  private ayudaPaso2(): string {
    const form = this.datosGeneralesForm;
    if (form.get("dependenciaSolicitante")?.invalid) {
      return "Seleccione la dependencia solicitante.";
    }
    if (form.get("dependenciaDestino")?.invalid) {
      return "Seleccione la dependencia destino.";
    }
    if (!form.get("fechaApertura")?.value) {
      return "Indique la fecha de apertura del proceso.";
    }
    if (!form.get("fechaCierre")?.value) {
      return "Indique la fecha de cierre del proceso.";
    }
    if (form.hasError("cronogramaInsuficiente")) {
      return "El cierre debe estar al menos 3 días hábiles después de la apertura.";
    }
    if (form.get("criterioSeleccion")?.invalid) {
      return `El criterio de selección requiere al menos ${MIN_CARACTERES_CRITERIO} caracteres.`;
    }
    if (form.get("planAccion")?.invalid) {
      return `El plan de acción requiere al menos ${MIN_CARACTERES_PLAN} caracteres.`;
    }
    return "";
  }

  /** Explica el bloqueo del paso 3 (siempre: falta al menos un ítem). */
  private ayudaPaso3(): string {
    return "Agregue al menos un ítem al pliego de cotización para continuar.";
  }

  /** Explica el bloqueo del paso 4 según el primer error encontrado. */
  private ayudaPaso4(): string {
    const form = this.contratacionForm;
    if (form.get("tipoContrato")?.invalid) {
      return "Seleccione el tipo de contratación asociada.";
    }
    if (form.get("medioPago")?.invalid) {
      return "Seleccione el medio de pago autorizado por la Tesorería.";
    }
    if (form.get("formaPago")?.invalid) {
      return "Seleccione la forma de pago del contrato.";
    }
    if (form.hasError("sinParametros")) {
      return "Agregue al menos un parámetro de la forma de pago.";
    }
    if (form.hasError("sumaPorcentajes")) {
      const error = form.getError("sumaPorcentajes") as { total: number };
      return `Los porcentajes deben sumar exactamente 100 % (actual: ${error.total} %).`;
    }
    return "";
  }

  /** El stepper delega en este método; solo se llega a pasos alcanzados. */
  irAlPaso(paso: number): void {
    if (paso < PRIMER_PASO || paso > ULTIMO_PASO || paso > this.pasoAlcanzado) {
      return;
    }
    this.pasoActual = paso;
  }

  /** Avanza tras validar el paso 1 (los demás pasos no avanzan aún). */
  continuar(): void {
    if (!this.pasoValido) {
      this.asistenteForm.markAllAsTouched();
      return;
    }
    this.pasoActual = Math.min(ULTIMO_PASO, this.pasoActual + 1);
    this.pasoAlcanzado = Math.max(this.pasoAlcanzado, this.pasoActual);
    this.guardarBorrador(true);
  }

  /** Vuelve al paso anterior o al listado desde el paso 1. */
  regresar(): void {
    if (this.pasoActual > PRIMER_PASO) {
      this.pasoActual -= 1;
      return;
    }
    void this.router.navigate(["cotizaciones", "solicitudes"]);
  }

  alCambiarEstadoCruce(estado: EstadoCruce): void {
    this.estadoCruce.set(estado);
  }

  alCambiarAcuerdo(aceptado: boolean): void {
    this.acuerdoAceptado.set(aceptado);
  }

  alCambiarResultadoCruce(resultado: ResultadoCruce | null): void {
    this.resultadoCruce.set(resultado);
  }

  guardarBorrador(automatico = false): void {
    const borrador: BorradorSolicitudNueva = {
      version: 1,
      currentStep: this.pasoActual,
      savedAt: new Date().toISOString(),
      formValue: this.asistenteForm.getRawValue() as Record<string, unknown>,
    };

    if (!this.borrador.guardar(borrador)) {
      this.estadoMensaje = "No fue posible guardar el borrador";
      this.estadoDetalle =
        "El almacenamiento del navegador no está disponible; continúe sin autoguardado.";
      return;
    }

    const hora = new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    this.estadoMensaje = automatico
      ? "Borrador de solicitud autoguardado"
      : "Borrador de solicitud guardado";
    this.estadoDetalle = `Hoy a las ${hora} · Sesión cifrada SSL 256-bit Universidad Distrital`;

    if (!automatico) {
      void this.alerta.showAlert(
        "Borrador guardado",
        "Puede cerrar el asistente y retomarlo más tarde: el avance y los datos diligenciados quedan guardados en este equipo.",
      );
    }
  }

  /** Borra el borrador restaurado y vuelve al estado inicial del paso 1. */
  descartarBorrador(): void {
    this.borrador.eliminar();
    this.asistenteForm.reset({
      necesidad: { unidadEjecutora: "", vigencia: "", numeroNecesidad: "" },
      datosGenerales: {
        dependenciaSolicitante: "",
        dependenciaDestino: "",
        fechaApertura: "",
        fechaCierre: "",
        criterioSeleccion: "",
        planAccion: "",
      },
      items: {
        modo: "individual",
        archivo: "",
        procesado: false,
        registros: [],
      },
      contratacion: {
        tipoContrato: "",
        medioPago: "",
        formaPago: "",
        parametros: [],
      },
      proveedores: {},
      documentos: {},
      revision: {},
    });

    this.pasoActual = PRIMER_PASO;
    this.pasoAlcanzado = PRIMER_PASO;
    this.estadoCruce.set("inicial");
    this.acuerdoAceptado.set(false);
    this.resultadoCruce.set(null);
    this.borradorRestaurado.set(false);
    this.estadoMensaje = "Borrador de solicitud autoguardado";
    this.estadoDetalle =
      "Los cambios se guardan automáticamente en este equipo · Sesión cifrada SSL 256-bit Universidad Distrital";
  }

  private restaurarBorrador(): void {
    const borrador = this.borrador.cargar();
    if (!borrador) {
      return;
    }

    this.asistenteForm.patchValue(borrador.formValue);
    this.pasoAlcanzado = Math.min(
      ULTIMO_PASO,
      Math.max(PRIMER_PASO, borrador.currentStep || PRIMER_PASO),
    );
    this.pasoActual = PRIMER_PASO;
    this.borradorRestaurado.set(true);

    const guardado = new Date(borrador.savedAt);
    this.estadoMensaje = "Borrador de solicitud restaurado";
    this.estadoDetalle = isNaN(guardado.getTime())
      ? "Última edición desconocida · Sesión cifrada SSL 256-bit"
      : `Última edición: ${guardado.toLocaleString("es-CO")} · Sesión cifrada SSL 256-bit`;
  }
}
