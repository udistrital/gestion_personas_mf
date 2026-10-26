import { Component, Input } from "@angular/core";

/** Variantes visuales del banner de cabecera de un paso. */
export type VarianteBannerPaso = "neutro" | "error";

/**
 * Cabecera de un paso de asistente: icono, título, etiquetas de contexto,
 * descripción y una zona de acciones a la derecha.
 *
 * El banner es una región viva: los cambios de estado del paso (cargando,
 * error de cruce) se anuncian a los lectores de pantalla sin mover el foco.
 */
@Component({
  selector: "banner-paso",
  templateUrl: "./banner-paso.component.html",
  styleUrls: ["./banner-paso.component.scss"],
  standalone: false,
})
export class BannerPasoComponent {
  /** Icono Material a la izquierda. */
  @Input() icono = "info";

  /** Título del banner ("Paso 1: Necesidad y presupuesto"). */
  @Input() titulo = "";

  /** Etiquetas cortas junto al título ("Cruce con SICAPITAL"). */
  @Input() etiquetas: readonly string[] = [];

  /** Texto explicativo bajo el título. */
  @Input() descripcion = "";

  @Input() variante: VarianteBannerPaso = "neutro";

  /**
   * Rol de la región viva. `alert` (con `aria-live="assertive"`) para errores
   * que bloquean el avance; `status` (polite) para el resto.
   */
  @Input() rol: "status" | "alert" = "status";

  get ariaLive(): "polite" | "assertive" {
    return this.rol === "alert" ? "assertive" : "polite";
  }
}
