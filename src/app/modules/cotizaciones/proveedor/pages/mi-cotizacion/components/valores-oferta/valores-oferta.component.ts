import { Component, Input } from "@angular/core";
import { numeroALetrasCop } from "src/app/shared/utils/numero-a-letras";
import { formatoCop } from "../../../../../models/necesidad.model";
import type { TotalesRespuestaProveedor } from "../../../../../models/respuesta-proveedor.model";

/** Liquidación económica de la oferta radicada (P-06). */
@Component({
  selector: "app-valores-oferta",
  templateUrl: "./valores-oferta.component.html",
  styleUrls: ["./valores-oferta.component.scss"],
  standalone: false,
})
export class ValoresOfertaComponent {
  @Input({ required: true }) totales!: TotalesRespuestaProveedor;
  @Input() fechaVencimiento = "";
  @Input() diasVigencia: number | null = null;
  @Input() cerrada = false;
  @Input() excedePresupuesto = false;
  @Input() presupuesto: number | null = null;

  readonly moneda = formatoCop;
  readonly letras = numeroALetrasCop;

  get subtotalLetras(): string {
    return this.letras(this.totales.subtotal);
  }

  get ivaLetras(): string {
    return this.letras(this.totales.iva);
  }

  get totalLetras(): string {
    return this.letras(this.totales.total);
  }
}
