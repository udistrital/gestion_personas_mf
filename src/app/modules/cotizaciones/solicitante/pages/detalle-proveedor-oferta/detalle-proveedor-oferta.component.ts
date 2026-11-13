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
import type { AccionDetalleProveedor } from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import type {
  EtiquetaLineaTiempo,
  EventoLineaTiempo,
} from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import { AlertService } from "src/app/shared/services/alert.service";
import { ResultadoResolverSolicitud } from "../../../resolvers/solicitud.resolver";
import { decisionDeProveedor } from "../../../models/decision.model";
import {
  estadoSubsanacion,
  eventoDocumento,
} from "../../../models/subsanacion.model";
import {
  formatoPorcentaje,
  type OfertaComparada,
} from "../../../models/comparativo.model";
import type {
  DetalleProveedorOferta,
  DocumentoOfertaRadicado,
  EventoOferta,
} from "../../../models/detalle-proveedor-oferta.model";
import { formatoCop } from "../../../models/necesidad.model";
import { identidadProveedor } from "../../../models/proveedores.model";
import type { SolicitudDetalle } from "../../../models/solicitud.model";
import type { ItemSolicitud } from "../../../models/items.model";
import type { ItemRespuestaProveedor } from "../../../models/respuesta-proveedor.model";
import { OferentesService } from "../../../services/oferentes.service";

type EstadoVista =
  | "cargando"
  | "listo"
  | "sin-oferta"
  | "error"
  | "bloqueado"
  | "no-disponible"
  | "no-encontrado";

type EstadoResolucion = "ok" | "no-encontrada" | "error";
type PestanaDetalle = "cotizacion" | "persona" | "respuesta";
type OrigenDetalle = "comparador" | "oferentes" | "subsanacion";

/** Fila de la tabla de ítems, calculada para la plantilla. */
interface FilaItemOferta {
  readonly item: ItemSolicitud;
  readonly respuesta: ItemRespuestaProveedor | undefined;
  readonly valorUnitario: number;
  readonly subtotal: number;
  readonly iva: number;
  readonly total: number;
  readonly baseGravable: number;
  readonly etiquetaIva: string;
  readonly nota: string;
  readonly superaTecho: boolean;
}

/**
 * Detalle del proveedor y su oferta (S-10).
 *
 * Vista de solo lectura para JD y OG. La oferta llega de `OferentesService`,
 * que compone el tablero de S-07 y el comparativo de S-09. La decisión final no
 * se registra aquí: el botón hacia S-11 solo navega (RN-34).
 *
 * RN-29 se aplica antes de consultar: antes del cierre no se exponen ofertas.
 * La preselección reutiliza el servicio de S-09 y mantiene una sola selección
 * por solicitud.
 *
 * Provisional: los datos sensibles del proveedor se muestran como "Por definir"
 * para JD y OG; la visibilidad diferencial por rol y el desenmascaramiento con
 * auditoría no están definidos. La subsanación (S-12) tampoco existe todavía.
 */
