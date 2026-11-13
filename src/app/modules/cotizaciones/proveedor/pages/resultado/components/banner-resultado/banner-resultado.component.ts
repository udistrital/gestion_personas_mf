import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { BannerResultadoDatos } from "../../../../../models/resultado-proveedor.model";

/**
 * Banner de resultado de P-07.
 *
 * Es un único componente presentacional parametrizado por estado: no conoce
 * reglas ni servicios, solo pinta el `BannerResultadoDatos` que arma el modelo.
 * El resultado se comunica con texto, ícono y color (nunca solo con color).
 */
@Component({
  selector: "banner-resultado",
  templateUrl: "./banner-resultado.component.html",
  styleUrls: ["./banner-resultado.component.scss"],
  standalone: false,
})
export class BannerResultadoComponent {
  @Input({ required: true }) datos!: BannerResultadoDatos;

  /** Solicita la constancia; la vista decide cómo resolverla (provisional). */
  @Output() descargar = new EventEmitter<void>();
}
