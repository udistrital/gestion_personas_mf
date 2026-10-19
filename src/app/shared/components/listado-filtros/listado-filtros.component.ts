import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from "@angular/core";

export interface CampoFiltro {
  /** Clave del criterio en el objeto emitido por `filtrar`. */
  readonly clave: string;
  readonly etiqueta: string;
  readonly tipo: "select" | "texto";
  readonly opciones?: readonly { valor: string; etiqueta: string }[];
  readonly requerido?: boolean;
  readonly placeholder?: string;
}

/**
 * Barra de filtros de listados (S-01, P-01, O-01…): cabecera, grilla de
 * campos configurables, campo de búsqueda con botones Limpiar/Filtrar y
 * nota informativa. El estado vive aquí; el padre solo recibe el criterio
 * aplicado al enviar el formulario.
 *
 * Convención: la primera opción de cada `select` es su valor por defecto
 * (la que restablece "Limpiar filtros").
 */
@Component({
  selector: "listado-filtros",
  templateUrl: "./listado-filtros.component.html",
  styleUrls: ["./listado-filtros.component.scss"],
  standalone: false,
})
export class ListadoFiltrosComponent implements OnChanges {
  @Input({ required: true }) campos: readonly CampoFiltro[] = [];

  /** Texto de la nota inferior (icono `info`), p. ej. la de vigencia por defecto. */
  @Input() nota = "";

  @Output() filtrar = new EventEmitter<Record<string, string>>();
  @Output() limpiar = new EventEmitter<void>();

  valores: Record<string, string> = {};

  ngOnChanges(): void {
    this.reiniciarValores();
  }

  aplicar(): void {
    this.filtrar.emit({ ...this.valores });
  }

  reiniciar(): void {
    this.reiniciarValores();
    this.limpiar.emit();
  }

  idCampo(clave: string): string {
    return `filtro-${clave}`;
  }

  private reiniciarValores(): void {
    const anteriores = { ...this.valores };
    this.valores = {};
    for (const campo of this.campos) {
      this.valores[campo.clave] =
        campo.tipo === "select" && campo.opciones?.length
          ? campo.opciones[0].valor
          : anteriores[campo.clave] ?? "";
    }
  }
}
