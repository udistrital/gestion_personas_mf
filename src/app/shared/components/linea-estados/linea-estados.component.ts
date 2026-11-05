import { Component, Input } from "@angular/core";

/** Estado de un paso de la franja de proceso. */
export type EstadoPasoLineaEstados = "completado" | "actual" | "pendiente";

/** Paso de la franja de proceso. */
export interface PasoLineaEstados {
  readonly etiqueta: string;
  readonly estado: EstadoPasoLineaEstados;
}

/**
 * Franja horizontal y no interactiva con las etapas de un proceso.
 *
 * Es presentacional: el host decide qué pasos mostrar y cuál es el actual. Se
 * usa en S-09 y queda lista para S-11. El texto y el icono refuerzan el color,
 * de modo que la etapa no depende solo del tono.
 */
@Component({
  selector: "linea-estados",
  templateUrl: "./linea-estados.component.html",
  styleUrls: ["./linea-estados.component.scss"],
  standalone: false,
})
export class LineaEstadosComponent {
  @Input({ required: true }) pasos: readonly PasoLineaEstados[] = [];

  @Input() label = "Etapa del proceso";
}
