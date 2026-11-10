import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { ResumenDiferencias } from "../../models/edicion-solicitud.model";

/**
 * Aviso de adenda de P-05.
 *
 * Muestra el banner ámbar y el panel desplegable con la comparativa de cambios
 * del solicitante. No calcula diferencias: recibe el resultado ya restringido
 * por `DiferenciasSolicitudService` y lo pinta con `resumen-diferencias`.
 */
@Component({
  selector: "aviso-adenda",
  templateUrl: "./aviso-adenda.component.html",
  styleUrls: ["./aviso-adenda.component.scss"],
  standalone: false,
})
export class AvisoAdendaComponent {
  @Input({ required: true }) diferencias!: ResumenDiferencias;
  @Input() numero = "";
  @Input() versionAnterior = "";
  @Input() versionVigente = "";
  @Input() publicadaEl = "";
  @Input() motivo = "";
  @Input() abierto = true;
  @Output() alternar = new EventEmitter<boolean>();

  get etiquetaAdenda(): string {
    return this.numero ? `Adenda N.° ${this.numero}` : "Adenda publicada";
  }

  alternarPanel(): void {
    this.alternar.emit(!this.abierto);
  }
}
