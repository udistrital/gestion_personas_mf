import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from "@angular/core";
import { SafeHtml } from "@angular/platform-browser";

/**
 * Componente que actúa como una plantilla contenedora.
 * Permite mostrar un encabezado, un botón opcional, y contenido personalizado a través de un `TemplateRef`.
 */
@Component({
    selector: "plantilla-pagina-contenedora",
    templateUrl: "./plantilla-pagina-contenedora.component.html",
    styleUrls: ["./plantilla-pagina-contenedora.component.scss"],
    standalone: false
})
export class PlantillaPaginaContenedoraComponent {

  /**
   * HTML seguro para representar un breadcrumb (ruta de navegación) en la parte superior de la pagina.
   * @example
   * `<a href='/inicio'>Inicio</a> > <a href='/seccion'>Sección</a>`
   */
  @Input() breadcrumb!: SafeHtml;

  /**
   * Icono que se muestra en el encabezado de la pagina.
   * @default ""
   * @example "home"
   */
  @Input() icon: string = "";

  /**
   * Título que se muestra en el encabezado de la pagina.
   * @default ""
   * @example "Mi Título Personalizado"
   */
  @Input() title: string = "";

   /**
   * Subtitulo que se muestra en el encabezado de la pagina.
   * @default ""
   * @example "Mi Subtitulo Personalizado"
   */
   @Input() subtitle: string = "";

   /**
    * Un segundo subtitulo que se muestra en el encabezado de la pagina, debajo del primer subtitulo.
    * @default ""
    * @example "Mi segundo Subtitulo Personalizado"
    */
   @Input() subtitleChild: string = "";

  /**
   * Indica si debe mostrarse el botón "Regresar".
   * @default false
   */
  @Input() mostrarBotonRegresar: boolean = false;

  /**
   * Etiqueta corta que se muestra como chip junto al título
   * (p. ej. "Ágora v2.6", "Borrador UD-2025").
   * @default ""
   */
  @Input() etiqueta: string = "";

  /**
   * Evento emitido cuando se presiona el botón "Regresar".
   * Útil para manejar acciones en el componente padre, como la navegación.
   * @example
   * <plantilla-pagina-contenedora
   *   (regresar)="manejarRegresar()"
   * ></plantilla-pagina-contenedora>
   */
  @Output() regresar: EventEmitter<void> = new EventEmitter<void>();

  /**
   * Método que emite el evento `regresar` cuando se presiona el botón.
   */
  emitirEventoRegresar() {
    this.regresar.emit();
  }
}
