import { Component, Input } from "@angular/core";
import type { MiCotizacion } from "../../../../../models/mi-cotizacion.model";
import { formatoCop } from "../../../../../models/necesidad.model";

/** Resumen de la respuesta radicada: radicado, fecha, versión, total y estado. */
@Component({
  selector: "app-resumen-mi-cotizacion",
  templateUrl: "./resumen-respuesta.component.html",
  styleUrls: ["./resumen-respuesta.component.scss"],
  standalone: false,
})
export class ResumenMiCotizacionComponent {
  @Input({ required: true }) proyeccion!: MiCotizacion;
  @Input() cerrada = false;

  readonly moneda = formatoCop;

  get versionTexto(): string {
    return `${this.proyeccion.versionVigente} (revisión ${
      this.proyeccion.respuesta.revision
    })`;
  }

  get estadoTexto(): string {
    return this.cerrada ? "Radicada · solo lectura" : "Radicada oficialmente";
  }
}
