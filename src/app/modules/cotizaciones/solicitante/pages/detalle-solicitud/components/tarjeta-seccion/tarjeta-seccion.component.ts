import { Component, Input } from "@angular/core";

/**
 * Tarjeta de sección de una pestaña del detalle (S-03).
 *
 * Reemplaza a `plantilla-tarjeta-contenedora` dentro del detalle para fijar el
 * aspecto de familia entre pestañas: cabecera con icono, título y subtítulo
 * opcional, un slot `acciones` a la derecha y el contenido proyectado.
 *
 * Uso desde cualquier pestaña:
 * ```html
 * <tarjeta-seccion icono="badge" titulo="Responsable de la solicitud">
 *   <ng-container acciones>
 *     <span class="chip">Solo lectura</span>
 *   </ng-container>
 *   <!-- contenido -->
 * </tarjeta-seccion>
 * ```
 */
@Component({
  selector: "tarjeta-seccion",
  templateUrl: "./tarjeta-seccion.component.html",
  styleUrls: ["./tarjeta-seccion.component.scss"],
  standalone: false,
})
export class TarjetaSeccionComponent {
  /** Icono Material de la cabecera. */
  @Input() icono = "info";

  /** Título de la sección. */
  @Input({ required: true }) titulo!: string;

  /** Texto secundario bajo el título (opcional). */
  @Input() subtitulo = "";
}
