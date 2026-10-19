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
import { PASOS_SOLICITUD } from "./asistente-solicitud.const";
import { EstadoCruce } from "./paso-1-necesidad/paso-necesidad.component";

const PRIMER_PASO = 1;
const ULTIMO_PASO = 7;

/**
 * Asistente de nueva solicitud de cotización (S-02).
 *
 * Posee el `FormGroup` raíz —un subgrupo por paso—, el borrador automático y
 * la barra de acciones. Solo el paso 1 (necesidad y presupuesto) está
 * implementado en esta fase: el resto se muestra como `paso-pendiente` y el
 * avance queda bloqueado hasta que cada paso exija sus validaciones.
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
      // Pasos 2 a 7: creados por el diseño; se habilitan con su implementación.
      datosGenerales: fb.group({}),
      items: fb.group({}),
      contratacion: fb.group({}),
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
   * Habilita "Continuar": solo el paso 1 puede avanzar y únicamente cuando la
   * necesidad es válida, el cruce terminó bien y el acuerdo marco está
   * aceptado (cuando aplica).
   */
  get pasoValido(): boolean {
    if (this.pasoActual !== PRIMER_PASO) {
      return false;
    }
    return (
      !!this.necesidadForm.valid &&
      this.estadoCruce() === "cargado" &&
      this.acuerdoAceptado()
    );
  }

  /** Motivo por el que "Continuar" está deshabilitado (título del botón). */
  get ayudaContinuar(): string {
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
        "Puede cerrar el asistente y retomarlo más tarde: el avance y los criterios del paso 1 quedan guardados en este equipo.",
      );
    }
  }

  /** Borra el borrador restaurado y vuelve al estado inicial del paso 1. */
  descartarBorrador(): void {
    this.borrador.eliminar();
    this.asistenteForm.reset({
      necesidad: { unidadEjecutora: "", vigencia: "", numeroNecesidad: "" },
      datosGenerales: {},
      items: {},
      contratacion: {},
      proveedores: {},
      documentos: {},
      revision: {},
    });

    this.pasoActual = PRIMER_PASO;
    this.pasoAlcanzado = PRIMER_PASO;
    this.estadoCruce.set("inicial");
    this.acuerdoAceptado.set(false);
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
