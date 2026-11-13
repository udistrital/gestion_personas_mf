import { Component, EventEmitter, Input, Output } from "@angular/core";
import { formatoCop } from "../../../../../models/necesidad.model";

/**
 * Estado vacío de «Mi cotización» (P-06).
 *
 * Se pinta cuando el proveedor todavía no tiene una respuesta radicada. Si el
 * plazo sigue abierto ofrece responder; si venció, solo informa que no se
 * presentó cotización. El texto del motivo lo resuelve la matriz de permisos,
 * no este componente.
 */
@Component({
  selector: "app-mi-cotizacion-vacia",
  templateUrl: "./estado-vacio.component.html",
  styleUrls: ["./estado-vacio.component.scss"],
  standalone: false,
})
export class EstadoVacioMiCotizacionComponent {
  @Input({ required: true }) solicitudId = "";
  @Input() tituloSolicitud = "";
  @Input() cierre: string | null = null;
  @Input() presupuesto: number | null = null;
  @Input() puedeResponder = false;
  @Input() motivo = "";

  @Output() responder = new EventEmitter<void>();
  @Output() verSolicitud = new EventEmitter<void>();

  readonly moneda = formatoCop;

  get titulo(): string {
    return this.puedeResponder
      ? "Aún no ha respondido esta solicitud de cotización"
      : "No se presentó cotización para esta solicitud";
  }

  get descripcion(): string {
    const objeto = this.tituloSolicitud
      ? ` («${this.tituloSolicitud}»)`
      : "";
    if (this.puedeResponder) {
      return `No se encontró ninguna oferta económica o propuesta formal radicada para la solicitud ${this.solicitudId}${objeto}.`;
    }
    return this.motivo ||
      "El plazo de participación terminó sin que se registrara una respuesta.";
  }

  get fechaLimite(): string {
    return this.cierre ? `${this.cierre} · 23:59 COT` : "Por definir";
  }

  get presupuestoTexto(): string {
    return this.presupuesto !== null && this.presupuesto > 0
      ? this.moneda(this.presupuesto)
      : "Por definir";
  }
}
