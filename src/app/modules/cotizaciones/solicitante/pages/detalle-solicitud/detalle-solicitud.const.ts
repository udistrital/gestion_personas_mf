/**
 * Catálogo de las pestañas del detalle de una solicitud (S-03).
 *
 * Es la única fuente del orden, el nombre, el icono y la ruta relativa de cada
 * pestaña; el armazón y la barra de pestañas se generan a partir de aquí, de
 * modo que agregar una pestaña no obliga a tocar la plantilla del armazón.
 */

import { ContadoresPestanas } from "../../../models/detalle-solicitud.model";

/** Identificador estable de cada pestaña (también es su segmento de ruta). */
export type PestanaDetalle =
  | "general"
  | "presupuesto"
  | "items"
  | "contratacion"
  | "proveedores"
  | "documentos"
  | "historial";

/** Definición de una pestaña del detalle. */
export interface PestanaDetalleMeta {
  readonly id: PestanaDetalle;
  /** Nombre visible en la barra. */
  readonly etiqueta: string;
  readonly icono: string;
  /** Clave del contador a mostrar a la derecha del nombre; null = sin badge. */
  readonly contador: keyof ContadoresPestanas | null;
  /** false ⇒ la pestaña aún no tiene contenido (placeholder). */
  readonly implementada: boolean;
}

/**
 * Pestañas del detalle en el orden del mockup.
 *
 * Hoy sólo "General" tiene contenido; las demás muestran el placeholder hasta
 * que se implemente cada una.
 */
export const PESTANAS_DETALLE: readonly PestanaDetalleMeta[] = [
  { id: "general", etiqueta: "General", icono: "info", contador: null, implementada: true },
  { id: "presupuesto", etiqueta: "Presupuesto", icono: "payments", contador: null, implementada: true },
  { id: "items", etiqueta: "Ítems", icono: "list_alt", contador: "items", implementada: true },
  { id: "contratacion", etiqueta: "Contratación y pago", icono: "handshake", contador: null, implementada: true },
  { id: "proveedores", etiqueta: "Proveedores objetivo", icono: "store", contador: "proveedores", implementada: false },
  { id: "documentos", etiqueta: "Documentos", icono: "folder_open", contador: "documentos", implementada: false },
  { id: "historial", etiqueta: "Historial", icono: "history", contador: null, implementada: false },
];
