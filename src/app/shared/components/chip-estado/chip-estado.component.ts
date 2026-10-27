import { Component, Input } from "@angular/core";
import {
  ESTADOS_CHIP,
  EstadoPostulacionProveedor,
  EstadoSolicitud,
  EstadoSolicitudMeta,
} from "src/app/core/constants/estados-solicitud.const";

/**
 * Chip de estado de solicitud/cotización.
 * El color sale de los tokens `--agora-*` según `tono` definido en
 * `estados-solicitud.const.ts`; no lleva colores sueltos.
 */
@Component({
  selector: "chip-estado",
  templateUrl: "./chip-estado.component.html",
  styleUrls: ["./chip-estado.component.scss"],
  standalone: false,
})
export class ChipEstadoComponent {
  @Input({ required: true }) set estado(
    estado: EstadoSolicitud | EstadoPostulacionProveedor,
  ) {
    this.meta = ESTADOS_CHIP[estado];
  }

  meta!: EstadoSolicitudMeta;
}