@Component({
  selector: "app-detalle-proveedor-oferta",
  templateUrl: "./detalle-proveedor-oferta.component.html",
  styleUrls: ["./detalle-proveedor-oferta.component.scss"],
  standalone: false,
})
export class DetalleProveedorOfertaComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(OferentesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly moneda = formatoCop;
  readonly porcentaje = formatoPorcentaje;

  readonly pestanas: readonly {
    readonly id: PestanaDetalle;
    readonly etiqueta: string;
    readonly icono: string;
  }[] = [
    {
      id: "cotizacion",
      etiqueta: "1. Cotización",
      icono: "request_quote",
    },
    {
      id: "persona",
      etiqueta: "2. Persona (detalle del proveedor)",
      icono: "badge",
    },
    {
      id: "respuesta",
      etiqueta: "3. Respuesta del ordenador del gasto",
      icono: "gavel",
    },
  ];

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Detalle del proveedor</b></p>";

  readonly estadoResolucion = signal<EstadoResolucion>("ok");
  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly detalle = signal<DetalleProveedorOferta | null>(null);
  readonly pestana = signal<PestanaDetalle>("cotizacion");
  readonly anuncio = signal("");
  readonly descargando = signal<string | null>(null);
  readonly errorDescarga = signal("");

  private readonly proveedorId = signal("");
  private origen: OrigenDetalle = "oferentes";
  private vigiaCierre?: Subscription;
  private cargaActual?: Subscription;

  readonly oferta = computed<OfertaComparada | null>(
    () => this.detalle()?.oferta ?? null,
  );

  readonly identidad = computed(() => {
    const detalle = this.detalle();
    if (!detalle) {
      return null;
    }
    return (
      detalle.oferta?.identidad ??
      identidadProveedor(detalle.oferente.proveedor)
    );
  });

  readonly documentos = computed<readonly DocumentoOfertaRadicado[]>(() => {
    const documentos = this.detalle()?.documentos ?? [];
    const periodo = this.solicitud()?.subsanacion;
    if (!periodo) {
      return documentos;
    }
    const oferente = periodo.oferentes.find(
      (item) => item.proveedorId === this.proveedorId(),
    );
    if (!oferente) {
      return documentos;
    }
    return documentos.map((documento) => {
      const configurado = oferente.documentos.find(
        (item) => item.id === documento.requisitoId || item.id === documento.id,
      );
      if (!configurado) {
        return documento;
      }
      const evento = eventoDocumento(
        periodo,
        this.proveedorId(),
        configurado.id,
      );
      const vencida = estadoSubsanacion(periodo) === "vencida";
      const estado: DocumentoOfertaRadicado["estado"] = evento
        ? "subsanado"
        : configurado.seleccionado
          ? vencida
            ? "no-subsanado"
            : "pendiente"
          : documento.estado;
      return { ...documento, estado };
    });
  });

  readonly documentoPrincipal = computed<DocumentoOfertaRadicado | null>(
    () => this.documentos().find((documento) => documento.principal) ?? null,
  );

  readonly documentosAdicionales = computed<readonly DocumentoOfertaRadicado[]>(
    () => this.documentos().filter((documento) => !documento.principal),
  );

  readonly resumenDocumentos = computed(() => {
    const documentos = this.documentos();
    return {
      total: documentos.length,
      cargados: documentos.filter(
        (documento) =>
          documento.estado === "cargado" || documento.estado === "subsanado",
      ).length,
      obligatorios: documentos.filter(
        (documento) => documento.clasificacion === "obligatorio",
      ).length,
      complementarios: documentos.filter(
        (documento) => documento.clasificacion === "complementario",
      ).length,
    };
  });

  readonly historial = computed<readonly EventoOferta[]>(
    () => this.detalle()?.historial ?? [],
  );

  readonly lineaTiempo = computed<readonly EventoLineaTiempo[]>(() =>
    this.historial().map((evento) => this.mapearEvento(evento)),
  );

  readonly actividades = computed(
    () => this.detalle()?.actividades ?? [],
  );

  readonly navegacion = computed(() => this.detalle()?.navegacion ?? null);

  /** Última decisión registrada para este proveedor (actual o histórica). */
  readonly decisionProveedor = computed(() => {
    const solicitud = this.solicitud();
    return solicitud ? decisionDeProveedor(solicitud, this.proveedorId()) : null;
  });

  readonly estadoDecision = computed<
    "pendiente" | "aprobada" | "rechazada" | null
  >(() => {
    const decision = this.decisionProveedor();
    if (!decision) {
      return null;
    }
    if (decision.fase === "enviada") {
      return "pendiente";
    }
    return decision.fase === "aprobada" ? "aprobada" : "rechazada";
  });

  readonly etiquetaDecision = computed(() => {
    switch (this.estadoDecision()) {
      case "pendiente":
        return "En validación";
      case "aprobada":
        return "Aprobada";
      case "rechazada":
        return "Rechazada";
      default:
        return "";
    }
  });

  readonly justificacionDecision = computed(() => {
    const decision = this.decisionProveedor();
    if (!decision) {
      return "";
    }
    return (
      decision.validacion?.justificacionHtml ??
      decision.envio.justificacionHtml
    );
  });

  readonly notificacionesDecision = computed(
    () => this.decisionProveedor()?.notificaciones ?? [],
  );

  readonly acciones = computed<readonly AccionDetalleProveedor[]>(() => {
    const solicitud = this.solicitud();
    return solicitud
      ? this.permisos.accionesDetalleProveedorPermitidas(solicitud)
      : [];
  });

  readonly filasItems = computed<readonly FilaItemOferta[]>(() => {
    const solicitud = this.solicitud();
    const oferta = this.oferta();
    if (!solicitud || !oferta) {
      return [];
    }

    const factorDescuento =
      oferta.subtotal > 0
        ? oferta.oferta.totales.baseGravable / oferta.subtotal
        : 1;

    return solicitud.items.map((item) => {
      const respuesta = oferta.oferta.items.find(
        (fila) => fila.itemId === item.id,
      );
      const valorUnitario = respuesta?.valorUnitario ?? 0;
      const subtotal = item.cantidad * valorUnitario;
      const baseGravable = subtotal * factorDescuento;
      const tasa = this.tasaIva(respuesta?.iva);
      const iva = baseGravable * (tasa / 100);

      return {
        item,
        respuesta,
        valorUnitario,
        subtotal,
        iva,
        total: baseGravable + iva,
        baseGravable,
        etiquetaIva: this.etiquetaIva(respuesta?.iva),
        nota: respuesta?.nota?.trim() || "",
        superaTecho:
          item.valorUnitarioTecho != null &&
          valorUnitario > item.valorUnitarioTecho,
      };
    });
  });

  readonly pestanasVisibles = computed(() =>
    this.pestanas.filter((pestana) => {
      if (this.vista() === "sin-oferta") {
        return pestana.id === "persona";
      }
      if (pestana.id === "respuesta") {
        return !!this.decisionProveedor();
      }
      return true;
    }),
  );

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;
    this.proveedorId.set(
      this.ruta.snapshot.paramMap.get("proveedorId") ?? "",
    );
    this.leerQueryParams();

    if (resolucion.estado !== "ok") {
      this.estadoResolucion.set(resolucion.estado);
      if (resolucion.estado === "error") {
        this.mensajeError.set(resolucion.mensaje);
      }
      return;
    }

    this.solicitud.set(resolucion.solicitud);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${resolucion.solicitud.id} › Evaluación › <b>Detalle del proveedor</b></p>`;

    if (!this.permisos.puedeAccederDetalleProveedor(resolucion.solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    if (!this.permisos.puedeVerOfertas(resolucion.solicitud)) {
      this.vista.set("bloqueado");
      this.vigilarCierre(resolucion.solicitud);
      return;
    }

    this.cargar();
    this.ruta.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get("proveedorId") ?? "";
        if (id && id !== this.proveedorId()) {
          this.proveedorId.set(id);
          this.cargar();
        }
      });

    this.ruta.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.origen =
          params.get("volver") === "comparador" ? "comparador" : "oferentes";
        const tab = params.get("tab");
        if (
          tab &&
          this.esPestana(tab) &&
          this.vista() !== "sin-oferta" &&
          this.vista() !== "cargando" &&
          this.pestanasVisibles().some((pestana) => pestana.id === tab)
        ) {
          this.pestana.set(tab);
        }
      });
  }

  /* ── Carga ─────────────────────────────────────────────────────────────── */

  cargar(): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.proveedorId()) {
      this.vista.set("no-encontrado");
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    this.detalle.set(null);
    this.errorDescarga.set("");
    this.cargaActual?.unsubscribe();

    this.cargaActual = this.servicio
      .obtenerDetalleProveedor(solicitud, this.proveedorId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          if (!detalle) {
            this.vista.set("no-encontrado");
            return;
          }

          this.detalle.set(detalle);
          this.vista.set(detalle.oferta ? "listo" : "sin-oferta");
          if (!detalle.oferta) {
            this.pestana.set("persona");
            this.anuncio.set(
              `${detalle.oferente.proveedor.nombre} no presentó cotización.`,
            );
          } else {
            if (this.pestana() === "respuesta" && !this.decisionProveedor()) {
              this.pestana.set("cotizacion");
            }
            this.anuncio.set(
              `Detalle de ${detalle.oferente.proveedor.nombre} y su oferta cargado.`,
            );
          }
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar el detalle del proveedor. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /**
   * RN-29: si la vista queda abierta antes del cierre, al llegar la fecha se
   * consulta la oferta sin obligar a recargar.
   */
  private vigilarCierre(solicitud: SolicitudDetalle): void {
    this.vigiaCierre = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.permisos.puedeVerOfertas(solicitud)) {
          this.vigiaCierre?.unsubscribe();
          this.solicitud.set({ ...solicitud });
          this.cargar();
        }
      });
  }

  /* ── Pestañas ──────────────────────────────────────────────────────────── */

  cambiarPestana(pestana: PestanaDetalle): void {
    if (!this.pestanasVisibles().some((item) => item.id === pestana)) {
      return;
    }
    this.pestana.set(pestana);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tab: pestana },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  moverPestana(direccion: 1 | -1, evento: Event): void {
    evento.preventDefault();
    const visibles = this.pestanasVisibles();
    if (visibles.length < 2) {
      return;
    }
    const indice = visibles.findIndex(
      (pestana) => pestana.id === this.pestana(),
    );
    const siguiente =
      visibles[(indice + direccion + visibles.length) % visibles.length];
    this.cambiarPestana(siguiente.id);
  }

  chipPestana(pestana: PestanaDetalle): string {
    switch (pestana) {
      case "cotizacion":
        return this.oferta()?.version ?? "Sin oferta";
      case "persona":
        return "Registro UD";
      case "respuesta": {
        const estado = this.estadoDecision();
        if (!estado) {
          return "OG";
        }
        return estado === "pendiente"
          ? "Pendiente"
          : estado === "aprobada"
            ? "Aprobada"
            : "Rechazada";
      }
    }
  }

  private esPestana(valor: string): valor is PestanaDetalle {
    return valor === "cotizacion" || valor === "persona" || valor === "respuesta";
  }

  private leerQueryParams(): void {
    const params = this.ruta.snapshot.queryParamMap;
    this.origen =
      params.get("volver") === "comparador"
        ? "comparador"
        : params.get("volver") === "subsanacion"
          ? "subsanacion"
          : "oferentes";
    const tab = params.get("tab");
    if (tab && this.esPestana(tab)) {
      this.pestana.set(tab);
    }
  }

  /* ── Permisos y acciones ───────────────────────────────────────────────── */

  get puedeEnviarAValidacion(): boolean {
    const solicitud = this.solicitud();
    return (
      !!solicitud &&
      this.vista() === "listo" &&
      this.acciones().includes("continuar-decision") &&
      this.permisos.puedeEnviarAValidacion(solicitud, this.proveedorId())
    );
  }

  get puedeDescargarCotizacion(): boolean {
    const principal = this.documentoPrincipal();
    return !!principal && principal.formatoValido;
  }

  get etiquetaVolver(): string {
    if (this.origen === "comparador") {
      return "Volver al comparador";
    }
    if (this.origen === "subsanacion") {
      return "Volver a la subsanación";
    }
    return "Volver al tablero de oferentes";
  }

  get puedeAbrirSubsanacion(): boolean {
    const solicitud = this.solicitud();
    return (
      !!solicitud &&
      this.vista() === "listo" &&
      (this.permisos.puedeConfigurarSubsanacion(solicitud) ||
        !!solicitud.subsanacion)
    );
  }

  get etiquetaSubsanacion(): string {
    return this.solicitud()?.subsanacion
      ? "Subsanación documental"
      : "Habilitar subsanación";
  }

  abrirSubsanacion(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate(
      ["/cotizaciones", "solicitudes", solicitud.id, "subsanacion"],
      {
        queryParams: {
          volver: "detalle",
          proveedorId: this.proveedorId(),
        },
      },
    );
  }

  get etiquetaDocumento(): string {
    return this.identidad()?.tipoPersona === "natural"
      ? "Documento"
      : "NIT";
  }

  get ariaAnterior(): string {
    const anterior = this.navegacion()?.anterior;
    return anterior
      ? `Oferente anterior: ${anterior.nombre}`
      : "No hay oferente anterior";
  }

  get ariaSiguiente(): string {
    const siguiente = this.navegacion()?.siguiente;
    return siguiente
      ? `Oferente siguiente: ${siguiente.nombre}`
      : "No hay oferente siguiente";
  }

  get fechaLimite(): string {
    const cierre = this.solicitud()?.cierre;
    return cierre ? `${cierre} 23:59:59 COT` : "Sin fecha de cierre";
  }

  etiquetaEstadoDocumento(documento: DocumentoOfertaRadicado): string {
    switch (documento.estado) {
      case "cargado":
        return "Cargado";
      case "subsanado":
        return "Subsanado";
      case "pendiente":
        return "Pendiente";
      case "no-subsanado":
        return "No subsanado";
    }
  }

  diferenciaPresupuesto(oferta: OfertaComparada): string {
    if (oferta.valorPresupuesto <= 0) {
      return "Sin CDP registrado";
    }
    if (oferta.excedePresupuesto) {
      return `+${this.moneda(oferta.diferencia)} (${this.porcentaje(
        oferta.porcentajePresupuesto,
      )}% del techo)`;
    }
    const ahorro = Math.abs(oferta.diferencia);
    return `-${this.moneda(ahorro)} (ahorro ${this.porcentaje(
      (ahorro / oferta.valorPresupuesto) * 100,
    )}%)`;
  }

  continuarDecision(): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedeEnviarAValidacion) {
      return;
    }
    const comandos = this.permisos.rutaAccionDetalleProveedor(
      "continuar-decision",
      solicitud.id,
    );
    if (comandos) {
      void this.router.navigate(comandos, {
        queryParams: { volver: this.origen, proveedorId: this.proveedorId() },
      });
    }
  }

  /* ── Documentos ────────────────────────────────────────────────────────── */

  verDocumento(documento: DocumentoOfertaRadicado): void {
    this.resolverDocumento(documento, "ver");
  }

  descargarDocumento(documento: DocumentoOfertaRadicado): void {
    this.resolverDocumento(documento, "descargar");
  }

  descargarPrincipal(): void {
    const principal = this.documentoPrincipal();
    if (principal) {
      this.descargarDocumento(principal);
    }
  }

  cerrarErrorDescarga(): void {
    this.errorDescarga.set("");
  }

  private resolverDocumento(
    documento: DocumentoOfertaRadicado,
    accion: "ver" | "descargar",
  ): void {
    const solicitud = this.solicitud();
    const detalle = this.detalle();
    if (!solicitud || !detalle) {
      return;
    }

    this.errorDescarga.set("");
    this.descargando.set(documento.id);

    this.servicio
      .obtenerDocumentoOferta(
        solicitud,
        detalle.oferente.proveedor.id,
        documento.id,
        accion,
      )
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

  /* ── Navegación ────────────────────────────────────────────────────────── */

  volver(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      this.volverAlListado();
      return;
    }

    const destino =
      this.origen === "comparador"
        ? ["/cotizaciones", "solicitudes", solicitud.id, "evaluacion"]
        : this.origen === "subsanacion"
          ? ["/cotizaciones", "solicitudes", solicitud.id, "subsanacion"]
          : ["/cotizaciones", "solicitudes", solicitud.id, "oferentes"];
    void this.router.navigate(destino);
  }

  verSolicitud(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes", solicitud.id]);
    }
  }

  irAnterior(): void {
    const anterior = this.navegacion()?.anterior;
    if (anterior) {
      this.irAProveedor(anterior.id);
    }
  }

  irSiguiente(): void {
    const siguiente = this.navegacion()?.siguiente;
    if (siguiente) {
      this.irAProveedor(siguiente.id);
    }
  }

  private irAProveedor(proveedorId: string): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate(
      [
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
        "proveedores",
        proveedorId,
      ],
      { queryParamsHandling: "preserve" },
    );
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

  /* ── Utilidades de la oferta ───────────────────────────────────────────── */

  private tasaIva(tipo: string | undefined): number {
    switch (tipo) {
      case "19":
        return 19;
      case "5":
        return 5;
      default:
        return 0;
    }
  }

  private etiquetaIva(tipo: string | undefined): string {
    switch (tipo) {
      case "19":
        return "19%";
      case "5":
        return "5%";
      case "0":
        return "0%";
      case "excluido":
        return "Excluido";
      case "exento":
        return "Exento";
      default:
        return "—";
    }
  }

  private mapearEvento(evento: EventoOferta): EventoLineaTiempo {
    const etiquetas: EtiquetaLineaTiempo[] = [
      {
        texto: evento.etiqueta,
        tono: evento.tono === "neutro" ? "neutro" : "primario",
      },
    ];

    return {
      id: evento.id,
      titulo: evento.titulo,
      icono: evento.icono,
      tono: evento.tono,
      fecha: evento.fecha,
      fechaIso: evento.fechaIso,
      etiquetas,
      resultado: { texto: evento.resultado, tono: "primario" },
      detalle: evento.detalleHtml,
      autor: {
        usuario: evento.autor,
        nombre: evento.autor,
        rol: evento.rol,
      },
      evidencia: evento.evidencia,
    };
  }

  /** Vuelve al listado de solicitudes de cotización. */
  volverListaSolicitudes(): void {
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }
}
