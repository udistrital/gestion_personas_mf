import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { FilaOfertaRespuesta } from "../../../../../models/respuesta-proveedor.model";
import { formatoCop } from "../../../../../models/necesidad.model";

/**
 * Tabla de ítems ofertados de P-06.
 *
 * Presentación pura: recibe las filas ya liquidadas y la página vigente; no
 * conoce el formulario de P-04 ni vuelve a calcular totales.
 */
@Component({
  selector: "app-tabla-items-ofertados",
  templateUrl: "./tabla-items-ofertados.component.html",
  styleUrls: ["./tabla-items-ofertados.component.scss"],
  standalone: false,
})
export class TablaItemsOfertadosComponent {
  @Input({ required: true }) filas: readonly FilaOfertaRespuesta[] = [];
  /** Índice (1-based) de la primera fila visible, para numerar la página. */
  @Input() rangoInicio = 1;
  @Input() total = 0;
  @Input() pagina = 0;
  @Input() porPagina = 5;
  @Input() opcionesPorPagina: readonly number[] = [5, 10, 25];
  @Input() totalPaginas = 1;
  @Input() paginasVisibles: readonly number[] = [1];

  @Output() paginaCambio = new EventEmitter<number>();
  @Output() porPaginaCambio = new EventEmitter<Event>();

  readonly moneda = formatoCop;

  claseTipo(fila: FilaOfertaRespuesta): string {
    return fila.item.tipo === "bien" ? "chip chip--bien" : "chip chip--servicio";
  }
}
