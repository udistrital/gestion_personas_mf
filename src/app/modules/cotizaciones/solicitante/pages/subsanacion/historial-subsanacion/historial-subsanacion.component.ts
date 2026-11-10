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
import { interval } from "rxjs";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type {
  EtiquetaLineaTiempo,
  EventoLineaTiempo,
} from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import { ResultadoResolverSolicitud } from "../../../../resolvers/solicitud.resolver";
import { formatoFechaHoraOferente } from "../../../../models/oferente.model";
import type { SolicitudDetalle } from "../../../../models/solicitud.model";
import type {
  EventoSubsanacion,
  HistorialSubsanacion,
  ResumenOferenteSubsanacion,
  Subsanacion,
} from "../../../../models/subsanacion.model";
import {
  estadoSubsanacion,
  metaEventoSubsanacion,
} from "../../../../models/subsanacion.model";
import { SubsanacionService } from "../../../../services/subsanacion.service";

type EstadoVista =
  | "cargando"
  | "listo"
  | "sin-actuaciones"
  | "error"
  | "no-encontrado"
  | "no-disponible"
  | "sin-permiso";

interface DocumentoFiltro {
  readonly id: string;
  readonly nombre: string;
}

/**
 * Historial y auditoría de la subsanación documental (S-12b).
 *
 * Es una vista propia, no una pestaña de S-03. Reutiliza `linea-tiempo` con una
 * plantilla de detalle para la comparación de archivos y muestra el estado por
 * oferente en la columna derecha.
 */
