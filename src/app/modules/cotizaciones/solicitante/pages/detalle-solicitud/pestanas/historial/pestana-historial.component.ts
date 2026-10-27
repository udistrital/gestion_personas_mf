import { Component, computed, inject, signal } from "@angular/core";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  EventoLineaTiempo,
  EtiquetaLineaTiempo,
} from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { HistorialDetalle } from "../../../../../models/detalle-solicitud.model";
import {
  EventoHistorial,
  TIPOS_EVENTO_HISTORIAL,
  diasEnTramite,
  etiquetaTipoEvento,
} from "../../../../../models/historial.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/**
 * Pestaña "Historial" del detalle de una solicitud (S-03).
 *
 * Muestra la bitácora de eventos del expediente: creación, vinculación
 * presupuestal, radicación, notificaciones y modificaciones, en orden
 * descendente (del más reciente al inicial).
 *
 * La bitácora llega en la solicitud que resolvió el armazón, así que la
 * pestaña no repite la petición y al volver a ella la solicitud sigue
 * cargada. Los eventos son de solo lectura; la única acción (exportar el
 * registro de auditoría) es simulada, como las demás exportaciones del
 * detalle.
 */
@Component({
  selector: "app-pestana-historial",
  templateUrl: "./pestana-historial.component.html",
  styleUrls: ["./pestana-historial.component.scss"],
  standalone: false,
})
export class PestanaHistorialComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly alerta = inject(AlertService);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Bitácora de la solicitud; `null` si aún no tiene eventos. */
  readonly historial = computed<HistorialDetalle | null>(
    () => this.solicitud()?.historial ?? null,
  );

  /** Eventos de la bitácora, del más reciente al más antiguo. */
  readonly eventos = computed<readonly EventoHistorial[]>(
    () => this.historial()?.eventos ?? [],
  );

  /** Tipos de evento disponibles en el filtro. */
  readonly tipos = TIPOS_EVENTO_HISTORIAL;

  /** Tipo de evento seleccionado; "todos" desactiva el filtro. */
  readonly tipoSeleccionado = signal("todos");

  /** Texto del buscador de la bitácora. */
  readonly busqueda = signal("");

  /** Eventos que superan el filtro de tipo y el buscador. */
  readonly eventosFiltrados = computed<readonly EventoHistorial[]>(() => {
    const tipo = this.tipoSeleccionado();
    const texto = this.busqueda().trim().toLowerCase();

    return this.eventos().filter((evento) => {
      if (tipo !== "todos" && evento.tipo !== tipo) {
        return false;
      }
      if (!texto) {
        return true;
      }
      return this.coincide(evento, texto);
    });
  });

  /** Eventos filtrados, mapeados al modelo genérico de la línea de tiempo. */
  readonly lineaTiempo = computed<readonly EventoLineaTiempo[]>(() =>
    this.eventosFiltrados().map((evento) => this.mapear(evento)),
  );

  /** Días calendario en trámite, calculados sobre los eventos registrados. */
  readonly diasTramite = computed(() => diasEnTramite(this.eventos()));

  /** true cuando el filtro dejó la bitácora sin resultados. */
  readonly sinCoincidencias = computed(
    () => this.eventos().length > 0 && this.eventosFiltrados().length === 0,
  );

  /** Aplica el filtro de tipo de evento. */
  filtrarPorTipo(tipo: string): void {
    this.tipoSeleccionado.set(tipo);
  }

  /** Aplica el buscador de la bitácora. */
  buscar(texto: string): void {
    this.busqueda.set(texto);
  }

  /** Exporta el registro de auditoría (operación simulada). */
  exportarCsv(): void {
    this.alerta.showAlert(
      "Exportar bitácora (CSV)",
      "La exportación del registro de auditoría se habilitará cuando el repositorio institucional de bitácora (Ledger UD) esté conectado. Exportación simulada.",
    );
  }

  /**
   * Indica si un evento coincide con el texto buscado.
   *
   * Se busca por usuario, radicado, detalle, rol, resultado y evidencia: el
   * detalle viene con HTML, así que se compara su texto plano.
   */
  private coincide(evento: EventoHistorial, texto: string): boolean {
    const campos = [
      evento.titulo,
      evento.detalle ? textoPlanoDesdeHtml(evento.detalle) : "",
      evento.usuario,
      evento.nombreUsuario ?? "",
      evento.rol,
      evento.resultado ?? "",
      evento.evidencia?.texto ?? "",
      evento.fecha,
    ];

    return campos.some((campo) => campo.toLowerCase().includes(texto));
  }

  /** Mapea un evento de la bitácora al modelo genérico de la línea de tiempo. */
  private mapear(evento: EventoHistorial): EventoLineaTiempo {
    const etiquetas: EtiquetaLineaTiempo[] = [
      { texto: etiquetaTipoEvento(evento.tipo), tono: "neutro" },
    ];

    return {
      id: evento.id,
      titulo: evento.titulo,
      icono: evento.icono,
      tono: evento.tono,
      fecha: evento.fecha,
      fechaIso: evento.fechaIso,
      etiquetas,
      estado: evento.estadoNuevo,
      estadoAnterior: evento.estadoAnterior,
      resultado: evento.resultado
        ? { texto: evento.resultado, tono: evento.tonoResultado ?? "neutro" }
        : undefined,
      detalle: evento.detalle,
      sello: evento.sello,
      autor: {
        usuario: evento.usuario,
        nombre: evento.nombreUsuario,
        rol: evento.rol,
      },
      evidencia: evento.evidencia,
    };
  }
}
