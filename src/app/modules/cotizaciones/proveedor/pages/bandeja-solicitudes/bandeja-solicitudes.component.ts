import { Component, DestroyRef, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import {
  ACCIONES_INVITACION_PROVEEDOR,
  AccionInvitacionProveedor,
  ESTADOS_POSTULACION_PROVEEDOR,
} from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import {
  CampoFiltro,
  FiltroRapido,
} from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  FiltroInvitacionesProveedor,
  GrupoFiltroInvitacion,
  InvitacionProveedorConSolicitud,
  ResultadoListadoInvitaciones,
  GRUPOS_FILTRO_INVITACION,
  TIPOS_COTIZACION_PROVEEDOR,
  etiquetaTipoCotizacionProveedor,
} from "../../../models/invitacion-proveedor.model";
import { SolicitudesService } from "../../../services/solicitudes.service";

type EstadoVista = "cargando" | "listo" | "error";

const VIGENCIA_ACTUAL = String(new Date().getFullYear());

@Component({
  selector: "app-bandeja-solicitudes-proveedor",
  templateUrl: "./bandeja-solicitudes.component.html",
  styleUrls: ["./bandeja-solicitudes.component.scss"],
  standalone: false,
})
export class BandejaSolicitudesComponent implements OnInit {
  constructor(
    private readonly servicio: SolicitudesService,
    readonly permisos: PermisosSolicitudService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) {}

  readonly breadcrumb =
    "<p>Portal Proveedor › Cotizaciones › <b>Solicitudes de cotización</b></p>";
  readonly acciones = ACCIONES_INVITACION_PROVEEDOR;
  readonly vigenciaActual = VIGENCIA_ACTUAL;
  readonly grupos = GRUPOS_FILTRO_INVITACION;
  readonly opcionesVigencia = [
    { valor: VIGENCIA_ACTUAL, etiqueta: `${VIGENCIA_ACTUAL} (Actual)` },
    { valor: String(Number(VIGENCIA_ACTUAL) - 1), etiqueta: String(Number(VIGENCIA_ACTUAL) - 1) },
    { valor: String(Number(VIGENCIA_ACTUAL) - 2), etiqueta: String(Number(VIGENCIA_ACTUAL) - 2) },
    { valor: "todas", etiqueta: "Todas las vigencias" },
  ];
  readonly tipos = TIPOS_COTIZACION_PROVEEDOR;

  vista = signal<EstadoVista>("cargando");
  invitaciones: readonly InvitacionProveedorConSolicitud[] = [];
  total = 0;
  conteos = {
    todas: 0,
    "por-responder": 0,
    respondidas: 0,
    "con-modificaciones": 0,
    cerradas: 0,
  };
  dependencias: readonly string[] = [];
  pagina = 0;
  porPagina = 10;
  filtroRapidoActivo: GrupoFiltroInvitacion = "todas";
  criterios: FiltroInvitacionesProveedor = {
    vigencia: VIGENCIA_ACTUAL,
    estado: "",
    tipoCotizacion: "",
    dependencia: "",
    busqueda: "",
    grupo: "todas",
    ordenNumero: "desc",
  };
  mensajeError = "";
  resultadoAnunciable = "";
  filaMenuAbierto: string | null = null;
  private cargaActual?: Subscription;

  get camposFiltro(): readonly CampoFiltro[] {
    return [
      {
        clave: "busqueda",
        etiqueta: "Búsqueda rápida",
        tipo: "texto",
        placeholder: "Código, objeto o dependencia...",
      },
      {
        clave: "vigencia",
        etiqueta: "Vigencia",
        tipo: "select",
        requerido: true,
        opciones: this.opcionesVigencia,
      },
      {
        clave: "estado",
        etiqueta: "Estado",
        tipo: "select",
        opciones: [
          { valor: "", etiqueta: "Todos los estados" },
          ...Object.entries(ESTADOS_POSTULACION_PROVEEDOR).map(
            ([valor, estado]) => ({ valor, etiqueta: estado.etiqueta }),
          ),
        ],
      },
      {
        clave: "tipoCotizacion",
        etiqueta: "Tipo de cotización",
        tipo: "select",
        opciones: this.tipos,
      },
      {
        clave: "dependencia",
        etiqueta: "Dependencia",
        tipo: "select",
        opciones: [
          { valor: "", etiqueta: "Todas las dependencias" },
          ...this.dependencias.map((dependencia) => ({
            valor: dependencia,
            etiqueta: dependencia,
          })),
        ],
      },
    ];
  }

