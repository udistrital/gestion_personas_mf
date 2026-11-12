import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import type { PasoLineaEstados } from "src/app/shared/components/linea-estados/linea-estados.component";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type { DetalleInvitacionProveedor } from "../../../models/invitacion-proveedor.model";
import type { MiCotizacion } from "../../../models/mi-cotizacion.model";
import { construirMiCotizacion } from "../../../models/mi-cotizacion.model";
import type {
  BannerResultadoDatos,
  EstadoResultadoProveedor,
  ResultadoProveedor,
} from "../../../models/resultado-proveedor.model";
import { construirBannerResultado } from "../../../models/resultado-proveedor.model";
import { solicitudCerrada } from "../../../models/solicitud.model";
import { RespuestaProveedorService } from "../../../services/respuesta-proveedor.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "../detalle-solicitud/detalle-proveedor.resolver";

type EstadoVista = "cargando" | "listo" | "error" | "no-encontrada";

/** Estados que admiten volver a consultar el resultado. */
const ESTADOS_ACTUALIZABLES: readonly EstadoResultadoProveedor[] = [
  "en-validacion",
  "no-disponible",
];

/**
 * «Respuesta del solicitante» (P-07): resultado final del proceso para el
 * proveedor.
 *
 * Es una vista de solo lectura. No decide ni registra nada: consume la decisión
 * que ya produjo S-11 a través de `SolicitudesService.obtenerResultadoProveedor`
 * y el resumen de P-06. Toda la presentación sale de
 * `construirResultadoProveedor` y `construirBannerResultado`, de modo que la
 * plantilla no deriva reglas ni compara ofertas.
 *
 * Provisional: constancia PDF, firma digital, actas, puntajes, fechas
 * estimadas de publicación y mensaje personalizado a no seleccionados. Se
 * marcan en la vista con `etiqueta-por-definir`.
 */
