import { Component, Input } from "@angular/core";

/**
 * Encabezado de una pestaña del detalle (S-03).
 *
 * Fija el inicio de cada pestaña: título, descripción y un slot `acciones` a la
 * derecha. Lo usan todas las pestañas (implementadas y placeholder) para que la
 * transición entre una y otra no cambie la jerarquía visual.
 *
 * Uso desde cualquier pestaña:
 * ```html
 * <encabezado-pestana
 *   titulo="General"
 *   descripcion="Información base de la solicitud."
 * >
 *   <ng-container acciones>
 *     <button class="boton-recto">…</button>
 *   </ng-container>
 * </encabezado-pestana>
 * ```
 */
@Component({
  selector: "encabezado-pestana",
  templateUrl: "./encabezado-pestana.component.html",
  styleUrls: ["./encabezado-pestana.component.scss"],
  standalone: false,
})
export class EncabezadoPestanaComponent {
  /** Título de la pestaña. */
  @Input({ required: true }) titulo!: string;

  /** Descripción bajo el título (opcional). */
  @Input() descripcion = "";

  /** Icono Material opcional junto al título. */
  @Input() icono = "";
}
