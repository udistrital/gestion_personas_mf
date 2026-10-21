import { Component, HostBinding, Input } from "@angular/core";

/** Variante visual del valor de un par etiqueta/valor. */
export type FormatoValor = "texto" | "cuerpo" | "destacado";

/**
 * Par etiqueta/valor de una rejilla de datos de solo lectura (S-03).
 *
 * Único formato de presentación de datos entre las pestañas del detalle: se
 * coloca dentro de un contenedor con la clase `.datos-grid` y modula su
 * presentación con los `@Input`.
 *
 * Uso desde cualquier pestaña:
 * ```html
 * <div class="datos-grid datos-grid--tres">
 *   <par-etiqueta-valor etiqueta="Nombres" valor="Raul Andres" />
 *   <par-etiqueta-valor
 *     etiqueta="Identificación"
 *     valor="C.C. 79.845.120"
 *     icono="fingerprint"
 *     clase="dato--destacado"
 *   />
 * </div>
 * ```
 *
 * `valor` admite salto de línea (se conserva con `white-space: pre-line`), pero
 * no HTML: los textos enriquecidos se pintan aparte con `htmlSeguro`.
 */
@Component({
  selector: "par-etiqueta-valor",
  templateUrl: "./par-etiqueta-valor.component.html",
  styleUrls: ["./par-etiqueta-valor.component.scss"],
  standalone: false,
})
export class ParEtiquetaValorComponent {
  /** Título del dato (se muestra en mayúsculas pequeñas). */
  @Input({ required: true }) etiqueta!: string;

  /** Valor del dato; `null`/`""` se muestra como "—". */
  @Input() valor: string | null = null;

  /** Texto secundario bajo el valor (opcional). */
  @Input() nota = "";

  /** Icono Material opcional a la izquierda del valor. */
  @Input() icono = "";

  /**
   * Formato del valor: `texto` (por defecto), `cuerpo` (texto largo normal) o
   * `destacado` (bloque resaltado del ordenador del gasto).
   */
  @Input() formato: FormatoValor = "texto";

  /** Clase extra para el contenedor (p. ej. `dato--destacado` o `dato--ancho`). */
  @Input() clase = "";

  /** Valor ya resuelto para mostrar ("—" cuando viene vacío). */
  get valorVisible(): string {
    const limpio = (this.valor ?? "").trim();
    return limpio || "—";
  }

  // Dentro de ParEtiquetaValorComponent:
  @HostBinding("class.dato--destacado")
  get esDestacado(): boolean {
    return this.clase.split(/\s+/).includes("dato--destacado");
  }
}
