import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  forwardRef,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { QuillEditorComponent } from "ngx-quill";
import { textoPlanoDesdeHtml } from "../../utils/texto-plano";

/**
 * Editor de texto enriquecido del asistente, basado en `ngx-quill`.
 *
 * Implementa `ControlValueAccessor`, así que se usa con `formControlName` y su
 * valor es un `string` **HTML** (el que produce Quill). Delega el control del
 * valor en el `QuillEditorComponent` de `ngx-quill`: así no hay dos
 * `ControlValueAccessor` en juego y el ciclo `writeValue`/`onChange`/`disabled`
 * queda en manos de la librería.
 */
@Component({
  selector: "editor-enriquecido",
  templateUrl: "./editor-enriquecido.component.html",
  styleUrls: ["./editor-enriquecido.component.scss"],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditorEnriquecidoComponent),
      multi: true,
    },
  ],
})
export class EditorEnriquecidoComponent
  implements ControlValueAccessor, AfterViewInit
{
  /** Etiqueta visible del campo. */
  @Input() etiqueta = "";

  /** Texto de ayuda bajo el editor. */
  @Input() ayuda = "";

  /** Pista que se muestra cuando el campo está vacío. */
  @Input() pista = "";

  /** Id del elemento que titula el campo (la etiqueta que pinta el padre). */
  @Input() idEtiqueta = "";

  /** Nota informativa bajo el contador (mockup: "Parámetro de…"). */
  @Input() nota = "";

  /** Mínimo de caracteres exigido (solo se anuncia; la valida el formulario). */
  @Input() minCaracteres = 0;

  /**
   * Máximo de caracteres admitidos (0 = sin límite).
   *
   * Solo se anuncia en el contador: el recorte se delega en el formulario.
   */
  @Input() maxCaracteres = 0;

  /** Altura mínima del área editable, en filas. */
  @Input() rows = 5;

  /** Se emite al ganar o perder el foco, para marcar el control como tocado. */
  @Output() blur = new EventEmitter<void>();

  /** Editor de Quill; gestiona el valor, el estado y los eventos. */
  @ViewChild(QuillEditorComponent)
  private quill?: QuillEditorComponent;

  /** Contenido HTML actual, para el contador de caracteres. */
  private valor = "";

  protected deshabilitado = false;
  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Acciones de la barra de herramientas (agrupadas como en Quill). */
  readonly editorModules = {
    toolbar: [
      ["bold", "italic", "underline", "strike"], // Botones de formato
      ["blockquote", "code-block"],
      [{ list: "ordered" }, { list: "bullet" }], // Listas
      [{ header: [1, 2, 3, false] }], // Encabezados
      [{ color: [] }, { background: [] }], // Colores
      ["link", "image"], // Enlace e imágenes
      ["clean"], // Eliminar formato
    ],
  };

  /** Sufijo único para los ids accesibles del editor. */
  private static secuencia = 0;
  private readonly sufijo = `editor-${EditorEnriquecidoComponent.secuencia++}`;
  protected readonly idAyuda = `${this.sufijo}-ayuda`;
  protected readonly idNota = `${this.sufijo}-nota`;
  protected readonly idContador = `${this.sufijo}-contador`;

  /** Contador de caracteres visibles (sin etiquetas). */
  get contador(): number {
    return this.textoPlano().trim().length;
  }

  /** true si se supera el máximo admitido. */
  get excedeMaximo(): boolean {
    return (
      this.maxCaracteres > 0 && this.textoPlano().length > this.maxCaracteres
    );
  }

  /** `aria-describedby` del área editable, solo con los textos presentes. */
  get descritoPor(): string | null {
    const ids: string[] = [];
    if (this.ayuda) {
      ids.push(this.idAyuda);
    }
    if (this.nota) {
      ids.push(this.idNota);
    }
    if (this.minCaracteres > 0) {
      ids.push(this.idContador);
    }
    return ids.length ? ids.join(" ") : null;
  }

  // ── ControlValueAccessor (delegado en ngx-quill) ─────────────────────────

  /**
   * Escribe el valor externo (borrador, restauración) sin reemitir cambios.
   *
   * El `QuillEditorComponent` puede no existir todavía cuando el formulario
   * llama a este método (ocurre antes de `ngAfterViewInit`), por eso además de
   * reenviarlo se guarda para volcarlo en cuanto la vista esté lista.
   */
  writeValue(valor: string | null): void {
    this.valor = valor ?? "";
    this.quill?.writeValue(this.valor);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
    this.quill?.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
    this.quill?.registerOnTouched(fn);
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
    this.quill?.setDisabledState(deshabilitado);
  }

  /**
   * Vuelca en Quill el estado que el formulario ya había notificado antes de
   * que el editor existiera (valor inicial, callbacks y estado deshabilitado).
   */
  ngAfterViewInit(): void {
    if (!this.quill) {
      return;
    }
    this.quill.registerOnChange(this.onChange);
    this.quill.registerOnTouched(this.onTouched);
    this.quill.writeValue(this.valor);
    this.quill.setDisabledState(this.deshabilitado);
  }

  // ── Interacción ──────────────────────────────────────────────────────────

  /** Relee el HTML de Quill para refrescar el contador de caracteres. */
  alCambiarContenido(html: string | null): void {
    this.valor = html ?? "";
    // El control de formulario ya recibió el cambio por su cuenta; aquí solo se
    // recalcula el contador, por eso no se vuelve a llamar a `onChange`.
  }

  /**
   * Marca el control como tocado al salir del área editable.
   *
   * El `onTouched` del formulario lo dispara `ngx-quill` por su cuenta (ya está
   * registrado); aquí solo se reemite el evento público.
   */
  alSalir(): void {
    this.blur.emit();
  }

  /** `text-plain` del editor, sin etiquetas (para el contador y los mínimos). */
  textoPlano(): string {
    return textoPlanoDesdeHtml(this.valor);
  }
}
