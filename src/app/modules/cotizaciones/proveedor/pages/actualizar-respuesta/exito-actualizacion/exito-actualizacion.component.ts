import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { ResultadoActualizacionRespuesta } from "../../../../models/respuesta-proveedor.model";

/**
 * Constancia de actualización radicada (P-05).
 *
 * Es la pantalla de éxito del mockup. Recibe el resultado ya radicado y no
 * vuelve a consultar servicios; el hash es una referencia local provisional.
 */
@Component({
  selector: "exito-actualizacion",
  templateUrl: "./exito-actualizacion.component.html",
  styleUrls: ["./exito-actualizacion.component.scss"],
  standalone: false,
})
export class ExitoActualizacionComponent {
  @Input({ required: true }) resultado!: ResultadoActualizacionRespuesta;
  @Input({ required: true }) solicitudId!: string;
  @Input({ required: true }) solicitudTitulo!: string;
  @Input() cierre = "";
  @Input() numeroAdenda = "";

  @Output() continuar = new EventEmitter<void>();
  @Output() volverABandeja = new EventEmitter<void>();
  @Output() descargar = new EventEmitter<void>();

  get version(): string {
    return this.resultado.respuesta.version;
  }

  get fecha(): string {
    const fecha = this.resultado.respuesta.fechaActualizacion;
    if (!fecha) {
      return "Sin fecha";
    }
    return new Date(fecha).toLocaleString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  get tituloAdenda(): string {
    return this.numeroAdenda
      ? `Adenda N.° ${this.numeroAdenda} aplicada`
      : "Adenda aplicada";
  }

  formatoMoneda(valor: number): string {
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }
}
