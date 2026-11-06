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
import { Subscription, interval } from "rxjs";
import { MatCheckboxChange } from "@angular/material/checkbox";
import {
  ACCIONES_OFERENTE,
  AccionOferente,
  ESTADOS_OFERENTE,
} from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { CampoFiltro } from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import { ResultadoResolverSolicitud } from "../../../resolvers/solicitud.resolver";
import {
  ConteosOferentes,
  FiltroOferentes,
  GRUPOS_PARTICIPACION,
  GrupoParticipacionOferente,
  OferenteTablero,
  ProveedorElegibleReporte,
  ResultadoTableroOferentes,
} from "../../../models/oferente.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  etiquetaAreaSnies,
  etiquetaNucleoSnies,
  etiquetaTipoNecesidad,
  identidadProveedor,
} from "../../../models/proveedores.model";
import {
  SolicitudDetalle,
  tipoNecesidad,
} from "../../../models/solicitud.model";
import { OferentesService } from "../../../services/oferentes.service";

type EstadoVistaTablero =
  | "cargando"
  | "listo"
  | "sin-oferentes"
  | "sin-resultados"
  | "error"
  | "bloqueado"
  | "no-disponible";

type EstadoResolucion = "ok" | "no-encontrada" | "error";

/** Opciones de filas por página del pie (mismo patrón de S-01). */
const OPCIONES_POR_PAGINA: readonly number[] = [10, 25, 50];

const CONTEOS_VACIOS: ConteosOferentes = {
  cumplen: 0,
  notificados: 0,
  postulados: 0,
  cotizaciones: 0,
  sinOferta: 0,
};

/**
 * Tablero de oferentes (S-07).
 *
 * Presenta, después del cierre del periodo (RN-29), las ofertas recibidas de
 * forma primaria y los invitados sin oferta de forma secundaria (RF-12). Los
 * contadores salen del servicio simulado (RF-17) y las acciones de cada fila se
 * resuelven con `PermisosSolicitudService`: la plantilla no conoce estados ni
 * roles.
 */
