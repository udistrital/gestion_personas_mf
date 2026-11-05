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
import {
  ACCIONES_COMPARADOR,
  AccionComparador,
} from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type { PasoLineaEstados } from "src/app/shared/components/linea-estados/linea-estados.component";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { ResultadoResolverSolicitud } from "../../../resolvers/solicitud.resolver";
import {
  formatoPorcentaje,
  SECCIONES_COMPARATIVO,
  type CeldaComparativa,
  type FilaComparativa,
  type ItemComparado,
  type OfertaComparada,
  type ResultadoComparativo,
} from "../../../models/comparativo.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  etiquetaUnidadEjecutora,
  type SolicitudDetalle,
} from "../../../models/solicitud.model";
import { OferentesService } from "../../../services/oferentes.service";

type EstadoVista =
  | "cargando"
  | "listo"
  | "sin-ofertas"
  | "una-oferta"
  | "error"
  | "bloqueado"
  | "no-disponible";

type EstadoResolucion = "ok" | "no-encontrada" | "error";
type PestanaComparador = "general" | "items";
type OrdenComparador =
  | "menor-precio"
  | "mayor-precio"
  | "menor-plazo"
  | "radicacion";

const CELDA_VACIA = (ofertaId: string): CeldaComparativa => ({
  ofertaId,
  texto: "—",
});

/**
 * Comparador de cotizaciones (S-09).
 *
 * Presenta, después del cierre (RN-29), las ofertas radicadas en una matriz
 * económica, comercial, documental y de perfil, más el desglose por ítem. Los
 * cálculos viven en `comparativo.model.ts`; los permisos, en
 * `PermisosSolicitudService`. La selección de una oferta es una recomendación
 * (RN-33) y nunca una adjudicación (RN-34).
 */
