import { Component, Input } from "@angular/core";
import type { EstadoOferente } from "src/app/core/constants/estados-solicitud.const";

/**
 * Identidad institucional del proveedor.
 *
 * Componente presentacional reutilizable por S-10 y, cuando existan, las
 * vistas de resultado del ordenador. No consulta servicios: recibe los datos
 * ya resueltos por la página.
 *
 * El resaltado del proveedor enviado a validación usa los tokens del repo
 * (RN-33) y siempre va acompañado de una etiqueta textual, de modo que el color
 * no es el único indicador.
 */
@Component({
  selector: "tarjeta-identidad-proveedor",
  templateUrl: "./tarjeta-identidad-proveedor.component.html",
  styleUrls: ["./tarjeta-identidad-proveedor.component.scss"],
  standalone: false,
})
export class TarjetaIdentidadProveedorComponent {
  @Input({ required: true }) nombre = "";
  @Input({ required: true }) nit = "";
  /** Etiqueta del documento: "NIT" para jurídicas, "Documento" para naturales. */
  @Input() etiquetaDocumento = "NIT";
  @Input() tipoPersona = "";
  @Input() ciudad = "";
  @Input() correo = "";
  @Input() direccion = "";
  @Input() representante = "";
  @Input() estado: EstadoOferente | null = null;
  @Input() seleccionado = false;
  /** Texto del badge cuando `seleccionado` es true. */
  @Input() etiquetaSeleccion = "Seleccionado";
  @Input() version = "";
  @Input() modificadaEl = "";
  /** Nivel del nombre: `h1` en S-10, `h2` si se reutiliza dentro de otra vista. */
  @Input() nivelTitulo: 1 | 2 = 1;

  /** Iniciales del avatar, ignorando sufijos societarios y preposiciones. */
  get iniciales(): string {
    const palabras = this.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(
        /\b(s\.?a\.?s\.?|sas|ltda\.?|e\.?s\.?p\.?|esp|s\.?a\.?|sa|y|de|del|la|el|los|las)\b/gi,
        " ",
      )
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (palabras.length === 0) {
      return "PR";
    }
    if (palabras.length === 1) {
      return palabras[0].slice(0, 2).toUpperCase();
    }
    return `${palabras[0][0]}${palabras[1][0]}`.toUpperCase();
  }
}
