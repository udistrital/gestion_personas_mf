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
import type { EstadoActualizacionRespuesta } from "src/app/core/constants/estados-solicitud.const";
import { ImplicitAutenticationService } from "src/app/core/services/implicit_autentication.service";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type {
  DetalleInvitacionProveedor,
} from "../../../models/invitacion-proveedor.model";
import type { DocumentoOfertaRadicado } from "../../../models/documentos.model";
import type { MiCotizacion } from "../../../models/mi-cotizacion.model";
import { construirMiCotizacion } from "../../../models/mi-cotizacion.model";
import type { RespuestaProveedor } from "../../../models/respuesta-proveedor.model";
import { solicitudCerrada } from "../../../models/solicitud.model";
import { RespuestaProveedorService } from "../../../services/respuesta-proveedor.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "../detalle-solicitud/detalle-proveedor.resolver";

type EstadoVista = "cargando" | "listo" | "error" | "no-encontrada";

const FILAS_POR_PAGINA = [5, 10, 25] as const;

/**
 * «Mi cotización» (P-06): consulta de solo lectura de la respuesta radicada.
 *
 * Reutiliza el detalle autorizado de P-02 y la respuesta versionada de
 * P-04/P-05. La vista no decide reglas: los permisos salen de
 * `PermisosSolicitudService` y la presentación de `construirMiCotizacion`.
 *
 * Provisional: la constancia descargable, el hash institucional y la
 * conmutación entre versiones archivadas no están implementados (RF-016,
 * RF-13). El criterio de «una actualización por adenda» es el mismo de P-05
 * (RN-42).
 */
