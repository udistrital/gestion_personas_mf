import { Component, DestroyRef, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import {
  ACCIONES_SOLICITUD,
  AccionSolicitud,
  ESTADOS_SOLICITUD,
  ESTADOS_SOLICITUD_LISTA,
} from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { CampoFiltro } from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  etiquetaTipoCotizacion,
  etiquetaUnidadEjecutora,
  FiltroSolicitudes,
  Solicitud,
  ResultadoListado,
  TIPOS_COTIZACION_FILTRO,
  UNIDADES_EJECUTORAS,
  VIGENCIAS,
} from "../../../models/solicitud.model";
import { versionSolicitud } from "../../../models/edicion-solicitud.model";
import { SolicitudesService } from "../../../services/solicitudes.service";

type EstadoVista = "cargando" | "listo" | "error";

@Component({
  selector: "app-listado-solicitudes",
  templateUrl: "./listado-solicitudes.component.html",
  styleUrls: ["./listado-solicitudes.component.scss"],
  standalone: false,
})
export class ListadoSolicitudesComponent implements OnInit {
  constructor(
    private readonly servicio: SolicitudesService,
    private readonly permisos: PermisosSolicitudService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) { }

  /** Acceso a la matriz desde la plantilla (etiquetas, iconos, peligro). */
  readonly ACCIONES = ACCIONES_SOLICITUD;

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Mis Solicitudes de Cotización</b></p>";

  readonly camposFiltro: readonly CampoFiltro[] = [
    {
      clave: "vigencia",
      etiqueta: "Vigencia",
      tipo: "select",
      opciones: VIGENCIAS,
      requerido: true,
    },
    {
      clave: "unidadEjecutora",
      etiqueta: "Unidad ejecutora",
      tipo: "select",
      opciones: [
        { valor: "", etiqueta: "Todas las unidades" },
        ...UNIDADES_EJECUTORAS,
      ],
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "select",
      opciones: [
        { valor: "", etiqueta: "Todos los estados" },
        ...ESTADOS_SOLICITUD_LISTA.map((estado) => ({
          valor: estado,
          etiqueta: ESTADOS_SOLICITUD[estado].etiqueta,
        })),
      ],
    },
    {
      clave: "tipoCotizacion",
      etiqueta: "Tipo de cotización",
      tipo: "select",
      opciones: TIPOS_COTIZACION_FILTRO,
    },
    {
      clave: "busqueda",
      etiqueta: "Buscar por número o palabra clave",
      tipo: "texto",
      placeholder: "Ej. SOL-2026-0042 o equipos",
    },
  ];

  /** Anchos aproximados de las columnas reales, para el esqueleto de carga. */
  readonly columnasEsqueleto: readonly number[] = [
    150, 70, 160, 280, 100, 100, 180, 130, 120, 56,
  ];

  vista = signal<EstadoVista>("cargando");
  solicitudes: readonly Solicitud[] = [];
  total = 0;
  pagina = 0;
  porPagina = 10;
  criterios: Partial<FiltroSolicitudes> = { vigencia: "2026" };
  ordenNumero: "asc" | "desc" = "desc";
  mensajeError = "";

  /** Id de la fila cuyo menú de acciones está abierto (resalta su botón). */
  filaMenuAbierto: string | null = null;

  /** Opciones del selector "Mostrar N por página" del pie del listado. */
  readonly opcionesPorPagina: readonly number[] = [10, 25, 50];
  private cargaActual?: Subscription;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargaActual?.unsubscribe();
    this.vista.set("cargando");
    this.mensajeError = "";

    this.cargaActual = this.servicio
      .listar(this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoListado) => {
          this.solicitudes = resultado.solicitudes;
          this.total = resultado.total;
          this.vista.set("listo");
        },
        error: (error: Error) => {
          this.mensajeError = error.message;
          this.vista.set("error");
        },
      });
  }

  filtrar(criterios: Record<string, string>): void {
    this.criterios = { ...criterios } as Partial<FiltroSolicitudes>;
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = { vigencia: "2026" };
    this.pagina = 0;
    this.cargar();
  }

  /** Total de páginas según el tamaño de página actual. */
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  /** Rango visible (1-based) de registros: "1–10". */
  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total, (this.pagina + 1) * this.porPagina);
  }

  /** Números de página a mostrar (ventana de 5 alrededor de la actual). */
  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const ventana = 5;
    let inicio = Math.max(1, this.pagina + 1 - Math.floor(ventana / 2));
    const fin = Math.min(total, inicio + ventana - 1);
    inicio = Math.max(1, fin - ventana + 1);
    const paginas: number[] = [];
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino === this.pagina) return;
    this.pagina = destino;
    this.cargar();
  }

  paginaAnterior(): void {
    this.irAPagina(this.pagina - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.pagina + 1);
  }

  primeraPagina(): void {
    this.irAPagina(0);
  }

  ultimaPagina(): void {
    this.irAPagina(this.totalPaginas - 1);
  }

  cambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (!Number.isFinite(valor) || valor === this.porPagina) return;
    this.porPagina = valor;
    this.pagina = 0;
    this.cargar();
  }

  /** Marca/desmarca la fila con el menú de acciones abierto. */
  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  ordenarPorNumero(): void {
    this.ordenNumero = this.ordenNumero === "desc" ? "asc" : "desc";
  }

  get filasVisibles(): readonly Solicitud[] {
    const factor = this.ordenNumero === "desc" ? -1 : 1;
    return [...this.solicitudes].sort(
      (a, b) => factor * a.id.localeCompare(b.id),
    );
  }

  accionesDe(solicitud: Solicitud): readonly AccionSolicitud[] {
    return this.permisos.accionesPermitidas(solicitud);
  }

  /** Etiqueta contextual de la acción ("Modificar" / "Solicitar modificación"). */
  etiquetaAccion(accion: AccionSolicitud, solicitud: Solicitud): string {
    return this.permisos.etiquetaAccion(accion, solicitud);
  }

  /** Versión vigente del expediente ("v1.0" en las filas antiguas). */
  versionDe(solicitud: Solicitud): string {
    return versionSolicitud(solicitud);
  }

  esPeligro(accion: AccionSolicitud): boolean {
    return ACCIONES_SOLICITUD[accion].peligro === true;
  }

  ejecutarAccion(accion: AccionSolicitud, solicitud: Solicitud): void {
    // La ruta depende del estado (borrador → /editar; enviada →
    // /solicitar-modificacion); la resuelve la matriz, no la plantilla.
    const ruta = this.permisos.rutaAccion(accion, solicitud);
    if (ruta) {
      const comandos = ruta
        .split("/")
        .map((segmento) => (segmento === ":id" ? solicitud.id : segmento));
      void this.router.navigate(comandos);
      return;
    }
    // TODO issue #34: destino aún no implementado (S-05…S-08).
    void this.alerta.showAlert(
      this.etiquetaAccion(accion, solicitud),
      "Esta pantalla aún no está implementada. Corresponde a una fase posterior del módulo.",
    );
  }

  nuevaSolicitud(): void {
    void this.router.navigate(["cotizaciones", "solicitudes", "nueva"]);
  }

  pestanaPendientes(): void {
    // TODO issue #34: segunda vista del tablero, aún no definida.
    void this.alerta.showAlert(
      "Pendientes de validación",
      "Esta vista aún no está implementada. Corresponde a una fase posterior del módulo.",
    );
  }

  etiquetaUnidad(valor: string): string {
    return etiquetaUnidadEjecutora(valor);
  }

  etiquetaTipo(valor: Solicitud["tipoCotizacion"]): string {
    return etiquetaTipoCotizacion(valor);
  }
}
