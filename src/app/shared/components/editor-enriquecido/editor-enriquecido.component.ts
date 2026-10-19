import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  forwardRef,
  signal,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

/**
 * Etiquetas permitidas en el HTML del editor.
 *
 * Todo lo que no esté en esta lista se descarta al normalizar: el valor del
 * control es siempre HTML seguro y renderizable con `[innerHTML]`.
 */
const ETIQUETAS_PERMITIDAS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "div",
  "p",
  "ul",
  "ol",
  "li",
]);

/** Acción de la barra de herramientas (delegada a `document.execCommand`). */
interface AccionFormato {
  readonly comando: string;
  readonly etiqueta: string;
}

/**
 * Editor de texto enriquecido del asistente (paso 2).
 *
 * Implementa `ControlValueAccessor`, así que se usa con `formControlName` y su
 * valor es un `string` **HTML** (texto plano con `<b>`, `<i>`, `<u>` y listas).
 * El HTML se normaliza por lista blanca al escribir y al leer: el usuario no
 * puede inyectar etiquetas ni atributos peligrosos. El área editable se
 * actualiza directamente sobre el DOM (no con `[innerHTML]`) para no perder la
 * posición del cursor en cada pulsación.
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
export class EditorEnriquecidoComponent implements ControlValueAccessor {
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

  /** Máximo de caracteres admitidos (0 = sin límite). */
  @Input() maxCaracteres = 0;

  /** Altura mínima del área editable, en filas. */
  @Input() rows = 5;

  /** Se emite al ganar o perder el foco, para marcar el control como tocado. */
  @Output() blur = new EventEmitter<void>();

  @ViewChild("area", { static: true })
  private area!: ElementRef<HTMLElement>;

  /** Acciones de la barra de herramientas (comandos nativos del navegador). */
  readonly acciones: readonly AccionFormato[] = [
    { comando: "bold", etiqueta: "Negrita" },
    { comando: "italic", etiqueta: "Cursiva" },
    { comando: "underline", etiqueta: "Subrayado" },
    { comando: "insertUnorderedList", etiqueta: "Lista con viñetas" },
    { comando: "insertOrderedList", etiqueta: "Lista numerada" },
  ];

  /** Estado de los botones con conmutador (`aria-pressed`). */
  readonly activos = signal<Record<string, boolean>>({});

  /** Valor normalizado actual (HTML). */
  private valor = "";

  protected deshabilitado = false;
  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  /** Contador de caracteres visibles (sin etiquetas). */
  get contador(): number {
    return this.textoPlano().trim().length;
  }

  get excedeMaximo(): boolean {
    return this.maxCaracteres > 0 && this.textoPlano().length > this.maxCaracteres;
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

  /** Sufijo único para los ids accesibles del editor. */
  private static secuencia = 0;
  private readonly sufijo = `editor-${EditorEnriquecidoComponent.secuencia++}`;
  protected readonly idAyuda = `${this.sufijo}-ayuda`;
  protected readonly idNota = `${this.sufijo}-nota`;
  protected readonly idContador = `${this.sufijo}-contador`;

  // ── ControlValueAccessor ─────────────────────────────────────────────────

  /** Escribe el valor externo (borrador, restauración) sin reemitir cambios. */
  writeValue(valor: string | null): void {
    this.valor = this.normalizar(valor ?? "");
    if (this.area) {
      this.area.nativeElement.innerHTML = this.valor;
    }
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado = deshabilitado;
  }

  // ── Interacción ──────────────────────────────────────────────────────────

  /** Aplica un comando de formato nativo sobre la selección del área. */
  aplicar(accion: AccionFormato, evento: MouseEvent): void {
    evento.preventDefault();
    if (this.deshabilitado) {
      return;
    }
    this.area.nativeElement.focus();
    document.execCommand(accion.comando);
    this.sincronizar();
    this.activos.update((estado: Record<string, boolean>) => ({
      ...estado,
      [accion.comando]: document.queryCommandState(accion.comando),
    }));
  }

  /** Quita todo el formato enriquecido de la selección o de todo el campo. */
  limpiarFormato(evento: MouseEvent): void {
    evento.preventDefault();
    if (this.deshabilitado) {
      return;
    }
    this.area.nativeElement.focus();
    document.execCommand("removeFormat");
    this.sincronizar();
  }

  /** Relee el HTML del área, lo normaliza y emite el cambio. */
  sincronizar(): void {
    const crudo = this.area.nativeElement.innerHTML;
    const normalizado = this.normalizar(
      this.maxCaracteres > 0
        ? this.recortar(crudo)
        : crudo,
    );
    this.valor = normalizado;
    if (normalizado !== this.area.nativeElement.innerHTML) {
      this.area.nativeElement.innerHTML = normalizado;
    }
    this.onChange(normalizado);
  }

  /** Marca el control como tocado al salir del área editable. */
  alSalir(): void {
    this.onTouched();
    this.blur.emit();
  }

  /** Refresca el estado de los conmutadores tras escribir o mover el cursor. */
  alTeclaIr(): void {
    this.activos.update((estado: Record<string, boolean>) => ({
      ...estado,
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    }));
  }

  /** `text-plain` del editor, sin etiquetas (para el contador y los mínimos). */
  textoPlano(): string {
    const nodo = document.createElement("div");
    nodo.innerHTML = this.valor;
    return nodo.textContent ?? "";
  }

  // ── Normalización ────────────────────────────────────────────────────────

  /**
   * Deja solo las etiquetas de la lista blanca, sin atributos.
   *
   * Se hace con el parser del navegador (no con expresiones regulares), de modo
   * que el resultado sea siempre HTML bien formado.
   */
  private normalizar(html: string): string {
    if (!html) {
      return "";
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const raiz = doc.body.firstElementChild;
    if (!raiz) {
      return "";
    }

    this.limpiarNodo(raiz);
    const resultado = raiz.innerHTML;
    // Un contenedor sin contenido real se trata como vacío.
    return this.textoDe(resultado).trim() ? resultado : "";
  }

  /** Recorre el árbol y elimina nodos y atributos no permitidos. */
  private limpiarNodo(nodo: Node): void {
    // Copia de los hijos: el recorrido elimina nodos sobre la marcha.
    for (const hijo of Array.from(nodo.childNodes)) {
      if (hijo.nodeType === Node.COMMENT_NODE) {
        hijo.parentNode?.removeChild(hijo);
        continue;
      }
      if (hijo.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const elemento = hijo as HTMLElement;
      if (!ETIQUETAS_PERMITIDAS.has(elemento.tagName.toLowerCase())) {
        // Se conserva el texto y se descarta la etiqueta (script/style se borran).
        const descartar =
          elemento.tagName === "SCRIPT" || elemento.tagName === "STYLE";
        if (descartar) {
          elemento.remove();
        } else {
          this.reemplazarPorTexto(elemento);
        }
        continue;
      }

      for (const atributo of Array.from(elemento.attributes)) {
        elemento.removeAttribute(atributo.name);
      }
      this.limpiarNodo(elemento);
    }
  }

  /** Sustituye un elemento no permitido por su contenido textual. */
  private reemplazarPorTexto(elemento: HTMLElement): void {
    const fragmento = document.createDocumentFragment();
    while (elemento.firstChild) {
      fragmento.appendChild(elemento.firstChild);
    }
    elemento.replaceWith(fragmento);
    // Los hijos migrados pueden contener etiquetas permitidas anidadas.
    this.limpiarNodo(fragmento as unknown as Node);
  }

  /** Limita el HTML a `maxCaracteres` caracteres visibles, respetando etiquetas. */
  private recortar(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const raiz = doc.body.firstElementChild;
    if (!raiz) {
      return "";
    }

    let restantes = this.maxCaracteres;
    const truncar = (nodo: Node): void => {
      if (restantes <= 0) {
        nodo.parentNode?.removeChild(nodo);
        return;
      }
      if (nodo.nodeType === Node.TEXT_NODE) {
        const texto = nodo.textContent ?? "";
        if (texto.length > restantes) {
          nodo.textContent = texto.slice(0, restantes);
          restantes = 0;
        } else {
          restantes -= texto.length;
        }
        return;
      }
      for (const hijo of Array.from(nodo.childNodes)) {
        truncar(hijo);
      }
      if (nodo.nodeType === Node.ELEMENT_NODE && !(nodo as HTMLElement).innerHTML) {
        nodo.parentNode?.removeChild(nodo);
      }
    };

    truncar(raiz);
    return raiz.innerHTML;
  }

  /** Texto plano de un fragmento HTML (para comprobar contenido real). */
  private textoDe(html: string): string {
    const nodo = document.createElement("div");
    nodo.innerHTML = html;
    return nodo.textContent ?? "";
  }
}
