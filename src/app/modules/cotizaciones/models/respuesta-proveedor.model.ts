import { extensionDe, type DocumentoOferente } from "./documentos.model";
import type { ItemSolicitud } from "./items.model";

/**
 * Formatos admitidos en el soporte detallado de la cotización (RN-41).
 *
 * Es la misma lista que valida P-04 al adjuntar archivos; S-10 la usa para
 * verificar los documentos radicados sin redefinir la regla.
 */
export const FORMATOS_SOPORTE_OFERTA = [
  "pdf",
  "xls",
  "xlsx",
  "doc",
  "docx",
] as const;

/** true cuando el archivo usa un formato admitido por RN-41. */
export function esFormatoSoporteOferta(nombre: string): boolean {
  return (FORMATOS_SOPORTE_OFERTA as readonly string[]).includes(
    extensionDe(nombre),
  );
}

export type EstadoRespuestaProveedor = "borrador" | "enviada";
export type TipoIvaOferta = "19" | "5" | "0" | "excluido" | "exento";
export type ModalidadCotizacion = "individual" | "masivo";

export interface ItemRespuestaProveedor {
  readonly itemId: ItemSolicitud["id"];
  readonly valorUnitario: number | null;
  readonly iva: TipoIvaOferta;
  readonly nota: string;
}

export interface DocumentoRespuestaProveedor {
  readonly requisitoId: string;
  readonly archivo: File;
}

export interface RespuestaProveedor {
  readonly id: string;
  readonly solicitudId: string;
  readonly invitacionId: string;
  readonly proveedorId: string;
  readonly estado: EstadoRespuestaProveedor;
  readonly items: readonly ItemRespuestaProveedor[];
  readonly fechaVencimiento: string;
  readonly descuentoPorcentaje: number | null;
  readonly condicionesComerciales: string;
  readonly modalidad: ModalidadCotizacion;
  readonly archivos: readonly DocumentoRespuestaProveedor[];
  readonly notaAdicional: string;
  readonly fechaRadicacion?: string;
  readonly radicado?: string;
}

export interface BaseRespuestaProveedor {
  readonly items: readonly ItemSolicitud[];
  readonly documentos: readonly DocumentoOferente[];
  readonly respuesta: RespuestaProveedor | null;
}

export interface TotalesRespuestaProveedor {
  readonly subtotal: number;
  readonly descuento: number;
  readonly baseGravable: number;
  readonly iva: number;
  readonly total: number;
}

export function calcularTotalesRespuesta(
  items: readonly ItemSolicitud[],
  ofertas: readonly ItemRespuestaProveedor[],
  descuentoPorcentaje: number | null,
): TotalesRespuestaProveedor {
  const subtotal = items.reduce((total, item) => {
    const oferta = ofertas.find((fila) => fila.itemId === item.id);
    return total + item.cantidad * (oferta?.valorUnitario ?? 0);
  }, 0);
  const descuento = subtotal * ((descuentoPorcentaje ?? 0) / 100);
  const baseGravable = Math.max(0, subtotal - descuento);
  const iva = items.reduce((total, item) => {
    const oferta = ofertas.find((fila) => fila.itemId === item.id);
    const valor = item.cantidad * (oferta?.valorUnitario ?? 0);
    const valorDescontado =
      subtotal > 0 ? valor * (baseGravable / subtotal) : 0;
    const tasa = ["19", "5", "0"].includes(oferta?.iva ?? "")
      ? Number(oferta?.iva)
      : 0;
    return total + valorDescontado * (tasa / 100);
  }, 0);

  return {
    subtotal,
    descuento,
    baseGravable,
    iva,
    total: baseGravable + iva,
  };
}