@Component({
  selector: "app-comparador-cotizaciones",
  templateUrl: "./comparador-cotizaciones.component.html",
  styleUrls: ["./comparador-cotizaciones.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class ComparadorCotizacionesComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(OferentesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ACCIONES = ACCIONES_COMPARADOR;
  readonly secciones = SECCIONES_COMPARATIVO;
  readonly pestanas: readonly {
    id: PestanaComparador;
    etiqueta: string;
    icono: string;
  }[] = [
    {
      id: "general",
      etiqueta: "Resumen general (matriz de ofertas)",
      icono: "table_chart",
    },
    {
      id: "items",
      etiqueta: "Comparación por ítem",
      icono: "receipt_long",
    },
  ];
  readonly ordenes: readonly {
    valor: OrdenComparador;
    etiqueta: string;
  }[] = [
    { valor: "menor-precio", etiqueta: "Menor precio (referencia)" },
    { valor: "mayor-precio", etiqueta: "Mayor precio" },
    { valor: "menor-plazo", etiqueta: "Menor plazo de entrega" },
    { valor: "radicacion", etiqueta: "Fecha de radicación" },
  ];
  readonly moneda = formatoCop;
  readonly porcentaje = formatoPorcentaje;

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Comparador de cotizaciones</b></p>";

  readonly estadoResolucion = signal<EstadoResolucion>("ok");
  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly resultado = signal<ResultadoComparativo | null>(null);
  readonly ocultos = signal<ReadonlySet<string>>(new Set<string>());
  readonly anuncio = signal("");
  readonly preseleccionando = signal(false);
  readonly pestana = signal<PestanaComparador>("general");

  busqueda = "";
  orden: OrdenComparador = "menor-precio";
  resaltarMenor = true;
  soloDiferencias = false;

  /** Ids que llegan desde S-07 en `?oferentes=`. */
  private oferenteIds: readonly string[] = [];
  private cargaActual?: Subscription;
  private vigiaCierre?: Subscription;

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;
    this.oferenteIds = (this.ruta.snapshot.queryParamMap.get("oferentes") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (resolucion.estado !== "ok") {
      this.estadoResolucion.set(resolucion.estado);
      if (resolucion.estado === "error") {
        this.mensajeError.set(resolucion.mensaje);
      }
      return;
    }

    this.solicitud.set(resolucion.solicitud);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${resolucion.solicitud.id} › <b>Comparador de cotizaciones</b></p>`;

    if (!this.permisos.puedeAccederComparador(resolucion.solicitud)) {
      this.vista.set("no-disponible");
      return;
    }
    if (!this.permisos.puedeVerOfertas(resolucion.solicitud)) {
      this.vista.set("bloqueado");
      this.vigilarCierre(resolucion.solicitud);
      return;
    }

    this.cargar();
  }

  /* ── Carga ─────────────────────────────────────────────────────────────── */

  cargar(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    this.cargaActual?.unsubscribe();
    this.cargaActual = this.servicio
      .obtenerComparativo(solicitud, this.oferenteIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => this.aplicarResultado(resultado),
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar el comparativo. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /**
   * RN-29: si la vista queda abierta antes del cierre, al llegar la fecha se
   * consultan las ofertas sin obligar a recargar.
   */
  private vigilarCierre(solicitud: SolicitudDetalle): void {
    this.vigiaCierre = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.permisos.puedeVerOfertas(solicitud)) {
          this.vigiaCierre?.unsubscribe();
          // Nueva referencia para que los `computed` que leen el cierre se
          // recalculen al desbloquear la vista.
          this.solicitud.set({ ...solicitud });
          this.cargar();
        }
      });
  }

  private aplicarResultado(
    resultado: ResultadoComparativo,
    conservarOcultos = false,
  ): void {
    this.resultado.set(resultado);
    if (!conservarOcultos) {
      this.ocultos.set(new Set<string>());
    }
    const total = resultado.ofertas.length;
    this.vista.set(
      total === 0 ? "sin-ofertas" : total === 1 ? "una-oferta" : "listo",
    );
    this.anuncio.set(resultado.anuncio);
  }

  /* ── Filtros y orden ───────────────────────────────────────────────────── */

  get ofertasVisibles(): readonly OfertaComparada[] {
    const resultado = this.resultado();
    if (!resultado) {
      return [];
    }

    const termino = normalizar(this.busqueda);
    const visibles = resultado.ofertas.filter((oferta) => {
      if (this.ocultos().has(oferta.id)) {
        return false;
      }
      if (!termino) {
        return true;
      }
      return [
        oferta.proveedor.nombre,
        oferta.proveedor.nit,
        oferta.identidad.correo,
        oferta.identidad.ubicacion,
      ].some((valor) => normalizar(valor).includes(termino));
    });

    const orden = this.orden;
    return [...visibles].sort((a, b) => {
      if (a.excedePresupuesto !== b.excedePresupuesto) {
        return a.excedePresupuesto ? 1 : -1;
      }
      switch (orden) {
        case "mayor-precio":
          return b.total - a.total;
        case "menor-plazo":
          return (
            a.oferta.plazoEntregaDias - b.oferta.plazoEntregaDias ||
            a.total - b.total
          );
        case "radicacion":
          return (
            (b.oferente.respuesta?.fechaEnvioIso ?? "").localeCompare(
              a.oferente.respuesta?.fechaEnvioIso ?? "",
            ) || a.total - b.total
          );
        default:
          return a.total - b.total;
      }
    });
  }

  get filasVisibles(): readonly FilaComparativa[] {
    const resultado = this.resultado();
    if (!resultado) {
      return [];
    }
    if (!this.soloDiferencias) {
      return resultado.filas;
    }
    return resultado.filas.filter((fila) =>
      this.tieneDiferencias(fila.valores),
    );
  }

  get itemsVisibles(): readonly ItemComparado[] {
    const resultado = this.resultado();
    if (!resultado) {
      return [];
    }
    if (!this.soloDiferencias) {
      return resultado.items;
    }
    return resultado.items.filter((item) =>
      this.tieneDiferencias(item.valores),
    );
  }

  get sinResultados(): boolean {
    return (
      this.vista() === "listo" &&
      (this.pestana() === "general"
        ? this.filasVisibles.length === 0
        : this.itemsVisibles.length === 0)
    );
  }

  get criterioVisible(): string {
    const criterio = this.solicitud()?.general.caracteristicas.criterioSeleccion;
    return criterio ? textoPlanoDesdeHtml(criterio) : "";
  }

  get hayCriterio(): boolean {
    return this.criterioVisible.trim().length > 0;
  }

  private tieneDiferencias(valores: readonly CeldaComparativa[]): boolean {
    const visibles = this.ofertasVisibles;
    if (visibles.length < 2) {
      return true;
    }
    const textos = visibles.map(
      (oferta) => this.celdaDeValores(valores, oferta.id).texto,
    );
    return new Set(textos).size > 1;
  }

  celdaDe(fila: FilaComparativa, oferta: OfertaComparada): CeldaComparativa {
    return this.celdaDeValores(fila.valores, oferta.id);
  }

  celdaDeItem(item: ItemComparado, oferta: OfertaComparada): CeldaComparativa {
    return this.celdaDeValores(item.valores, oferta.id);
  }

  private celdaDeValores(
    valores: readonly CeldaComparativa[],
    ofertaId: string,
  ): CeldaComparativa {
    return valores.find((celda) => celda.ofertaId === ofertaId) ??
      CELDA_VACIA(ofertaId);
  }

  aplicarFiltros(): void {
    this.anuncio.set(
      `${this.ofertasVisibles.length} de ${
        this.resultado()?.ofertas.length ?? 0
      } ofertas visibles. Filtros aplicados.`,
    );
  }

  cambiarOrden(valor: string): void {
    this.orden = valor as OrdenComparador;
    this.anunciarFiltros("Orden actualizado.");
  }

  cambiarBusqueda(valor: string): void {
    this.busqueda = valor;
    this.anunciarFiltros("Búsqueda actualizada.");
  }

  cambiarResaltado(valor: boolean): void {
    this.resaltarMenor = valor;
    this.anunciarFiltros(
      valor
        ? "Se resaltan los menores valores de referencia."
        : "Se ocultan los resaltados de menor valor.",
    );
  }

  cambiarDiferencias(valor: boolean): void {
    this.soloDiferencias = valor;
    this.anunciarFiltros(
      valor
        ? "Solo se muestran las filas con diferencias."
        : "Se muestran todas las filas.",
    );
  }

  limpiarFiltros(): void {
    this.busqueda = "";
    this.orden = "menor-precio";
    this.resaltarMenor = true;
    this.soloDiferencias = false;
    this.ocultos.set(new Set<string>());
    this.anunciarFiltros("Filtros restablecidos.");
  }

  alternarVisibilidad(oferta: OfertaComparada): void {
    this.ocultos.update((actuales) => {
      const copia = new Set(actuales);
      if (copia.has(oferta.id)) {
        copia.delete(oferta.id);
      } else {
        copia.add(oferta.id);
      }
      return copia;
    });
    const visible = !this.ocultos().has(oferta.id);
    this.anunciarFiltros(
      `${oferta.proveedor.nombre} ${visible ? "incluida" : "ocultada"} de la comparativa.`,
    );
  }

  estaOculto(oferta: OfertaComparada): boolean {
    return this.ocultos().has(oferta.id);
  }

  private anunciarFiltros(prefijo: string): void {
    const total = this.resultado()?.ofertas.length ?? 0;
    this.anuncio.set(
      `${prefijo} ${this.ofertasVisibles.length} de ${total} ofertas visibles.`,
    );
  }

  /* ── Presupuesto, preselección y permisos ──────────────────────────────── */

  get presupuesto(): number {
    return this.resultado()?.valorPresupuesto ?? 0;
  }

  get ofertaPreseleccionada(): OfertaComparada | null {
    return (
      this.resultado()?.ofertas.find((oferta) => oferta.seleccionado) ?? null
    );
  }

  get ahorroPreseleccionado(): number {
    const oferta = this.ofertaPreseleccionada;
    return oferta && oferta.valorPresupuesto > 0
      ? Math.max(0, oferta.valorPresupuesto - oferta.total)
      : 0;
  }

  readonly accionesComparador = computed<readonly AccionComparador[]>(() => {
    const solicitud = this.solicitud();
    return solicitud
      ? this.permisos.accionesComparadorPermitidas(solicitud)
      : [];
  });

  puedeAccion(accion: AccionComparador): boolean {
    return this.accionesComparador().includes(accion);
  }

  puedePreseleccionar(oferta: OfertaComparada): boolean {
    return (
      !oferta.excedePresupuesto &&
      !oferta.seleccionado &&
      !this.preseleccionando() &&
      this.puedeAccion("preseleccionar")
    );
  }

  puedeQuitarPreseleccion(): boolean {
    return (
      !!this.ofertaPreseleccionada &&
      !this.preseleccionando() &&
      this.puedeAccion("quitar-preseleccion")
    );
  }

  get puedeContinuarDecision(): boolean {
    return (
      !!this.ofertaPreseleccionada && this.puedeAccion("continuar-decision")
    );
  }

  get puedeExportar(): boolean {
    return (
      this.puedeAccion("exportar") &&
      (this.resultado()?.ofertas.length ?? 0) > 0
    );
  }

  get puedeVerOferta(): boolean {
    return this.puedeAccion("ver-oferta");
  }

  readonly pasosProceso = computed<readonly PasoLineaEstados[]>(() => {
    const solicitud = this.solicitud();
    const etiquetas = [
      "Abierta",
      "Cerrada",
      "En evaluación",
      "Decisión",
      "Validación OG",
      "Resultado",
    ];
    if (!solicitud) {
      return etiquetas.map((etiqueta) => ({
        etiqueta,
        estado: "pendiente" as const,
      }));
    }

    const cerrada = this.permisos.puedeVerOfertas(solicitud);
    let actual = cerrada ? 2 : 0;
    if (cerrada) {
      switch (solicitud.estado) {
        case "en-aprobacion":
          actual = 3;
          break;
        case "adjudicada":
        case "desierta":
        case "cancelada":
          actual = 5;
          break;
        default:
          actual = 2;
      }
    }
    return etiquetas.map((etiqueta, indice) => ({
      etiqueta,
      estado:
        indice < actual
          ? ("completado" as const)
          : indice === actual
            ? ("actual" as const)
            : ("pendiente" as const),
    }));
  });

  readonly ficha = computed(() => {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return null;
    }
    const responsable = solicitud.general.responsable;
    return {
      objeto: solicitud.titulo,
      dependencia: solicitud.dependencia,
      ordenador: [responsable.ordenadorGasto, responsable.ordenadorCargo]
        .filter(Boolean)
        .join(" "),
      criterio: this.criterioVisible || "Por definir",
      plazo:
        solicitud.contratacion?.plazoEjecucion ||
        solicitud.general.caracteristicas.plazoEjecucion ||
        "Por definir",
      valorCdp: solicitud.presupuesto?.valorCdp ?? 0,
      numeroCdp: solicitud.presupuesto?.saldo.numeroCdp ?? "Sin CDP",
      modalidad:
        solicitud.contratacion?.modalidadSeleccion || "Por definir",
      unidad: etiquetaUnidadEjecutora(solicitud.unidadEjecutora),
      vigencia: solicitud.vigencia,
    };
  });

  readonly barrasPresupuesto = computed(() => {
    const resultado = this.resultado();
    if (!resultado) {
      return [];
    }
    const presupuesto = resultado.valorPresupuesto;
    return resultado.ofertas.map((oferta) => ({
      id: oferta.id,
      nombre: oferta.proveedor.nombre,
      total: oferta.total,
      porcentaje:
        presupuesto > 0 ? (oferta.total / presupuesto) * 100 : 0,
      ancho:
        presupuesto > 0
          ? Math.min(100, (oferta.total / presupuesto) * 100)
          : 0,
      excede: oferta.excedePresupuesto,
      seleccionado: oferta.seleccionado,
    }));
  });

  get ofertasExcluidas(): number {
    return this.resultado()?.excluidas ?? 0;
  }

  get invitadosSinOferta(): number {
    return this.resultado()?.invitadosSinOferta ?? 0;
  }

  /* ── Acciones ──────────────────────────────────────────────────────────── */

  async preseleccionar(oferta: OfertaComparada): Promise<void> {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedePreseleccionar(oferta)) {
      return;
    }

    const reemplaza = !!this.ofertaPreseleccionada;
    const confirmacion = await this.alerta.showConfirmAlert(
      reemplaza
        ? `Se reemplazará la preselección actual por ${oferta.proveedor.nombre}. Esta acción es una recomendación y no constituye adjudicación (RN-34).`
        : `Se preseleccionará la oferta de ${oferta.proveedor.nombre} por ${formatoCop(oferta.total)}. Esta acción es una recomendación y no constituye adjudicación (RN-34).`,
      reemplaza ? "Reemplazar preselección" : "Preseleccionar oferta",
    );
    if (!confirmacion.isConfirmed) {
      return;
    }

    this.preseleccionando.set(true);
    this.servicio
      .seleccionarOferente(solicitud, oferta.id, this.oferenteIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.aplicarResultado(resultado, true);
          this.preseleccionando.set(false);
          void this.alerta.showSuccessAlert(
            `${oferta.proveedor.nombre} quedó preseleccionada. La decisión final corresponde al Ordenador del Gasto.`,
            "Preselección registrada",
          );
        },
        error: (error: Error) => {
          this.preseleccionando.set(false);
          void this.alerta.showErrorAlert(
            error.message ||
              "No fue posible registrar la preselección. Intente nuevamente.",
          );
        },
      });
  }

  async quitarPreseleccion(): Promise<void> {
    const solicitud = this.solicitud();
    const oferta = this.ofertaPreseleccionada;
    if (!solicitud || !oferta || !this.puedeQuitarPreseleccion()) {
      return;
    }

    const confirmacion = await this.alerta.showConfirmAlert(
      `Se retirará la preselección de ${oferta.proveedor.nombre}. La decisión final sigue en cabeza del Ordenador del Gasto.`,
      "Quitar preselección",
    );
    if (!confirmacion.isConfirmed) {
      return;
    }

    this.preseleccionando.set(true);
    this.servicio
      .seleccionarOferente(solicitud, null, this.oferenteIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.aplicarResultado(resultado, true);
          this.preseleccionando.set(false);
          void this.alerta.showSuccessAlert(
            "La preselección fue retirada del expediente.",
            "Preselección retirada",
          );
        },
        error: (error: Error) => {
          this.preseleccionando.set(false);
          void this.alerta.showErrorAlert(
            error.message ||
              "No fue posible retirar la preselección. Intente nuevamente.",
          );
        },
      });
  }

  verOferta(oferta: OfertaComparada): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedeVerOferta) {
      return;
    }
    const comandos = this.permisos.rutaAccionComparador(
      "ver-oferta",
      solicitud.id,
      oferta.id,
    );
    if (!comandos) {
      return;
    }
    void this.router.navigate(comandos, {
      queryParams: {
        volver: "comparador",
        proveedor: oferta.proveedor.nit,
      },
    });
  }

  continuarDecision(): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedeContinuarDecision) {
      return;
    }
    const comandos = this.permisos.rutaAccionComparador(
      "continuar-decision",
      solicitud.id,
    );
    if (comandos) {
      void this.router.navigate(comandos);
    }
  }

  exportar(formato: "xlsx" | "pdf"): void {
    if (!this.puedeExportar) {
      return;
    }
    void this.alerta.showAlert(
      `Exportar comparativo a ${formato === "xlsx" ? "Excel (.xlsx)" : "PDF (.pdf)"}`,
      "La exportación institucional del comparador se habilitará cuando el gestor documental esté conectado. Operación simulada y formato pendiente de definición.",
    );
  }

  descargarAnexo(oferta: OfertaComparada): void {
    void this.alerta.showAlert(
      "Descargar anexo técnico",
      `El gestor documental aún no está conectado. Anexo solicitado: ${oferta.anexoTecnico}.`,
    );
  }

  /* ── Navegación y estados ──────────────────────────────────────────────── */

  verSolicitud(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
      ]);
    }
  }

  volverAlTablero(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "oferentes",
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
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