@Component({
  selector: "app-resultado-proveedor",
  templateUrl: "./resultado-proveedor.component.html",
  styleUrls: ["./resultado-proveedor.component.scss"],
  standalone: false,
})
export class ResultadoProveedorComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly respuestas = inject(RespuestaProveedorService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vista = signal<EstadoVista>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly resultado = signal<ResultadoProveedor | null>(null);
  readonly cotizacion = signal<MiCotizacion | null>(null);
  readonly error = signal("");
  readonly errorCotizacion = signal("");
  readonly actualizando = signal(false);

  readonly datosBanner = computed<BannerResultadoDatos | null>(() => {
    const detalle = this.detalle();
    const resultado = this.resultado();
    if (!detalle || !resultado) {
      return null;
    }
    return construirBannerResultado(resultado, {
      titulo: detalle.solicitud.titulo,
      cierre: detalle.solicitud.cierre,
      criterioSeleccion:
        detalle.solicitud.general.caracteristicas.criterioSeleccion,
      proveedorNombre: detalle.proveedor.nombre,
      proveedorCorreo: detalle.proveedor.correo,
      radicado:
        this.cotizacion()?.radicado ??
        detalle.invitacion.respuestaVigente?.radicado ??
        null,
      total:
        this.cotizacion()?.totales.total ??
        detalle.invitacion.respuestaVigente?.total ??
        null,
    });
  });

  readonly pasos = computed<readonly PasoLineaEstados[]>(() => {
    const resultado = this.resultado();
    if (!resultado) {
      return [];
    }

    if (resultado.estado === "cancelada") {
      return construirPasos(
        ["Publicada", "Abierta", "Cerrada", "Cancelada"],
        3,
      );
    }
    if (resultado.estado === "en-validacion") {
      return construirPasos(
        [
          "Publicada",
          "Abierta",
          "Cerrada",
          "En validación",
          "Resultado",
        ],
        3,
      );
    }
    if (
      resultado.estado === "favorable" ||
      resultado.estado === "no-seleccionado" ||
      resultado.estado === "rechazada-ordenador"
    ) {
      return construirPasos(
        ["Publicada", "Abierta", "Cerrada", "En evaluación", "Resultado"],
        4,
      );
    }
    if (resultado.procesoAbierto) {
      return construirPasos(
        ["Publicada", "Abierta", "Cerrada", "En evaluación", "Resultado"],
        1,
      );
    }
    return construirPasos(
      ["Publicada", "Abierta", "Cerrada", "En evaluación", "Resultado"],
      3,
    );
  });

  get tituloPagina(): string {
    const id = this.detalle()?.solicitud.id;
    return id
      ? `Respuesta del solicitante · Solicitud ${id}`
      : "Respuesta del solicitante";
  }

  get breadcrumb(): string {
    const id = this.detalle()?.solicitud.id;
    return `<p>Gestión Proveedor › Cotizaciones › Solicitudes de cotización › ${
      id ? `Solicitud ${id} › ` : ""
    }<b>Respuesta del solicitante</b></p>`;
  }

  get cerrada(): boolean {
    const detalle = this.detalle();
    return !!detalle && solicitudCerrada(detalle.solicitud);
  }

  get etiquetaProceso(): string {
    return this.cerrada ? "Proceso finalizado" : "Proceso en curso";
  }

  get puedeVerCotizacion(): boolean {
    const detalle = this.detalle();
    return (
      !!detalle &&
      detalle.yaRespondio &&
      !!detalle.invitacion.respuestaVigente
    );
  }

  /** true cuando el estado admite volver a consultar la decisión. */
  get puedeActualizar(): boolean {
    const estado = this.resultado()?.estado;
    return !!estado && ESTADOS_ACTUALIZABLES.includes(estado);
  }

  /** Mensaje propio: decisión final o aviso de que no hay texto personalizado. */
  get mostrarMensaje(): boolean {
    const estado = this.resultado()?.estado;
    return (
      !!this.resultado()?.decision ||
      estado === "no-seleccionado"
    );
  }

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;

    if (resolucion.estado !== "ok") {
      this.vista.set(
        resolucion.estado === "no-encontrada" ? "no-encontrada" : "error",
      );
      if (resolucion.estado === "error") {
        this.error.set(resolucion.mensaje);
      }
      return;
    }

    this.detalle.set(resolucion.detalle);
    void this.cargarResultado();
  }

  reintentar(): void {
    const id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.vista.set("cargando");
    this.error.set("");
    void firstValueFrom(this.solicitudes.obtenerDetalleProveedor(id))
      .then((detalle) => {
        if (!detalle) {
          this.vista.set("no-encontrada");
          return;
        }
        this.detalle.set(detalle);
        return this.cargarResultado();
      })
      .catch((fallo: unknown) => {
        this.error.set(
          fallo instanceof Error
            ? fallo.message
            : "No fue posible consultar la solicitud.",
        );
        this.vista.set("error");
      });
  }

  /** Vuelve a consultar el resultado sin recargar toda la página. */
  refrescarResultado(): void {
    const detalle = this.detalle();
    if (!detalle || this.actualizando()) {
      return;
    }
    this.actualizando.set(true);
    this.solicitudes
      .obtenerResultadoProveedor(detalle.solicitud.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.actualizando.set(false);
          this.error.set("");
          if (resultado) {
            this.resultado.set(resultado);
          }
        },
        error: (fallo: Error) => {
          this.actualizando.set(false);
          this.error.set(
            fallo.message ||
              "No fue posible actualizar el resultado del proceso.",
          );
        },
      });
  }

  verMiCotizacion(): void {
    const detalle = this.detalle();
    if (!detalle || !this.puedeVerCotizacion) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "bandeja-solicitudes",
      detalle.solicitud.id,
      "mi-cotizacion",
    ]);
  }

  verSolicitud(): void {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "bandeja-solicitudes",
      detalle.solicitud.id,
    ]);
  }

  volver(): void {
    void this.router.navigate(["/cotizaciones", "bandeja-solicitudes"]);
  }

  /**
   * Provisional: no hay generador de PDF ni firma institucional en el cliente.
   * Se informa el mismo límite que en la constancia de P-06.
   */
  descargarConstancia(): void {
    const datos = this.datosBanner();
    if (!datos?.accionConstancia) {
      return;
    }
    void this.alerta.showAlert(
      "Constancia en preparación",
      `La constancia «${datos.accionConstancia}» se generará cuando el gestor documental institucional esté conectado. Por ahora la consulta en pantalla es la evidencia disponible.`,
    );
  }

  private async cargarResultado(): Promise<void> {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    this.vista.set("cargando");
    this.error.set("");
    this.errorCotizacion.set("");
    try {
      const resultado = await firstValueFrom(
        this.solicitudes.obtenerResultadoProveedor(detalle.solicitud.id),
      );
      if (!resultado) {
        this.vista.set("no-encontrada");
        return;
      }
      this.resultado.set(resultado);
      await this.cargarCotizacion(detalle);
      this.vista.set("listo");
    } catch (fallo: unknown) {
      this.error.set(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible consultar la respuesta del solicitante.",
      );
      this.vista.set("error");
    }
  }

  private async cargarCotizacion(
    detalle: DetalleInvitacionProveedor,
  ): Promise<void> {
    this.cotizacion.set(null);
    if (!detalle.yaRespondio || !detalle.invitacion.respuestaVigente) {
      return;
    }
    try {
      const respuesta = await firstValueFrom(
        this.respuestas.obtenerMiCotizacion(detalle, detalle.proveedor.id),
      );
      if (!respuesta) {
        return;
      }
      this.cotizacion.set(
        construirMiCotizacion(
          detalle,
          respuesta,
          this.permisos.estadoActualizacion(
            detalle.invitacion,
            detalle.solicitud,
          ),
        ),
      );
    } catch (fallo: unknown) {
      this.errorCotizacion.set(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible consultar el resumen de su cotización.",
      );
    }
  }
}

function construirPasos(
  etiquetas: readonly string[],
  actual: number,
): readonly PasoLineaEstados[] {
  return etiquetas.map((etiqueta, indice) => ({
    etiqueta,
    estado:
      indice < actual
        ? ("completado" as const)
        : indice === actual
          ? ("actual" as const)
          : ("pendiente" as const),
  }));
}
