import { Component, DestroyRef, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import { formatoCop } from "../../../models/necesidad.model";
import type {
  DetalleInvitacionProveedor,
  AnexoPublicoProveedor,
} from "../../../models/invitacion-proveedor.model";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "./detalle-proveedor.resolver";

type EstadoVista = "cargando" | "listo" | "no-encontrada" | "error";
type TablaProveedor = "presupuesto" | "items" | "anexos" | "requeridos";
const FILAS_POR_PAGINA = [10, 25, 50] as const;

@Component({
  selector: "app-detalle-solicitud-proveedor",
  templateUrl: "./detalle-solicitud-proveedor.component.html",
  styleUrls: ["./detalle-solicitud-proveedor.component.scss"],
  standalone: false,
})
export class DetalleSolicitudProveedorComponent implements OnInit {
  constructor(
    private readonly ruta: ActivatedRoute,
    private readonly router: Router,
    private readonly servicio: SolicitudesService,
    private readonly permisos: PermisosSolicitudService,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) {}

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Solicitudes de cotización › <b>Detalle</b></p>";
  readonly vista = signal<EstadoVista>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly mensajeError = signal("");
  readonly descargando = signal<string | null>(null);
  readonly errorDescarga = signal("");
  readonly opcionesPorPagina = FILAS_POR_PAGINA;
  readonly paginasTabla = signal<Record<TablaProveedor, number>>({
    presupuesto: 0,
    items: 0,
    anexos: 0,
    requeridos: 0,
  });
  readonly filasPorPagina = signal<Record<TablaProveedor, number>>({
    presupuesto: FILAS_POR_PAGINA[0],
    items: FILAS_POR_PAGINA[0],
    anexos: FILAS_POR_PAGINA[0],
    requeridos: FILAS_POR_PAGINA[0],
  });

  paginaActual(tabla: string): number {
    return this.esTablaProveedor(tabla) ? this.paginasTabla()[tabla] : 0;
  }

  tamanoPagina(tabla: string): number {
    return this.esTablaProveedor(tabla)
      ? this.filasPorPagina()[tabla]
      : FILAS_POR_PAGINA[0];
  }

  ngOnInit(): void {
    const resultado = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;

    if (resultado.estado === "ok") {
      this.detalle.set(resultado.detalle);
      this.vista.set("listo");
    } else if (resultado.estado === "error") {
      this.mensajeError.set(resultado.mensaje);
      this.vista.set("error");
    } else {
      this.vista.set("no-encontrada");
    }
  }

  reintentar(): void {
    const id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.vista.set("cargando");
    this.mensajeError.set("");
    this.servicio
      .obtenerDetalleProveedor(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (!detalle) {
            this.detalle.set(null);
            this.vista.set("no-encontrada");
            return;
          }
          this.detalle.set(detalle);
          this.vista.set("listo");
        },
        error: (error: Error) => {
          this.mensajeError.set(error.message);
          this.vista.set("error");
        },
      });
  }

  get puedeObservar(): boolean {
    const detalle = this.detalle();
    return (
      !!detalle &&
      this.permisos
        .accionesInvitacionPermitidas(detalle.invitacion, detalle.solicitud)
        .includes("observar")
    );
  }

  get puedeResponder(): boolean {
    const detalle = this.detalle();
    return (
      !!detalle &&
      this.permisos
        .accionesInvitacionPermitidas(detalle.invitacion, detalle.solicitud)
        .includes("responder")
    );
  }

  get puedeDescargarAnexos(): boolean {
    const detalle = this.detalle();
    return !!detalle && this.permisos.puedeDescargarAnexo(detalle.invitacion);
  }

  get solicitudCerrada(): boolean {
    const solicitud = this.detalle()?.solicitud;
    if (!solicitud) {
      return false;
    }
    if (
      solicitud.estado === "adjudicada" ||
      solicitud.estado === "desierta" ||
      solicitud.estado === "cancelada"
    ) {
      return true;
    }
    return this.permisos.solicitudCerradaPorFecha(solicitud);
  }

  navegarA(accion: "observar" | "responder"): void {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }

    const permitida =
      accion === "observar" ? this.puedeObservar : this.puedeResponder;
    if (!permitida) {
      return;
    }

    const ruta = this.permisos.rutaAccionInvitacion(accion);
    if (ruta) {
      void this.router.navigate(
        ruta
          .split("/")
          .map((segmento) =>
            segmento === ":id" ? detalle.solicitud.id : segmento,
          ),
      );
    }
  }

  filasPagina<T>(filas: readonly T[], tabla: TablaProveedor): readonly T[] {
    const inicio = this.paginasTabla()[tabla] * this.filasPorPagina()[tabla];
    return filas.slice(inicio, inicio + this.filasPorPagina()[tabla]);
  }

  rangoPagina(
    tabla: TablaProveedor,
    total: number,
  ): {
    desde: number;
    hasta: number;
    total: number;
  } {
    if (!total) {
      return { desde: 0, hasta: 0, total };
    }
    const desde = this.paginasTabla()[tabla] * this.filasPorPagina()[tabla] + 1;
    return {
      desde,
      hasta: Math.min(
        (this.paginasTabla()[tabla] + 1) * this.filasPorPagina()[tabla],
        total,
      ),
      total,
    };
  }

  totalPaginas(tabla: TablaProveedor, total: number): number {
    return Math.max(1, Math.ceil(total / this.filasPorPagina()[tabla]));
  }

  numerosPagina(tabla: TablaProveedor, total: number): number[] {
    const totalPaginas = this.totalPaginas(tabla, total);
    const paginaActual = this.paginasTabla()[tabla];
    const inicio = Math.max(1, paginaActual + 1 - 2);
    const fin = Math.min(totalPaginas, inicio + 4);
    const paginas: number[] = [];
    for (let numero = Math.max(1, fin - 4); numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  numeroFila(tabla: TablaProveedor, indice: number, total: number): number {
    return this.rangoPagina(tabla, total).desde + indice;
  }

  irAPagina(tabla: TablaProveedor, pagina: number, total: number): void {
    if (pagina >= 0 && pagina < this.totalPaginas(tabla, total)) {
      this.paginasTabla.update((paginas) => ({ ...paginas, [tabla]: pagina }));
    }
  }

  cambiarPorPagina(tabla: TablaProveedor, evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (FILAS_POR_PAGINA.includes(valor as (typeof FILAS_POR_PAGINA)[number])) {
      this.filasPorPagina.update((filas) => ({ ...filas, [tabla]: valor }));
      this.paginasTabla.update((paginas) => ({ ...paginas, [tabla]: 0 }));
    }
  }

  private esTablaProveedor(tabla: string): tabla is TablaProveedor {
    return ["presupuesto", "items", "anexos", "requeridos"].includes(tabla);
  }

  claseTipo(tipo: "bien" | "servicio"): string {
    return tipo === "bien" ? "chip chip--bien" : "chip chip--servicio";
  }

  claseEstadoPresupuesto(tono: "exito" | "info" | "neutro"): string {
    switch (tono) {
      case "exito":
        return "chip chip--exito";
      case "info":
        return "chip chip--info";
      case "neutro":
        return "chip chip--neutro";
    }
  }

  descargarPdf(): void {
    void this.alerta.showAlert(
      "Descarga en preparación",
      "La generación del PDF institucional aún no está implementada.",
    );
  }

  descargarAnexo(anexo: AnexoPublicoProveedor): void {
    if (!this.puedeDescargarAnexos) {
      return;
    }
    this.errorDescarga.set("");
    this.descargando.set(anexo.id);
    this.servicio
      .obtenerDocumento(anexo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resuelto) => {
          this.descargando.set(null);
          void this.alerta.showAlert("Descarga simulada", resuelto.mensaje);
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

  cerrarErrorDescarga(): void {
    this.errorDescarga.set("");
  }

  formatoDinero(valor: number | null | undefined): string {
    return valor === null || valor === undefined
      ? "Por definir"
      : formatoCop(valor);
  }

  formatoArchivo(nombre: string): string {
    const extension = nombre.split(".").pop();
    return extension ? extension.toUpperCase() : "ARCHIVO";
  }

  textoCierre(): string {
    return this.solicitudCerrada
      ? "El plazo de participación terminó. La solicitud se consulta en modo de solo lectura."
      : "Las acciones de participación están sujetas al estado de la invitación y a la fecha de cierre.";
  }

  volver(): void {
    void this.router.navigate(["/cotizaciones/bandeja-solicitudes"]);
  }
}
