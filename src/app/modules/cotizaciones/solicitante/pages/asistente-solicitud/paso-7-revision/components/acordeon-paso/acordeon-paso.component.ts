import { Component, EventEmitter, Input, Output } from "@angular/core";
import { AcordeonRevision } from "../../../../../../models/revision.model";

/**
 * Acordeón de solo lectura que resume un paso ya diligenciado del asistente.
 *
 * Componente presentacional: recibe el resumen del paso y emite `editar` para
 * que el paso 7 devuelva al usuario al paso correspondiente. Los bloques
 * especiales (etiquetas, desembolsos, archivos y requisitos) solo se dibujan
 * cuando el modelo los trae.
 */
@Component({
  selector: "acordeon-paso",
  templateUrl: "./acordeon-paso.component.html",
  styleUrls: ["./acordeon-paso.component.scss"],
  standalone: false,
})
export class AcordeonPasoComponent {
  /** Resumen del paso ya diligenciado. */
  @Input({ required: true }) resumen!: AcordeonRevision;

  /** Notifica el paso al que el usuario quiere volver para editarlo. */
  @Output() editar = new EventEmitter<number>();
}
