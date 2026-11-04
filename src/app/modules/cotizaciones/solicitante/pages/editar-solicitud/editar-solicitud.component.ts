import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { AlertService } from "src/app/shared/services/alert.service";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import type {
  ContextoEdicionSolicitud,
  ResultadoGuardadoSolicitud,
} from "../../../models/edicion-solicitud.model";
import {
  etiquetaUnidadEjecutora,
  SolicitudDetalle,
} from "../../../models/solicitud.model";
import { ReglasEdicionSolicitudService } from "../../../services/reglas-edicion-solicitud.service";
import { SolicitudesService } from "../../../services/solicitudes.service";

/** Estados de vista del armazón de edición (S-04). */
type EstadoVista =
  | "cargando"
  | "listo"
  | "no-encontrada"
  | "error"
  | "bloqueada";

/**
 * Armazón de la edición de una solicitud (S-04).
 *
 * Carga la solicitud, decide con `ReglasEdicionSolicitudService` si el estado y
 * el rol permiten modificarla y, cuando sí, monta el asistente de S-02 en modo
 * edición. Si el estado no admite cambios muestra la pantalla de bloqueo con el
 * motivo normativo, sin permitir llegar al formulario.
 *
 * El modo lo decide el estado real de la solicitud (no la ruta): entrar por
 * `/:id/editar` a una solicitud ya enviada abre la modificación restringida.
 */
@Component({
  selector: "editar-solicitud",
  templateUrl: "./editar-solicitud.component.html",
  styleUrls: ["./editar-solicitud.component.scss"],
  standalone: false,
})
export class EditarSolicitudComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly reglas = inject(ReglasEdicionSolicitudService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  /** Identificador de la solicitud que se está editando. */
  readonly solicitudId = this.ruta.snapshot.paramMap.get("id") ?? "";

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Mis Solicitudes de Cotización › <b>Modificar solicitud</b></p>";

  readonly vista = signal<EstadoVista>("cargando");

  /** Solicitud cargada (también se conserva en la pantalla de bloqueo). */
  readonly solicitud = signal<SolicitudDetalle | null>(null);

  /** Contexto que recibe el asistente reutilizado de S-02. */
  readonly contexto = signal<ContextoEdicionSolicitud | null>(null);

  readonly mensajeError = signal("");
  readonly tituloBloqueo = signal("Esta solicitud ya fue procesada");
  readonly motivoBloqueo = signal("");

  ngOnInit(): void {
    this.cargar();
  }

  /** Título visible de la cabecera según el modo habilitado. */
  get tituloPagina(): string {
    return this.contexto()?.modo === "restringida"
      ? "Solicitar modificación de la solicitud"
      : "Modificar borrador de solicitud";
  }

  /** Carga la solicitud y resuelve el modo de edición habilitado. */
  cargar(): void {
    this.vista.set("cargando");
    this.mensajeError.set("");
    this.contexto.set(null);

    this.solicitudes
      .obtenerPorId(this.solicitudId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitud) => {
          if (!solicitud) {
            this.solicitud.set(null);
            this.vista.set("no-encontrada");
            return;
          }
          this.evaluar(solicitud);
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar la solicitud. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /** Decide si la solicitud se puede editar y en qué modo. */
  private evaluar(solicitud: SolicitudDetalle): void {
    this.solicitud.set(solicitud);

    if (!this.reglas.puedeEditarPorRol()) {
      this.tituloBloqueo.set("No tiene permisos para modificar");
      this.motivoBloqueo.set(
        "Su rol no pertenece al área solicitante, que es la única habilitada para modificar solicitudes de cotización.",
      );
      this.vista.set("bloqueada");
      return;
    }

    const modo = this.reglas.modoEdicion(solicitud.estado);
    if (!modo) {
      this.tituloBloqueo.set("Esta solicitud ya fue procesada");
      this.motivoBloqueo.set(this.reglas.motivoBloqueo(solicitud.estado));
      this.vista.set("bloqueada");
      return;
    }

    if (!solicitud.edicion) {
      this.mensajeError.set(
        "La solicitud no tiene una versión editable disponible. Vuelva al detalle e intente de nuevo.",
      );
      this.vista.set("error");
      return;
    }

    this.contexto.set({
      solicitud,
      modo,
      valores: solicitud.edicion,
    });
    this.vista.set("listo");
  }

  /** Navega al detalle con el resultado del guardado (lo lee el diálogo S-04). */
  alGuardar(resultado: ResultadoGuardadoSolicitud): void {
    void this.router.navigate(["cotizaciones", "solicitudes", this.solicitudId], {
      state: { guardado: resultado },
    });
  }

  /** El asistente descartó los cambios: se vuelve al detalle sin aviso. */
  alDescartar(): void {
    this.volverAlDetalle();
  }

  volverAlDetalle(): void {
    void this.router.navigate(["cotizaciones", "solicitudes", this.solicitudId]);
  }

  volverAlListado(): void {
    void this.router.navigate(["cotizaciones", "solicitudes"]);
  }

  /** Etiqueta legible de la unidad ejecutora (cabecera de la pantalla bloqueada). */
  etiquetaUnidad(valor: string): string {
    return etiquetaUnidadEjecutora(valor);
  }

  /** Etiqueta visible del estado actual de la solicitud. */
  etiquetaEstado(): string {
    const solicitud = this.solicitud();
    return solicitud ? this.permisos.etiquetaEstado(solicitud.estado) : "—";
  }

  /**
   * Solicitud de excepción para estados bloqueados.
   *
   * La matriz de excepciones (RF-016) y la aprobación de S-08 aún no existen;
   * el botón informa el estado real en vez de simular un flujo inexistente.
   */
  solicitarExcepcion(): void {
    void this.alerta.showAlert(
      "Solicitud de excepción",
      "La modificación de solicitudes ya procesadas se gestiona con la Oficina de Contratación y se habilitará con la matriz de excepciones (RF-016).",
    );
  }
}
