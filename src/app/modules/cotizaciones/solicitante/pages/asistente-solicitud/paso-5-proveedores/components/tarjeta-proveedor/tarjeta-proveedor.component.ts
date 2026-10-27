import { Component, Input } from "@angular/core";
import {
  ProveedorObjetivo,
  perfilNbc,
} from "../../../../../../models/proveedores.model";

/**
 * Tarjeta presentacional de un proveedor objetivo (tarjeta 4 del paso 5).
 *
 * Solo pinta los datos del proveedor habilitado: la lógica de cruce y de
 * despliegue vive en el paso.
 */
@Component({
  selector: "tarjeta-proveedor",
  templateUrl: "./tarjeta-proveedor.component.html",
  styleUrls: ["./tarjeta-proveedor.component.scss"],
  standalone: false,
})
export class TarjetaProveedorComponent {
  /** Proveedor habilitado que se muestra. */
  @Input({ required: true }) proveedor!: ProveedorObjetivo;

  /** Códigos CIIU acreditados ("6201, 6202, 6209"). */
  get codigos(): string {
    return this.proveedor.actividades.join(", ");
  }

  /** Etiqueta del perfil técnico del primer NBC acreditado. */
  get nucleo(): string {
    return perfilNbc(this.proveedor.nucleos[0] ?? "").titulo;
  }
}