  get filtrosRapidos(): readonly FiltroRapido[] {
    return this.grupos.map((grupo) => ({
      ...grupo,
      conteo: this.conteos[grupo.valor],
    }));
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total, (this.pagina + 1) * this.porPagina);
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const inicio = Math.max(1, this.pagina + 1 - 2);
    const fin = Math.min(total, inicio + 4);
    const paginas: number[] = [];
    for (let numero = Math.max(1, fin - 4); numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  get hayFiltrosAplicados(): boolean {
    return (
      this.criterios.vigencia !== VIGENCIA_ACTUAL ||
      this.criterios.estado !== "" ||
      this.criterios.tipoCotizacion !== "" ||
      this.criterios.dependencia !== "" ||
      this.criterios.busqueda.trim() !== "" ||
      this.criterios.grupo !== "todas"
    );
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargaActual?.unsubscribe();
    this.vista.set("cargando");
    this.mensajeError = "";

    this.cargaActual = this.servicio
      .listarInvitacionesProveedor(this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoListadoInvitaciones) => {
          this.invitaciones = resultado.invitaciones;
          this.total = resultado.total;
          this.conteos = resultado.conteos;
          this.dependencias = resultado.dependencias;
          this.vista.set("listo");
          this.resultadoAnunciable = `${resultado.total} solicitudes de cotización encontradas.`;
        },
        error: (error: Error) => {
          this.mensajeError = error.message;
          this.vista.set("error");
        },
      });
  }

  filtrar(valores: Record<string, string>): void {
    this.criterios = {
      ...this.criterios,
      vigencia: valores["vigencia"] ?? VIGENCIA_ACTUAL,
      estado: valores["estado"] ?? "",
      tipoCotizacion: valores["tipoCotizacion"] ?? "",
      dependencia: valores["dependencia"] ?? "",
      busqueda: valores["busqueda"] ?? "",
      grupo: "todas",
    };
    this.filtroRapidoActivo = "todas";
    this.pagina = 0;
    this.cargar();
  }

  filtrarRapido(valor: string): void {
    const grupo = this.grupos.find((opcion) => opcion.valor === valor);
    if (!grupo) {
      return;
    }
    this.filtroRapidoActivo = grupo.valor;
    this.criterios = { ...this.criterios, grupo: grupo.valor };
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = {
      vigencia: VIGENCIA_ACTUAL,
      estado: "",
      tipoCotizacion: "",
      dependencia: "",
      busqueda: "",
      grupo: "todas",
      ordenNumero: "desc",
    };
    this.filtroRapidoActivo = "todas";
    this.pagina = 0;
    this.cargar();
  }

  ordenarPorNumero(): void {
    const ordenNumero = this.criterios.ordenNumero === "desc" ? "asc" : "desc";
    this.criterios = { ...this.criterios, ordenNumero };
    this.pagina = 0;
    this.cargar();
  }

  cambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (![10, 25, 50].includes(valor) || valor === this.porPagina) {
      return;
    }
    this.porPagina = valor;
    this.pagina = 0;
    this.cargar();
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino === this.pagina) {
      return;
    }
    this.pagina = destino;
    this.cargar();
  }

  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  accionesDe(
    fila: InvitacionProveedorConSolicitud,
  ): readonly AccionInvitacionProveedor[] {
    return this.permisos.accionesInvitacionPermitidas(
      fila.invitacion,
      fila.solicitud,
    );
  }

  ejecutarAccion(
    accion: AccionInvitacionProveedor,
    fila: InvitacionProveedorConSolicitud,
  ): void {
    const ruta = this.permisos.rutaAccionInvitacion(accion);
    if (!ruta) {
      void this.alerta.showAlert(
        this.permisos.etiquetaAccionInvitacion(accion),
        "Esta pantalla aún no está implementada. Corresponde a una fase posterior del módulo.",
      );
      return;
    }
    const comandos = ruta
      .split("/")
      .map((segmento) =>
        segmento === ":id" ? fila.solicitud.id : segmento,
      );
    void this.router.navigate(comandos);
  }

  etiquetaTipo(fila: InvitacionProveedorConSolicitud): string {
    return etiquetaTipoCotizacionProveedor(fila.solicitud.tipoCotizacion);
  }

  fechaCierreIso(cierre: string | null): string | null {
    if (!cierre) {
      return null;
    }
    const [dia, mes, anio] = cierre.split("/");
    return dia && mes && anio ? `${anio}-${mes}-${dia}` : null;
  }
}
