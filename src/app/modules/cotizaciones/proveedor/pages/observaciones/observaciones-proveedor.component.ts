import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { ImplicitAutenticationService } from "src/app/core/services/implicit_autentication.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  AutorObservacion,
  NuevaObservacion,
  Observacion,
} from "../../../models/observacion.model";
import { DetalleInvitacionProveedor } from "../../../models/invitacion-proveedor.model";
import { ObservacionesService } from "../../../services/observaciones.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "../detalle-solicitud/detalle-proveedor.resolver";

type EstadoPagina = "cargando" | "listo" | "no-encontrada" | "error";

@Component({
  selector: "app-observaciones-proveedor",
  templateUrl: "./observaciones-proveedor.component.html",
  styleUrls: ["./observaciones-proveedor.component.scss"],
  standalone: false,
})
export class ObservacionesProveedorComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly observacionesService = inject(ObservacionesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly autenticacion = inject(ImplicitAutenticationService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly estado = signal<EstadoPagina>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly observaciones = signal<readonly Observacion[]>([]);
  readonly autorProveedor = signal<AutorObservacion | null>(null);
  readonly errorCarga = signal("");
  readonly errorDetalle = signal("");
  readonly cargandoObservaciones = signal(false);
  readonly enviando = signal(false);
  readonly errorEnvio = signal("");
  readonly mensajeExito = signal("");
  readonly enfocarId = signal<string | null>(null);
  readonly limpiarFormulario = signal(0);

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Solicitudes de cotización › <b>Observaciones</b></p>";

  get puedeObservar(): boolean {
    const detalle = this.detalle();
    return (
      !!detalle &&
      this.permisos.puedeFormularObservacion(
        detalle.invitacion,
        detalle.solicitud,
      )
    );
  }

  get fechaLimiteVencida(): boolean {
    const fecha = this.detalle()?.solicitud.fechaLimiteObservaciones;
    return !!fecha && Date.parse(fecha) <= Date.now();
  }

  ngOnInit(): void {
    const resultado = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;
    this.aplicarResultadoDetalle(resultado);
  }

  volverAlDetalle(): void {
    const id =
      this.detalle()?.solicitud.id ?? this.ruta.snapshot.paramMap.get("id");
    if (id) {
      void this.router.navigate(["/cotizaciones", "bandeja-solicitudes", id]);
    } else {
      void this.router.navigate(["/cotizaciones", "bandeja-solicitudes"]);
    }
  }

  reintentarDetalle(): void {
    const id = this.ruta.snapshot.paramMap.get("id");
    if (!id) {
      this.estado.set("no-encontrada");
      return;
    }
    this.estado.set("cargando");
    this.errorDetalle.set("");
    this.solicitudes
      .obtenerDetalleProveedor(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (!detalle) {
            this.detalle.set(null);
            this.estado.set("no-encontrada");
            return;
          }
          this.detalle.set(detalle);
          this.estado.set("listo");
          this.cargarObservaciones();
        },
        error: (error: Error) => {
          this.errorDetalle.set(error.message);
          this.estado.set("error");
        },
      });
  }

  cargarObservaciones(): void {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    this.cargandoObservaciones.set(true);
    this.errorCarga.set("");
    void this.listarObservacionesDelProveedor(detalle.solicitud.id);
  }

  /**
   * Lista únicamente el hilo del proveedor autenticado: sus observaciones y
   * las respuestas que el solicitante le haya dado. Las observaciones de los
   * demás invitados no son visibles para él.
   */
  private async listarObservacionesDelProveedor(
    solicitudId: string,
  ): Promise<void> {
    let autor: AutorObservacion;
    try {
      autor = await this.autorDelProveedor();
    } catch (error: unknown) {
      this.errorCarga.set(
        error instanceof Error
          ? error.message
          : "No fue posible identificar al proveedor autenticado.",
      );
      this.cargandoObservaciones.set(false);
      return;
    }

    this.observacionesService
      .listarObservaciones(solicitudId, autor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (observaciones) => {
          this.observaciones.set(observaciones);
          this.cargandoObservaciones.set(false);
        },
        error: (error: Error) => {
          this.errorCarga.set(
            error.message ||
              "No fue posible cargar las observaciones. Intente nuevamente.",
          );
          this.cargandoObservaciones.set(false);
        },
      });
  }

  registrarObservacion(entrada: NuevaObservacion): void {
    const detalle = this.detalle();
    if (!detalle || !this.puedeObservar || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.errorEnvio.set("");
    this.mensajeExito.set("");
    this.enfocarId.set(null);
    const elementoRetorno =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;

    void this.crearObservacion(detalle, entrada, elementoRetorno);
  }

  private aplicarResultadoDetalle(
    resultado: ResultadoResolverDetalleProveedor,
  ): void {
    if (resultado.estado === "ok") {
      this.detalle.set(resultado.detalle);
      this.estado.set("listo");
      this.cargarObservaciones();
    } else if (resultado.estado === "error") {
      this.errorDetalle.set(resultado.mensaje);
      this.estado.set("error");
    } else {
      this.estado.set("no-encontrada");
    }
  }

  private async crearObservacion(
    detalle: DetalleInvitacionProveedor,
    entrada: NuevaObservacion,
    elementoRetorno?: HTMLElement,
  ): Promise<void> {
    try {
      const autor = await this.autorDelProveedor();
      this.observacionesService
        .formularObservacion(
          detalle.solicitud,
          detalle.invitacion.estado,
          entrada,
          autor,
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (observacion) => {
            this.observaciones.update((actuales) =>
              [observacion, ...actuales].sort(
                (a, b) => Date.parse(b.fechaIso) - Date.parse(a.fechaIso),
              ),
            );
            this.limpiarFormulario.update((valor) => valor + 1);
            this.enviando.set(false);
            this.mensajeExito.set(
              "La observación se registró y ya aparece en su historial.",
            );
            void this.alerta
              .showObservacionRegistradaAlert(
                `Radicado: ${observacion.radicado}\nSolicitud: ${detalle.solicitud.id}\nFecha y hora: ${observacion.fecha}\nEstado inicial: Pendiente de respuesta.`,
                elementoRetorno,
              )
              .then(() => this.enfocarId.set(observacion.id));
          },
          error: (error: Error) => {
            this.errorEnvio.set(
              error.message ||
                "No fue posible registrar la observación. Intente nuevamente.",
            );
            this.enviando.set(false);
          },
        });
    } catch (error: unknown) {
      this.errorEnvio.set(
        error instanceof Error
          ? error.message
          : "No fue posible identificar al proveedor para registrar la observación.",
      );
      this.enviando.set(false);
    }
  }

  /** Identidad del proveedor autenticado, calculada una sola vez. */
  private async autorDelProveedor(): Promise<AutorObservacion> {
    const actual = this.autorProveedor();
    if (actual) {
      return actual;
    }
    const autor = await this.autorActual();
    this.autorProveedor.set(autor);
    return autor;
  }

  private async autorActual(): Promise<AutorObservacion> {
    const [correo, documento] = await Promise.all([
      this.autenticacion.getMail(),
      this.autenticacion.getDocument(),
    ]);
    const correoTexto = typeof correo === "string" ? correo.trim() : "";
    const documentoTexto =
      typeof documento === "string" || typeof documento === "number"
        ? String(documento).trim()
        : "";

    if (!correoTexto || !documentoTexto) {
      throw new Error(
        "No se encontró el correo y documento del proveedor autenticado.",
      );
    }

    return {
      nombre: correoTexto,
      tipo: /^NIT\b/i.test(documentoTexto)
        ? "persona-juridica"
        : "persona-natural",
      identificacion: documentoTexto,
    };
  }
}