@Component({
  selector: "app-historial-subsanacion",
  templateUrl: "./historial-subsanacion.component.html",
  styleUrls: ["./historial-subsanacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class HistorialSubsanacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(SubsanacionService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly historial = signal<HistorialSubsanacion | null>(null);
  readonly ahora = signal(Date.now());
  readonly busqueda = signal("");
  readonly oferenteId = signal("todos");
  readonly documentoId = signal("todos");
  readonly anuncio = signal("");

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Historial de subsanación</b></p>";

  readonly subsanacion = computed<Subsanacion | null>(
    () => this.historial()?.subsanacion ?? null,
  );

  readonly estadoPeriodo = computed(() => {
    const periodo = this.subsanacion();
    return periodo ? estadoSubsanacion(periodo, this.ahora()) : null;
  });

  readonly eventos = computed<readonly EventoSubsanacion[]>(
    () => this.historial()?.eventos ?? [],
  );

  readonly resumen = computed(() => this.historial()?.resumen ?? null);

  readonly oferentes = computed<readonly ResumenOferenteSubsanacion[]>(
    () => this.resumen()?.porOferente ?? [],
  );

  readonly oferentesFiltro = computed(() =>
    (this.subsanacion()?.oferentes ?? []).map((oferente) => ({
      id: oferente.proveedorId,
      nombre: oferente.nombre,
    })),
  );

  readonly documentosFiltro = computed<readonly DocumentoFiltro[]>(() => {
    const mapa = new Map<string, string>();
    for (const oferente of this.subsanacion()?.oferentes ?? []) {
      for (const documento of oferente.documentos) {
        if (documento.seleccionado) {
          mapa.set(documento.id, documento.nombre);
        }
      }
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }));
  });

  readonly eventosFiltrados = computed<readonly EventoSubsanacion[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const oferenteId = this.oferenteId();
    const documentoId = this.documentoId();

    return this.eventos().filter((evento) => {
      if (oferenteId !== "todos" && evento.oferenteId !== oferenteId) {
        return false;
      }
      if (documentoId !== "todos" && evento.documentoId !== documentoId) {
        return false;
      }
      if (!texto) {
        return true;
      }
      const campos = [
        metaEventoSubsanacion(evento.tipo).titulo,
        evento.detalleHtml ?? "",
        evento.justificacion ?? "",
        evento.usuario,
        evento.nombreUsuario ?? "",
        evento.rol,
        evento.oferenteNombre ?? "",
        evento.documentoNombre ?? "",
        evento.hash ?? "",
        evento.radicado ?? "",
        formatoFechaHoraOferente(evento.fecha),
      ];
      return campos.some((campo) => campo.toLowerCase().includes(texto));
    });
  });

  readonly lineaTiempo = computed<readonly EventoLineaTiempo[]>(() =>
    this.eventosFiltrados().map((evento) => this.mapearEvento(evento)),
  );

  readonly esActiva = computed(
    () =>
      this.estadoPeriodo() === "activa" ||
      this.estadoPeriodo() === "configurada",
  );

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;

    if (resolucion.estado !== "ok") {
      this.vista.set(
        resolucion.estado === "no-encontrada" ? "no-encontrado" : "error",
      );
      if (resolucion.estado === "error") {
        this.mensajeError.set(resolucion.mensaje);
      }
      return;
    }

    const solicitud = resolucion.solicitud;
    this.solicitud.set(solicitud);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${solicitud.id} › Subsanación › <b>Historial de cambios</b></p>`;
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.ahora.set(Date.now()));

    if (!this.permisos.puedeVerSubsanacionPorRol()) {
      this.vista.set("sin-permiso");
      return;
    }

    if (!this.permisos.puedeVerOfertas(solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    if (!this.permisos.puedeAccederSubsanacion(solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    if (!solicitud.subsanacion) {
      this.vista.set("sin-actuaciones");
      return;
    }

    this.cargar();
  }

  cargar(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    this.servicio
      .obtenerHistorial(solicitud)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (historial) => {
          this.historial.set(historial);
          this.ahora.set(Date.now());
          if (!historial) {
            this.vista.set("sin-actuaciones");
            return;
          }
          this.vista.set("listo");
          this.anuncio.set(
            `Historial cargado con ${historial.eventos.length} eventos.`,
          );
        },
        error: (fallo: Error) => {
          this.mensajeError.set(
            fallo.message ||
              "No fue posible consultar el historial de subsanación. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /* ── Filtros ──────────────────────────────────────────────────────────── */

  buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  filtrarOferente(valor: string): void {
    this.oferenteId.set(valor);
  }

  filtrarDocumento(valor: string): void {
    this.documentoId.set(valor);
  }

  limpiarFiltros(): void {
    this.busqueda.set("");
    this.oferenteId.set("todos");
    this.documentoId.set("todos");
  }

  /* ── Navegación y acciones ────────────────────────────────────────────── */

  volver(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes"]);
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "subsanacion",
    ]);
  }

  verCotizacion(proveedorId: string): void {
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
      { queryParams: { volver: "subsanacion", tab: "cotizacion" } },
    );
  }

  verPersona(proveedorId: string): void {
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
      { queryParams: { volver: "subsanacion", tab: "persona" } },
    );
  }

  exportar(tipo: "pdf" | "excel"): void {
    void this.alerta.showAlert(
      tipo === "pdf" ? "Exportar Acta (PDF)" : "Exportar Registro de Eventos (Excel)",
      "La exportación institucional del historial se habilitará cuando el gestor documental y el repositorio de auditoría estén conectados. Operación simulada.",
    );
  }

  descargarActa(): void {
    void this.alerta.showAlert(
      "Descargar Acta de Cierre (PDF)",
      "El acta de cierre se generará cuando el backend emita el documento oficial. Operación simulada.",
    );
  }

  descargarArchivo(nombre: string): void {
    void this.alerta.showAlert(
      `Descargar ${nombre}`,
      "La descarga real estará disponible cuando se conecte el gestor documental institucional. Operación simulada.",
    );
  }

  reintentar(): void {
    if (this.solicitud()) {
      this.cargar();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }

  /* ── Presentación ─────────────────────────────────────────────────────── */

  eventoPorId(id: string): EventoSubsanacion | null {
    return this.eventos().find((evento) => evento.id === id) ?? null;
  }

  formatear(iso: string): string {
    return formatoFechaHoraOferente(iso);
  }

  avanceOferente(resumen: ResumenOferenteSubsanacion): string {
    return `${resumen.subsanados}/${resumen.total}`;
  }

  etiquetaPeriodo(): string {
    switch (this.estadoPeriodo()) {
      case "configurada":
        return "PROGRAMADO";
      case "activa":
        return "EN CURSO";
      case "vencida":
        return "FINALIZADO";
      case "cancelada":
        return "CANCELADO";
      default:
        return "—";
    }
  }

  private mapearEvento(evento: EventoSubsanacion): EventoLineaTiempo {
    const meta = metaEventoSubsanacion(evento.tipo);
    const etiquetas: EtiquetaLineaTiempo[] = [
      { texto: meta.etiqueta, tono: "neutro" },
    ];
    if (!evento.dentroDelPeriodo) {
      etiquetas.push({ texto: "Fuera del periodo", tono: "advertencia" });
    }

    return {
      id: evento.id,
      titulo: meta.titulo,
      icono: meta.icono,
      tono: meta.tono,
      fecha: formatoFechaHoraOferente(evento.fecha),
      fechaIso: evento.fecha,
      etiquetas,
      resultado: {
        texto: meta.resultado,
        tono: meta.tonoResultado,
      },
      detalle: evento.detalleHtml,
      autor: {
        usuario: evento.usuario,
        nombre: evento.nombreUsuario,
        rol: evento.rol,
      },
      evidencia: evento.hash
        ? { icono: "fingerprint", texto: evento.hash }
        : evento.radicado
          ? { icono: "fact_check", texto: `Radicado ${evento.radicado}` }
          : undefined,
    };
  }
}
