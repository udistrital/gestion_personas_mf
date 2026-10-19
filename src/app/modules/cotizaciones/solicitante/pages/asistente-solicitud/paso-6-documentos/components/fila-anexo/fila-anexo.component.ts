import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AnexoSolicitud } from "../../../../../../models/documentos.model";
import { formatoTamano } from "../../../../../../models/items.model";

/**
 * Fila presentacional de un anexo del proceso (tarjeta 1 del paso 6).
 *
 * Pinta los cuatro estados del mockup —cargado, subiendo, error de formato y
 * exceso de tamaño— y delega en el paso las acciones (previsualizar,
 * reemplazar, eliminar, descartar y reintentar).
 */
@Component({
  selector: "fila-anexo",
  templateUrl: "./fila-anexo.component.html",
  styleUrls: ["./fila-anexo.component.scss"],
  standalone: false,
})
export class FilaAnexoComponent {
  /** Anexo que se muestra. */
  @Input({ required: true }) anexo!: AnexoSolicitud;

  /** Etiqueta del estado del anexo. */
  @Input() etiquetaEstado = "";

  /** Se emite al pedir la previsualización del archivo. */
  @Output() previsualizar = new EventEmitter<void>();

  /** Se emite al pedir el reemplazo del archivo. */
  @Output() reemplazar = new EventEmitter<void>();

  /** Se emite al eliminar un anexo cargado. */
  @Output() eliminar = new EventEmitter<void>();

  /** Se emite al descartar un anexo con error. */
  @Output() descartar = new EventEmitter<void>();

  /** Se emite al reintentar la carga de un anexo con error. */
  @Output() reintentar = new EventEmitter<void>();

  /** Peso legible del archivo ("2.4 MB"). */
  get peso(): string {
    return formatoTamano(this.anexo.pesoBytes);
  }

  /** true cuando el anexo terminó de cargarse con éxito. */
  get cargado(): boolean {
    return this.anexo.estado === "cargado";
  }

  /** true mientras el anexo se está subiendo. */
  get subiendo(): boolean {
    return this.anexo.estado === "subiendo";
  }

  /** true cuando el anexo no pudo vincularse. */
  get conError(): boolean {
    return this.anexo.estado === "error";
  }
}
