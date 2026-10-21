import { Pipe, PipeTransform, SecurityContext } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * Sanea HTML para pintarlo en vistas de solo lectura.
 *
 * Los campos que se capturaron con el editor enriquecido (objetivo, criterio de
 * selección, plan de acción) llegan como HTML. En vez de confiar en su
 * contenido con `bypassSecurityTrustHtml` —que salta la validación de Angular—,
 * este pipe elimina cualquier elemento o atributo peligroso con
 * `DomSanitizer.sanitize`, de modo que el resultado es seguro por construcción.
 *
 * Uso:
 * ```html
 * <p [innerHTML]="campo.objetivo | htmlSeguro"></p>
 * ```
 */
@Pipe({
  name: "htmlSeguro",
  standalone: false,
})
export class HtmlSeguroPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(valor: string | null | undefined): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, valor ?? "") ?? "";
  }
}
