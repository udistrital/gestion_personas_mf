import { Component, Input } from "@angular/core";
import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";

/**
 * Tono del nodo de un evento.
 *
 * - `primario` — vinotinto institucional (`--agora-primary`).
 * - `destacado` — vinotinto profundo (`--agora-primary-dark`).
 * - `neutro` — gris de hito inactivo.
 */
export type TonoNodoLineaTiempo = "primario" | "destacado" | "neutro";

/** Tono de un chip de texto dentro de la línea de tiempo. */
export type TonoEtiquetaLineaTiempo =
  | "neutro"
  | "exito"
  | "advertencia"
  | "primario";

/** Chip de texto que acompaña a un evento (categoría, resultado…). */
export interface EtiquetaLineaTiempo {
  readonly texto: string;
  /** Tono del chip; `neutro` por defecto. */
  readonly tono?: TonoEtiquetaLineaTiempo;
}

/** Autoría de un evento: usuario, nombre real y rol. */
export interface AutorLineaTiempo {
  /** Usuario del sistema ("raquimbayap"). */
  readonly usuario: string;
  /** Nombre real de la persona ("Raúl Quimbaya"). */
  readonly nombre?: string;
  /** Rol dentro del proceso ("Solicitante"). */
  readonly rol: string;
}

/** Evidencia técnica de un evento (transacción, hash, origen…). */
export interface EvidenciaLineaTiempo {
  readonly icono: string;
  readonly texto: string;
}

/**
 * Evento de la línea de tiempo.
 *
 * Modelo genérico: no conoce el dominio que lo produce. Quien lo use mapea su
 * propio evento a esta forma (por ejemplo, la bitácora de una solicitud
 * mapea sus eventos a `EventoLineaTiempo`).
 */
export interface EventoLineaTiempo {
  readonly id: string;
  /** Título del evento. */
  readonly titulo: string;
  /** Icono Material del nodo. */
  readonly icono: string;
  /** Tono del nodo. */
  readonly tono: TonoNodoLineaTiempo;
  /** Fecha y hora legible ("02 de Marzo de 2026 - 11:30 COT"). */
  readonly fecha: string;
  /** Fecha en ISO-8601, para el atributo `datetime` de `<time>`. */
  readonly fechaIso: string;
  /** Chips de la fila superior (categoría del evento…). */
  readonly etiquetas?: readonly EtiquetaLineaTiempo[];
  /** Estado del proceso tras el evento; se pinta con `chip-estado`. */
  readonly estado?: EstadoSolicitud;
  /** Estado previo; se pinta con `chip-estado` cuando difiere del actual. */
  readonly estadoAnterior?: EstadoSolicitud;
  /** Resultado de la acción ("Despacho Conforme"). */
  readonly resultado?: EtiquetaLineaTiempo;
  /** Detalle del evento; puede traer HTML (se sanea con `htmlSeguro`). */
  readonly detalle?: string;
  /** Chip adicional del detalle ("SICAPITAL OK"). */
  readonly sello?: string;
  readonly autor?: AutorLineaTiempo;
  readonly evidencia?: EvidenciaLineaTiempo;
}

/** Tratamientos que no cuentan para las iniciales del avatar. */
const TRATAMIENTOS: readonly string[] = [
  "dr",
  "dra",
  "ing",
  "lic",
  "mg",
  "ms",
  "sr",
  "sra",
  "pro",
];

/**
 * Línea de tiempo vertical de eventos.
 *
 * Lista ordenada (`ol`) con un riel continuo y una ficha por evento: nodo con
 * icono, chips de cabecera, fecha, título, detalle y pie con autoría y
 * evidencia. Es genérica a propósito: sirve para la bitácora de una
 * solicitud, el historial de modificaciones de una subsanación o cualquier
 * otra secuencia de eventos.
 *
 * El estado de un evento se pinta con `chip-estado` (el catálogo institucional
 * de estados de solicitud), nunca con un color suelto.
 */
@Component({
  selector: "linea-tiempo",
  templateUrl: "./linea-tiempo.component.html",
  styleUrls: ["./linea-tiempo.component.scss"],
  standalone: false,
})
export class LineaTiempoComponent {
  /** Eventos a mostrar, en el orden en que se pintan. */
  @Input({ required: true }) eventos: readonly EventoLineaTiempo[] = [];

  /**
   * Sentido de la numeración.
   *
   * `descendente` numera desde el más reciente (1 = último) y marca el
   * primero como "(Más reciente)"; `ascendente` numera desde el primero.
   */
  @Input() orden: "descendente" | "ascendente" = "descendente";

  /** Prefijo del ordinal ("Evento 3"). */
  @Input() prefijoEvento = "Evento";

  /** Nombre accesible de la lista. */
  @Input() etiquetaLista = "Línea de tiempo de eventos";

  /** Número de orden de un evento según el sentido de la lista. */
  numero(indice: number): number {
    return this.orden === "descendente"
      ? this.eventos.length - indice
      : indice + 1;
  }

  /** true si el estado previo difiere del actual; entonces se pintan ambos. */
  cambiaEstado(evento: EventoLineaTiempo): boolean {
    return !!evento.estadoAnterior && evento.estadoAnterior !== evento.estado;
  }

  /**
   * Iniciales del autor para el avatar ("RQ").
   *
   * Se ignoran los tratamientos (Dra., Dr., Ing.) para tomar las iniciales
   * reales del nombre.
   */
  iniciales(autor: AutorLineaTiempo): string {
    const base = (autor.nombre ?? autor.usuario).trim();
    const partes = base
      .split(/\s+/)
      .filter((parte) => parte.length > 0)
      .filter((parte) => !TRATAMIENTOS.includes(parte.toLowerCase().replace(".", "")));
    if (partes.length === 0) {
      return "—";
    }
    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }
    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
  }
}