@Component({
  selector: "app-tablero-oferentes",
  templateUrl: "./tablero-oferentes.component.html",
  styleUrls: ["./tablero-oferentes.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class TableroOferentesComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(OferentesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Tablero de oferentes</b></p>";
  readonly ACCIONES = ACCIONES_OFERENTE;
  readonly grupos = GRUPOS_PARTICIPACION;
  readonly opcionesPorPagina = OPCIONES_POR_PAGINA;
  readonly estadosOferente = Object.entries(ESTADOS_OFERENTE).map(
    ([valor, meta]) => ({ valor, etiqueta: meta.etiqueta }),
  );

  readonly estadoResolucion = signal<EstadoResolucion>("ok");
  readonly vista = signal<EstadoVistaTablero>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly oferentes = signal<readonly OferenteTablero[]>([]);
  readonly total = signal(0);
  readonly conteos = signal<ConteosOferentes>(CONTEOS_VACIOS);
  readonly ubicaciones = signal<readonly string[]>([]);
  readonly resultadoAnunciable = signal("");
  readonly reporteEstado = signal("");
  readonly seleccionados = signal<ReadonlySet<string>>(new Set<string>());

  camposFiltro: readonly CampoFiltro[] = [];
  pagina = 0;
  porPagina = 10;
  criterios: FiltroOferentes = {
    busqueda: "",
    participacion: "todas",
    estado: "",
    tipoPersona: "",
    ubicacion: "",
  };

  private cargaActual?: Subscription;
  /** Vigila el cierre para desbloquear el tablero sin recargar la página. */
  private vigiaCierre?: Subscription;

  /** Id de la fila cuyo menú de acciones está abierto (resalta su botón). */
  filaMenuAbierto: string | null = null;

  ngOnInit(): void {
    const resultado = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;

    if (resultado.estado !== "ok") {
      this.estadoResolucion.set(resultado.estado);
      if (resultado.estado === "error") {
        this.mensajeError.set(resultado.mensaje);
      }
      return;
    }

    this.solicitud.set(resultado.solicitud);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${resultado.solicitud.id} › <b>Tablero de Oferentes</b></p>`;
    this.camposFiltro = this.construirCampos();

    if (!this.permisos.puedeAccederTableroOferentes(resultado.solicitud)) {
      this.vista.set("no-disponible");
      return;
    }
    if (!this.permisos.puedeVerOfertas(resultado.solicitud)) {
      this.vista.set("bloqueado");
      this.vigilarCierre(resultado.solicitud);
      return;
    }

    this.cargar();
  }

  /**
   * RN-29: si el usuario deja abierta la vista antes del cierre, al llegar la
   * fecha se consultan los oferentes sin obligarlo a recargar.
   */
  private vigilarCierre(solicitud: SolicitudDetalle): void {
    this.vigiaCierre = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.permisos.puedeVerOfertas(solicitud)) {
          this.vigiaCierre?.unsubscribe();
          this.cargar();
        }
      });
  }

  /* ── Carga y filtros ───────────────────────────────────────────────────── */

  cargar(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    // La selección de comparación es de la página visible.
    this.seleccionados.set(new Set<string>());

    this.cargaActual?.unsubscribe();
    this.cargaActual = this.servicio
      .listar(solicitud, this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => this.aplicarResultado(resultado),
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar los oferentes. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  private aplicarResultado(resultado: ResultadoTableroOferentes): void {
    this.oferentes.set(resultado.oferentes);
    this.total.set(resultado.total);
    this.conteos.set(resultado.conteos);

    if (this.ubicacionesCambiaron(resultado.ubicaciones)) {
      this.ubicaciones.set(resultado.ubicaciones);
      this.camposFiltro = this.construirCampos();
    }

    const vista: EstadoVistaTablero =
      resultado.conteos.notificados === 0
        ? "sin-oferentes"
        : resultado.total === 0
          ? "sin-resultados"
          : "listo";
    this.vista.set(vista);
    this.actualizarAnuncio(vista, resultado);
  }

  private ubicacionesCambiaron(nuevas: readonly string[]): boolean {
    const actuales = this.ubicaciones();
    return (
      actuales.length !== nuevas.length ||
      actuales.some((valor, indice) => valor !== nuevas[indice])
    );
  }

  private actualizarAnuncio(
    vista: EstadoVistaTablero,
    resultado: ResultadoTableroOferentes,
  ): void {
    if (vista === "listo") {
      const desde = this.pagina * this.porPagina + 1;
      const hasta = Math.min(
        resultado.total,
        (this.pagina + 1) * this.porPagina,
      );
      this.resultadoAnunciable.set(
        `Mostrando ${desde} a ${hasta} de ${resultado.total} oferentes. ` +
          `${resultado.conteos.cotizaciones} cotizaciones recibidas.`,
      );
      return;
    }
    if (vista === "sin-resultados") {
      this.resultadoAnunciable.set(
        "Ningún oferente coincide con los filtros aplicados.",
      );
      return;
    }
    if (vista === "sin-oferentes") {
      this.resultadoAnunciable.set(
        "La solicitud todavía no tiene invitaciones registradas.",
      );
    }
  }

  filtrar(valores: Record<string, string>): void {
    this.criterios = {
      busqueda: valores["busqueda"] ?? "",
      participacion:
        (valores["participacion"] as GrupoParticipacionOferente) || "todas",
      estado: valores["estado"] ?? "",
      tipoPersona: valores["tipoPersona"] ?? "",
      ubicacion: valores["ubicacion"] ?? "",
    };
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = {
      busqueda: "",
      participacion: "todas",
      estado: "",
      tipoPersona: "",
      ubicacion: "",
    };
    // Una referencia nueva obliga a `listado-filtros` a reiniciar sus valores
    // también cuando la limpieza se dispara desde el estado vacío.
    this.camposFiltro = this.construirCampos();
    this.pagina = 0;
    this.cargar();
  }

  private construirCampos(): readonly CampoFiltro[] {
    return [
      {
        clave: "busqueda",
        etiqueta: "Búsqueda rápida",
        tipo: "texto",
        placeholder: "NIT, razón social, nombre o correo",
      },
      {
        clave: "participacion",
        etiqueta: "Participación",
        tipo: "select",
        opciones: this.grupos.map((grupo) => ({
          valor: grupo.valor,
          etiqueta: grupo.etiqueta,
        })),
      },
      {
        clave: "estado",
        etiqueta: "Estado del oferente",
        tipo: "select",
        opciones: [
          { valor: "", etiqueta: "Todos los estados" },
          ...this.estadosOferente,
        ],
      },
      {
        clave: "tipoPersona",
        etiqueta: "Tipo de persona",
        tipo: "select",
        opciones: [
          { valor: "", etiqueta: "Todas las personas" },
          { valor: "juridica", etiqueta: "Persona jurídica" },
          { valor: "natural", etiqueta: "Persona natural" },
          { valor: "consorcio", etiqueta: "Consorcio / UT" },
        ],
      },
      {
        clave: "ubicacion",
        etiqueta: "Ubicación",
        tipo: "select",
        opciones: [
          { valor: "", etiqueta: "Todas las ubicaciones" },
          ...this.ubicaciones().map((ubicacion) => ({
            valor: ubicacion,
            etiqueta: ubicacion,
          })),
        ],
      },
    ];
  }

  /* ── Paginación ────────────────────────────────────────────────────────── */

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total() / this.porPagina));
  }

  get rangoInicio(): number {
    return this.total() === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total(), (this.pagina + 1) * this.porPagina);
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const ventana = 5;
    let inicio = Math.max(1, this.pagina + 1 - Math.floor(ventana / 2));
    const fin = Math.min(total, inicio + ventana - 1);
    inicio = Math.max(1, fin - ventana + 1);
    const paginas: number[] = [];
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino === this.pagina) {
      return;
    }
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
    if (!Number.isFinite(valor) || valor === this.porPagina) {
      return;
    }
    this.porPagina = valor;
    this.pagina = 0;
    this.cargar();
  }

  /* ── Indicadores ───────────────────────────────────────────────────────── */

  readonly metricas = computed(() => {
    const conteos = this.conteos();
    const porcentaje = (valor: number, base: number): number =>
      base <= 0 ? 0 : Math.round((valor / base) * 100);

    return [
      {
        clave: "cumplen",
        etiqueta: "Proveedores que cumplen",
        valor: conteos.cumplen,
        icono: "check_circle",
        detalle: "Personas que cumplen con las actividades económicas",
        etiquetaBarra: "Cobertura base",
        progreso: conteos.cumplen > 0 ? 100 : 0,
        anunciar: false,
      },
      {
        clave: "notificados",
        etiqueta: "Notificados",
        valor: conteos.notificados,
        icono: "forward_to_inbox",
        detalle: "Invitaciones enviadas por sistema",
        etiquetaBarra: "Notificación efectiva",
        progreso: porcentaje(conteos.notificados, conteos.cumplen),
        anunciar: false,
      },
      {
        clave: "postulados",
        etiqueta: "Postulados / observaciones",
        valor: conteos.postulados,
        icono: "forum",
        detalle: "Manifestaron interés o formularon observaciones",
        etiquetaBarra: "Interés manifestado",
        progreso: porcentaje(conteos.postulados, conteos.notificados),
        anunciar: false,
      },
      {
        clave: "cotizaciones",
        etiqueta: "Cotizaciones recibidas",
        valor: conteos.cotizaciones,
        icono: "request_quote",
        detalle: "Ofertas económicas radicadas en firme",
        etiquetaBarra: "Radicación final",
        progreso: porcentaje(conteos.cotizaciones, conteos.notificados),
        anunciar: true,
      },
    ];
  });

  /* ── Criterios de elegibilidad ─────────────────────────────────────────── */

  readonly actividadesCriterio = computed(
    () => this.solicitud()?.proveedores?.segmentacion.actividades ?? [],
  );

  readonly nucleoCriterio = computed(() => {
    const detalle = this.solicitud()?.proveedores;
    return detalle?.requiereIdoneidad && detalle.segmentacion.nucleoSnies
      ? etiquetaNucleoSnies(detalle.segmentacion.nucleoSnies)
      : "";
  });

  readonly areaCriterio = computed(() => {
    const detalle = this.solicitud()?.proveedores;
    return detalle?.requiereIdoneidad && detalle.segmentacion.areaSnies
      ? etiquetaAreaSnies(detalle.segmentacion.areaSnies)
      : "";
  });

  readonly sinSegmentacion = computed(
    () => !this.solicitud()?.proveedores,
  );

  readonly necesidadCriterio = computed(() => {
    const solicitud = this.solicitud();
    return solicitud
      ? etiquetaTipoNecesidad(tipoNecesidad(solicitud.tipoCotizacion))
      : "—";
  });

  readonly puedeDescargarReporte = computed(() => this.conteos().cumplen > 0);

  /* ── Acciones de fila ──────────────────────────────────────────────────── */

  identidadDe(oferente: OferenteTablero) {
    return identidadProveedor(oferente.proveedor);
  }

  /**
   * Acciones por fila precalculadas. La matriz y los roles son señales, así que
   * el mapa se recalcula solo cuando cambian los datos o los permisos.
   */
  private readonly accionesPorOferente = computed<
    ReadonlyMap<string, readonly AccionOferente[]>
  >(() => {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return new Map();
    }
    return new Map(
      this.oferentes().map((oferente) => [
        oferente.id,
        this.permisos.accionesOferentePermitidas(oferente, solicitud),
      ]),
    );
  });

  formatoTotal(valor: number): string {
    return formatoCop(valor);
  }

  /**
   * RF-12: inserta el separador de “Invitados sin oferta” justo antes del
   * primer oferente del grupo secundario (aunque la página empiece por él).
   */
  mostrarSeparador(indice: number): boolean {
    const oferentes = this.oferentes();
    const actual = oferentes[indice];
    if (!actual || actual.grupo !== "sin-oferta") {
      return false;
    }
    return indice === 0 || oferentes[indice - 1]?.grupo === "con-oferta";
  }

  accionesDe(oferente: OferenteTablero): readonly AccionOferente[] {
    return this.accionesPorOferente().get(oferente.id) ?? [];
  }

  etiquetaAccion(accion: AccionOferente): string {
    return this.permisos.etiquetaAccionOferente(accion);
  }

  /** Etiqueta del menú; agrega el número de observaciones cuando aplica. */
  etiquetaAccionFila(
    accion: AccionOferente,
    oferente: OferenteTablero,
  ): string {
    const etiqueta = this.etiquetaAccion(accion);
    return accion === "ver-observaciones" && oferente.observaciones > 0
      ? `${etiqueta} (${oferente.observaciones})`
      : etiqueta;
  }

  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  ejecutarAccion(accion: AccionOferente, oferente: OferenteTablero): void {
    if (!this.accionesDe(oferente).includes(accion)) {
      return;
    }
    const comandos = this.permisos.rutaAccionOferente(accion, oferente);
    if (accion === "ver-observaciones") {
      void this.router.navigate(comandos, {
        queryParams: { proveedor: oferente.proveedor.nit },
      });
      return;
    }

    // S-10 abre la pestaña que corresponde a la acción del menú.
    const tab =
      accion === "ver-oferente"
        ? "persona"
        : accion === "ver-cotizacion"
          ? "cotizacion"
          : "respuesta";
    void this.router.navigate(comandos, { queryParams: { tab } });
  }

  verCriterios(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "proveedores",
    ]);
  }

  exportar(formato: "xlsx" | "pdf"): void {
    void this.alerta.showAlert(
      `Exportar a ${formato === "xlsx" ? "Excel (.xlsx)" : "PDF (.pdf)"}`,
      "La exportación institucional del tablero se habilitará cuando el gestor documental esté conectado. Operación simulada.",
    );
  }

  /**
   * Reporte de proveedores que cumplen (RN-19).
   *
   * Se genera en el navegador como CSV para no agregar dependencias de Excel o
   * PDF. El formato queda provisional porque RN-19 está marcada para revisión.
   */
  descargarReporte(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }

    this.reporteEstado.set("Generando reporte de proveedores…");
    this.servicio
      .obtenerElegibles(solicitud)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (proveedores) => {
          this.descargarCsv(proveedores, solicitud.id);
          this.reporteEstado.set(
            `Reporte generado con ${proveedores.length} proveedores que cumplen el perfil.`,
          );
        },
        error: (error: Error) => {
          this.reporteEstado.set(
            error.message ||
              "No fue posible generar el reporte. Intente nuevamente.",
          );
        },
      });
  }

  private descargarCsv(
    proveedores: readonly ProveedorElegibleReporte[],
    solicitudId: string,
  ): void {
    const encabezado = [
      "Documento",
      "Nombre o razón social",
      "Tipo de persona",
      "Correo",
      "Ubicación",
      "Actividades CIIU",
      "Núcleo SNIES",
    ];
    const filas = proveedores.map((proveedor) => [
      proveedor.documento,
      proveedor.nombre,
      proveedor.tipoPersona,
      proveedor.correo,
      proveedor.ubicacion,
      proveedor.actividades,
      proveedor.nucleo,
    ]);
    const csv = [encabezado, ...filas]
      .map((fila) => fila.map((celda) => `"${celda.replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `proveedores-que-cumplen-${solicitudId}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /* ── Selección para comparación (S-09) ──────────────────────────────────── */

  estaSeleccionado(oferente: OferenteTablero): boolean {
    return this.seleccionados().has(oferente.id);
  }

  toggleSeleccion(oferente: OferenteTablero, evento: MatCheckboxChange): void {
    if (!oferente.respuesta) {
      return;
    }
    this.seleccionados.update((actuales) => {
      const copia = new Set(actuales);
      if (evento.checked) {
        copia.add(oferente.id);
      } else {
        copia.delete(oferente.id);
      }
      return copia;
    });
  }

  get oferentesConCotizacionPagina(): readonly OferenteTablero[] {
    return this.oferentes().filter((oferente) => !!oferente.respuesta);
  }

  get paginaTodoSeleccionado(): boolean {
    const ids = this.oferentesConCotizacionPagina.map(
      (oferente) => oferente.id,
    );
    return (
      ids.length > 0 && ids.every((id) => this.seleccionados().has(id))
    );
  }

  get paginaParcialSeleccionado(): boolean {
    const ids = this.oferentesConCotizacionPagina.map(
      (oferente) => oferente.id,
    );
    const marcados = ids.filter((id) => this.seleccionados().has(id)).length;
    return marcados > 0 && marcados < ids.length;
  }

  alternarPagina(evento: MatCheckboxChange): void {
    const ids = this.oferentesConCotizacionPagina.map(
      (oferente) => oferente.id,
    );
    this.seleccionados.update((actuales) => {
      const copia = new Set(actuales);
      ids.forEach((id) => {
        if (evento.checked) {
          copia.add(id);
        } else {
          copia.delete(id);
        }
      });
      return copia;
    });
  }

  get seleccionadosConCotizacion(): readonly OferenteTablero[] {
    return this.oferentesConCotizacionPagina.filter((oferente) =>
      this.seleccionados().has(oferente.id),
    );
  }

  deseleccionarTodos(): void {
    this.seleccionados.set(new Set<string>());
  }

  comparar(): void {
    const solicitud = this.solicitud();
    if (!solicitud || this.seleccionadosConCotizacion.length < 2) {
      return;
    }
    void this.router.navigate(
      ["/cotizaciones", "solicitudes", solicitud.id, "evaluacion"],
      {
        queryParams: {
          oferentes: this.seleccionadosConCotizacion
            .map((oferente) => oferente.proveedor.id)
            .join(","),
        },
      },
    );
  }

  /* ── Navegación y estados ──────────────────────────────────────────────── */

  volverAlDetalle(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
      ]);
      return;
    }
    this.volverAlListado();
  }

  volverAlListado(): void {
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }

  reintentarResolucion(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }

  reintentarCarga(): void {
    this.cargar();
  }

  get fechaLimite(): string {
    const cierre = this.solicitud()?.cierre;
    return cierre ? `${cierre} 23:59:59 COT` : "Sin fecha de cierre";
  }

  /** true cuando el periodo ya terminó; el plazo se pinta en tono neutro. */
  periodoCerrado(): boolean {
    const solicitud = this.solicitud();
    return solicitud ? this.permisos.puedeVerOfertas(solicitud) : false;
  }
}
