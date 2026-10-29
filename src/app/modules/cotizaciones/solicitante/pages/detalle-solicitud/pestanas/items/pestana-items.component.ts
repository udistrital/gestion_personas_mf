import { Component, computed, inject, signal } from "@angular/core";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ETIQUETAS_TIPO_NECESIDAD,
  ItemSolicitud,
  TipoItem,
  resumirItems,
} from "../../../../../models/items.model";
import { ItemsDetalle } from "../../../../../models/detalle-solicitud.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/** Opciones del filtro por tipo de ítem. */
type FiltroTipoItem = "todos" | "bien" | "servicio";

/** Opciones de "filas por página" del mockup. */
const FILAS_POR_PAGINA = [5, 10, 20] as const;

/**
 * Pestaña "Ítems" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura el pliego consolidado: la tarjeta resumen (totales y
 * clasificación), la unidad ejecutora, y la tabla de ítems con búsqueda, filtro
 * por tipo y paginación. Los ítems reutilizan el mismo modelo del asistente
 * (S-02), de modo que no hay dos definiciones del mismo concepto.
 *
 * La solicitud la entrega el armazón a través de `SolicitudDetalleStore`, así
 * que la pestaña no repite la petición ni conoce estados de la solicitud. Los
 * totales salen de `resumirItems`, no se escriben a mano.
 */
@Component({
  selector: "app-pestana-items",
  templateUrl: "./pestana-items.component.html",
  styleUrls: ["./pestana-items.component.scss"],
  standalone: false,
})
export class PestanaItemsComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly alerta = inject(AlertService);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Cabecera de la pestaña (unidad ejecutora y sede de entrega). */
  readonly cabecera = computed<ItemsDetalle | null>(
    () => this.solicitud()?.itemsDetalle ?? null,
  );

  /** Todos los ítems del pliego. */
  readonly items = computed<readonly ItemSolicitud[]>(
    () => this.solicitud()?.items ?? [],
  );

  /** Resumen numérico de los ítems (totales, bienes, servicios y clasificación). */
  readonly resumen = computed(() => resumirItems(this.items()));

  /** Etiqueta legible de la clasificación ("Bienes y servicios (Mixta)"). */
  readonly etiquetaTipoNecesidad = computed(
    () => ETIQUETAS_TIPO_NECESIDAD[this.resumen().tipo],
  );

  /** Opciones de "filas por página". */
  readonly opcionesPorPagina = FILAS_POR_PAGINA;

  /** Texto de búsqueda por código, nombre o descripción. */
  readonly filtro = signal("");

  /** Tipo activo del selector segmentado. */
  readonly tipoActivo = signal<FiltroTipoItem>("todos");

  /** Página activa de la tabla. */
  readonly pagina = signal(1);

  /** Filas por página elegidas. */
  readonly porPagina = signal<number>(FILAS_POR_PAGINA[0]);

  /** Ítems que cumplen el filtro de texto y de tipo. */
  readonly itemsFiltrados = computed<readonly ItemSolicitud[]>(() => {
    const termino = this.filtro().trim().toLowerCase();
    const tipo = this.tipoActivo();
    return this.items().filter((item) => {
      if (tipo !== "todos" && item.tipo !== tipo) {
        return false;
      }
      if (!termino) {
        return true;
      }
      return (
        item.nombre.toLowerCase().includes(termino) ||
        item.descripcion.toLowerCase().includes(termino)
      );
    });
  });

  /** Número total de páginas del resultado filtrado. */
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.itemsFiltrados().length / this.porPagina())),
  );

  /** Ítems visibles en la página activa. */
  readonly itemsPagina = computed<readonly ItemSolicitud[]>(() => {
    const inicio = (this.pagina() - 1) * this.porPagina();
    return this.itemsFiltrados().slice(inicio, inicio + this.porPagina());
  });

  /** Rango visible en el pie de la tabla ("1-5 de 18"). */
  readonly rangoPagina = computed(() => {
    const total = this.itemsFiltrados().length;
    if (!total) {
      return { desde: 0, hasta: 0, total };
    }
    const desde = (this.pagina() - 1) * this.porPagina() + 1;
    return {
      desde,
      hasta: Math.min(desde + this.porPagina() - 1, total),
      total,
    };
  });

  /** Números de página del paginador. */
  readonly paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, indice) => indice + 1),
  );

  /** Número consecutivo de la fila dentro del resultado filtrado. */
  numeroFila(indice: number): number {
    return this.rangoPagina().desde + indice;
  }

  /** Icono Material del tipo de ítem. */
  iconoTipo(tipo: TipoItem): string {
    return tipo === "bien" ? "devices" : "room_service";
  }

  /** Etiqueta legible del tipo ("Bien" / "Servicio"). */
  etiquetaTipo(tipo: TipoItem): string {
    return tipo === "bien" ? "Bien" : "Servicio";
  }

  /** Clase del chip de tipo: vino para bienes, secundario para servicios. */
  claseTipo(tipo: TipoItem): string {
    return tipo === "bien" ? "chip chip--bien" : "chip chip--servicio";
  }

  /** Clase de la nota técnica según el tipo (verde bien / vino servicio). */
  claseNota(tipo: TipoItem): string {
    return tipo === "bien" ? "item__nota item__nota--bien" : "item__nota item__nota--servicio";
  }

  /** Aplica el filtro de texto y reinicia la paginación. */
  alBuscar(evento: Event): void {
    this.filtro.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  /** Aplica el filtro por tipo y reinicia la paginación. */
  filtrarPorTipo(tipo: FiltroTipoItem): void {
    this.tipoActivo.set(tipo);
    this.pagina.set(1);
  }

  /** Cambia la página activa dentro del rango válido. */
  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) {
      return;
    }
    this.pagina.set(pagina);
  }

  /** Cambia el número de filas por página y vuelve a la primera. */
  cambiarPorPagina(evento: Event): void {
    this.porPagina.set(Number((evento.target as HTMLSelectElement).value));
    this.pagina.set(1);
  }

  /** Exportación simulada del listado (pendiente del servicio de reportes). */
  exportar(): void {
    this.alerta.showAlert(
      "Exportación en preparación",
      "La exportación del listado de ítems a CSV / Excel se habilitará cuando el servicio de reportes institucional esté conectado.",
    );
  }
}