@Component({
  selector: "app-mi-cotizacion-proveedor",
  templateUrl: "./mi-cotizacion-proveedor.component.html",
  styleUrls: ["./mi-cotizacion-proveedor.component.scss"],
  standalone: false,
})
export class MiCotizacionProveedorComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly respuestas = inject(RespuestaProveedorService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly auth = inject(ImplicitAutenticationService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vista = signal<EstadoVista>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly respuesta = signal<RespuestaProveedor | null>(null);
  readonly error = signal("");
  readonly descargando = signal<string | null>(null);
  readonly errorDescarga = signal("");
  readonly pagina = signal(0);
  readonly porPagina = signal<number>(FILAS_POR_PAGINA[0]);
  readonly opcionesPorPagina = FILAS_POR_PAGINA;

  readonly proyeccion = computed<MiCotizacion | null>(() => {
    const detalle = this.detalle();
    const respuesta = this.respuesta();
    if (!detalle || !respuesta) {
      return null;
    }
    return construirMiCotizacion(
      detalle,
      respuesta,
      this.permisos.estadoActualizacion(
        detalle.invitacion,
        detalle.solicitud,
      ),
    );
  });

  readonly filasPagina = computed(() => {
    const filas = this.proyeccion()?.filas ?? [];
    const inicio = this.pagina() * this.porPagina();
    return filas.slice(inicio, inicio + this.porPagina());
  });

  get tituloPagina(): string {
    const id = this.detalle()?.solicitud.id;
    return id ? `Mi cotización · Solicitud ${id}` : "Mi cotización";
  }

  get breadcrumb(): string {
    const id = this.detalle()?.solicitud.id;
    return `<p>Gestión Proveedor › Cotizaciones › Solicitudes de cotización › ${
      id ? `Solicitud ${id} › ` : ""
    }<b>Mi cotización</b></p>`;
  }

  get totalFilas(): number {
    return this.proyeccion()?.filas.length ?? 0;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalFilas / this.porPagina()));
  }

  get rangoInicio(): number {
    return this.totalFilas === 0 ? 0 : this.pagina() * this.porPagina() + 1;
  }

  get rangoFin(): number {
    return Math.min(this.totalFilas, (this.pagina() + 1) * this.porPagina());
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const inicio = Math.max(1, this.pagina() + 1 - 2);
    const fin = Math.min(total, inicio + 4);
    const paginas: number[] = [];
    for (let numero = Math.max(1, fin - 4); numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  /** true cuando el plazo o el estado ya no admiten participación. */
  get cerrada(): boolean {
    const detalle = this.detalle();
    return !!detalle && solicitudCerrada(detalle.solicitud);
  }

  get estadoActualizacion(): EstadoActualizacionRespuesta {
    const detalle = this.detalle();
    return detalle
      ? this.permisos.estadoActualizacion(
          detalle.invitacion,
          detalle.solicitud,
        )
      : "sin-modificacion";
  }

  get puedeResponder(): boolean {
    const detalle = this.detalle();
    return (
      !!detalle &&
      this.permisos.puedeResponderInvitacion(
        detalle.invitacion,
        detalle.solicitud,
      )
    );
  }

  get motivoSinResponder(): string {
    const detalle = this.detalle();
    return detalle
      ? this.permisos.motivoRespuestaNoDisponible(
          detalle.invitacion,
          detalle.solicitud,
        )
      : "";
  }

  get puedeModificar(): boolean {
    const detalle = this.detalle();
    return (
      !!this.respuesta() &&
      !!detalle &&
      this.permisos.puedeActualizarInvitacion(
        detalle.invitacion,
        detalle.solicitud,
      )
    );
  }

  get motivoSinModificar(): string {
    const detalle = this.detalle();
    if (!detalle || !this.respuesta()) {
      return "";
    }
    return this.permisos.motivoActualizacionNoDisponible(
      detalle.invitacion,
      detalle.solicitud,
    );
  }

  ngOnInit(): void {
    if (!this.permisos.puedeVerMiCotizacion()) {
      this.vista.set("no-encontrada");
      return;
    }
    const resultado = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;

    if (resultado.estado === "error") {
      this.error.set(resultado.mensaje);
      this.vista.set("error");
      return;
    }
    if (resultado.estado !== "ok") {
      this.vista.set("no-encontrada");
      return;
    }
    this.detalle.set(resultado.detalle);
    void this.cargarRespuesta();
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
        return this.cargarRespuesta();
      })
      .catch((error: unknown) => {
        this.error.set(
          error instanceof Error
            ? error.message
            : "No fue posible consultar la solicitud.",
        );
        this.vista.set("error");
      });
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino !== this.pagina()) {
      this.pagina.set(destino);
    }
  }

  cambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (!FILAS_POR_PAGINA.includes(valor as (typeof FILAS_POR_PAGINA)[number])) {
      return;
    }
    this.porPagina.set(valor);
    this.pagina.set(0);
  }

  volver(): void {
    void this.router.navigate(["/cotizaciones", "bandeja-solicitudes"]);
  }

  verSolicitud(): void {
    const id = this.detalle()?.solicitud.id;
    if (id) {
      void this.router.navigate([
        "/cotizaciones",
        "bandeja-solicitudes",
        id,
      ]);
    }
  }

  responder(): void {
    const id = this.detalle()?.solicitud.id;
    if (id && this.puedeResponder) {
      void this.router.navigate([
        "/cotizaciones",
        "bandeja-solicitudes",
        id,
        "responder",
      ]);
    }
  }

  modificar(): void {
    const id = this.detalle()?.solicitud.id;
    if (id && this.puedeModificar) {
      void this.router.navigate([
        "/cotizaciones",
        "bandeja-solicitudes",
        id,
        "actualizar",
      ]);
    }
  }

  /** Provisional: no hay generador de PDF institucional en el cliente. */
  descargarConstancia(): void {
    const proyeccion = this.proyeccion();
    if (!proyeccion) {
      return;
    }
    void this.alerta.showAlert(
      "Constancia en preparación",
      `La constancia de la respuesta ${proyeccion.radicado} se generará cuando el gestor documental institucional esté conectado. Por ahora la consulta en pantalla es la evidencia disponible.`,
    );
  }

  verDocumento(documento: DocumentoOfertaRadicado): void {
    this.resolverDocumento(documento, "ver");
  }

  descargarDocumento(documento: DocumentoOfertaRadicado): void {
    this.resolverDocumento(documento, "descargar");
  }

  cerrarErrorDescarga(): void {
    this.errorDescarga.set("");
  }

  private async cargarRespuesta(): Promise<void> {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    this.vista.set("cargando");
    this.error.set("");
    this.errorDescarga.set("");
    try {
      const proveedorId = String((await this.auth.getDocument()) ?? "").trim();
      if (!proveedorId) {
        throw new Error(
          "No fue posible identificar al proveedor en la sesión.",
        );
      }
      const respuesta = await firstValueFrom(
        this.respuestas.obtenerMiCotizacion(detalle, proveedorId),
      );
      this.respuesta.set(respuesta);
      this.vista.set("listo");
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : "No fue posible consultar su cotización radicada.",
      );
      this.vista.set("error");
    }
  }

  private resolverDocumento(
    documento: DocumentoOfertaRadicado,
    accion: "ver" | "descargar",
  ): void {
    if (documento.estado === "pendiente" || !documento.formatoValido) {
      return;
    }
    this.errorDescarga.set("");
    this.descargando.set(documento.id);
    this.respuestas
      .obtenerDocumentoRespuesta(documento.id, accion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resuelto) => {
          this.descargando.set(null);
          if (!resuelto.disponible) {
            this.errorDescarga.set(resuelto.mensaje);
            return;
          }
          void this.alerta.showAlert(
            accion === "ver"
              ? "Vista previa del documento"
              : "Descarga simulada",
            resuelto.mensaje,
          );
        },
        error: (error: Error) => {
          this.descargando.set(null);
          this.errorDescarga.set(
            error.message ||
              "No fue posible consultar el archivo en el repositorio institucional.",
          );
        },
      });
  }
}
