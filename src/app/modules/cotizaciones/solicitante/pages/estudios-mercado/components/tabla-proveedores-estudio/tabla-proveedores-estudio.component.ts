import {
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import {
  ETIQUETAS_ESTADO_INSCRIPCION,
  ProveedorEstudio,
} from "../../../../../models/estudio-mercado.model";

/**
 * Tabla de proveedores que cumplen el perfil del estudio.
 *
 * Presentacional: la selección, la paginación y la búsqueda viven en la
 * página. La casilla superior selecciona todos los resultados filtrados y
 * muestra estado indeterminado cuando la selección es parcial.
 */
@Component({
  selector: "tabla-proveedores-estudio",
  templateUrl: "./tabla-proveedores-estudio.component.html",
  styleUrls: ["./tabla-proveedores-estudio.component.scss"],
  standalone: false,
})
export class TablaProveedoresEstudioComponent {
  @Input({ required: true }) proveedores: readonly ProveedorEstudio[] = [];
  @Input() seleccionados: ReadonlySet<string> = new Set<string>();
  @Input() seleccionParcial = false;
  @Input() seleccionTotal = false;
  @Input() cargando = false;
  @Input() seleccionable = true;
  @Input() total = 0;
  @Input() pagina = 0;
  @Input() porPagina = 10;

  @Output() toggleProveedor = new EventEmitter<{
    id: string;
    checked: boolean;
  }>();
  @Output() toggleTodos = new EventEmitter<boolean>();
  @Output() verDetalle = new EventEmitter<ProveedorEstudio>();
  @Output() invitarProveedor = new EventEmitter<ProveedorEstudio>();
  @Output() cambiarPagina = new EventEmitter<number>();
  @Output() cambiarPorPagina = new EventEmitter<number>();

  readonly opcionesPorPagina: readonly number[] = [5, 10, 25];

  /** Fila cuyo menú de acciones está abierto, para resaltar el botón. */
  filaMenuAbierto: string | null = null;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total, (this.pagina + 1) * this.porPagina);
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const ventana = 5;
    let inicio = Math.max(1, this.pagina + 1 - Math.floor(ventana / 2));
    const fin = Math.min(total, inicio + ventana - 1);
    inicio = Math.max(1, fin - ventana + 1);
    const paginas: number[] = [];
    for (let indice = inicio; indice <= fin; indice++) {
      paginas.push(indice);
    }
    return paginas;
  }

  estaSeleccionado(proveedorId: string): boolean {
    return this.seleccionados.has(proveedorId);
  }

  etiquetaInscripcion(proveedor: ProveedorEstudio): string {
    return ETIQUETAS_ESTADO_INSCRIPCION[proveedor.estadoInscripcion];
  }

  abrirMenuAcciones(proveedorId: string): void {
    this.filaMenuAbierto = proveedorId;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  alToggleProveedor(proveedorId: string, checked: boolean): void {
    this.toggleProveedor.emit({ id: proveedorId, checked });
  }

  alToggleTodos(checked: boolean): void {
    this.toggleTodos.emit(checked);
  }

  alCambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (Number.isFinite(valor) && valor !== this.porPagina) {
      this.cambiarPorPagina.emit(valor);
    }
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino !== this.pagina) {
      this.cambiarPagina.emit(destino);
    }
  }
}
