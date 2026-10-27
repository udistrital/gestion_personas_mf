import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  ACCIONES_SOLICITUD,
  AccionSolicitud,
} from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ResultadoResolverSolicitud,
} from "../../../resolvers/solicitud.resolver";
import {
  etiquetaUnidadEjecutora,
  SolicitudDetalle,
} from "../../../models/solicitud.model";
import {
  PESTANAS_DETALLE,
  PestanaDetalleMeta,
} from "./detalle-solicitud.const";
import { SolicitudDetalleStore } from "./solicitud-detalle.store";

/** Estados de vista del armazón del detalle. */
type EstadoVista = "listo" | "no-encontrada" | "error";

/**
 * Armazón del detalle de una solicitud (S-03).
 *
 * Carga la solicitud con `solicitudResolver` (una sola vez para todas las
 * pestañas), pinta el encabezado de página, la barra de las 7 pestañas y las
 * acciones según estado y rol, y deja el contenido a las pestañas hijas vía
 * `router-outlet`.
 *
 * Toda decisión por estado se resuelve en TypeScript con
 * `PermisosSolicitudService`; las plantillas de las pestañas no conocen estados.
 */
@Component({
  selector: "app-detalle-solicitud",
  templateUrl: "./detalle-solicitud.component.html",
  styleUrls: ["./detalle-solicitud.component.scss"],
  standalone: false,
  providers: [SolicitudDetalleStore],
})
export class DetalleSolicitudComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly store = inject(SolicitudDetalleStore);

  /** Catálogo de pestañas que pinta la barra. */
  readonly pestanas = PESTANAS_DETALLE;

  /** Ruta de navegación (mismo formato HTML que usa S-01). */
  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Detalle de la solicitud</b></p>";

  /** Acciones del menú "Más acciones" (etiquetas, iconos, peligro). */
  readonly ACCIONES = ACCIONES_SOLICITUD;

  /** Estado de vista de la página. */
  readonly vista = signal<EstadoVista>("listo");

  /** Mensaje de error cuando `vista() === 'error'`. */
  readonly mensajeError = signal("");

  /** Solicitud resuelta; `null` = no encontrada o error. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Acciones permitidas por el estado actual de la solicitud. */
  readonly acciones = computed<readonly AccionSolicitud[]>(() => {
    const solicitud = this.store.solicitud();
    if (!solicitud) {
      return [];
    }
    // `ver-detalle` apunta a esta misma pantalla: no tiene sentido en el menú.
    return this.permisos
      .accionesPermitidas(solicitud)
      .filter((accion) => accion !== "ver-detalle");
  });

  ngOnInit(): void {
    // El resolver ya dejó el resultado en los datos de la ruta.
    const resultado = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;

    if (resultado.estado === "ok") {
      this.store.establecer(resultado.solicitud);
      return;
    }

    this.store.establecer(null);
    this.vista.set(resultado.estado === "error" ? "error" : "no-encontrada");
    if (resultado.estado === "error") {
      this.mensajeError.set(resultado.mensaje);
    }
  }

  /** Contador visible de una pestaña; `null` si no lleva badge. */
  contadorDe(pestana: PestanaDetalleMeta): number | null {
    if (!pestana.contador) {
      return null;
    }
    return this.store.solicitud()?.contadores[pestana.contador] ?? null;
  }

  /** Etiqueta legible del tipo de cotización (formato del mockup de S-03). */
  etiquetaTipo(): string {
    const solicitud = this.store.solicitud();
    if (!solicitud) {
      return "—";
    }
    switch (solicitud.tipoCotizacion) {
      case "BIEN":
        return "Bienes";
      case "SERVICIO":
        return "Servicios";
      case "BIEN_Y_SERVICIO":
        return "Bienes y servicios";
    }
  }

  /** Etiqueta legible de la unidad ejecutora. */
  etiquetaUnidad(): string {
    const solicitud = this.store.solicitud();
    return solicitud ? etiquetaUnidadEjecutora(solicitud.unidadEjecutora) : "—";
  }

  /** true si la acción se pinta como destructiva. */
  esPeligro(accion: AccionSolicitud): boolean {
    return ACCIONES_SOLICITUD[accion].peligro === true;
  }

  /**
   * true si el estado permite abrir el foro de observaciones.
   *
   * "Ver observaciones" del encabezado es la acción `foro`; su visibilidad la
   * decide `PermisosSolicitudService` según el estado (y, más adelante, el rol).
   */
  readonly puedeVerObservaciones = computed<boolean>(() => {
    const solicitud = this.store.solicitud();
    return solicitud ? this.permisos.puede("foro", solicitud) : false;
  });

  /**
   * Ejecuta una acción del menú. Las pantallas aún no implementadas avisan por
   * `AlertService` (misma estrategia que S-01).
   */
  ejecutarAccion(accion: AccionSolicitud): void {
    const meta = ACCIONES_SOLICITUD[accion];
    if (meta.ruta) {
      const solicitud = this.store.solicitud();
      const comandos = meta.ruta
        .split("/")
        .map((segmento) => (segmento === ":id" ? solicitud?.id ?? "" : segmento));
      void this.router.navigate(comandos);
      return;
    }
    // TODO issue #34: destino aún no implementado (S-04…S-08).
    void this.alerta.showAlert(
      meta.etiqueta,
      "Esta pantalla aún no está implementada. Corresponde a una fase posterior del módulo.",
    );
  }

  /** Descarga provisional del expediente (no implementada). */
  descargarPdf(): void {
    // TODO issue #34: generación del PDF institucional pendiente.
    void this.alerta.showAlert(
      "Descargar solicitud (PDF)",
      "La generación del PDF institucional aún no está implementada. Corresponde a una fase posterior del módulo.",
    );
  }

  /** Vuelve al listado de solicitudes de cotización. */
  volver(): void {
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }

  /**
   * Reintenta la carga resolviendo de nuevo la solicitud.
   *
   * Se navega a la misma ruta con un parámetro de consulta distinto: al cambiar
   * la URL, el router vuelve a ejecutar `solicitudResolver` sin tocar la
   * configuración global del router.
   */
  reintentar(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }
}
