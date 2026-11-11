import { extensionDe, type DocumentoOferente } from "./documentos.model";
import type { ResumenDiferencias } from "./edicion-solicitud.model";
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
export type ModoRespuestaProveedor = "responder" | "actualizar";

export interface ItemRespuestaProveedor {
  readonly itemId: ItemSolicitud["id"];
  readonly valorUnitario: number | null;
  readonly iva: TipoIvaOferta;
  readonly nota: string;
  /** El ítem fue suprimido por la modificación de la solicitud. */
  readonly eliminado?: boolean;
}

/**
 * Documento aportado en una respuesta.
 *
 * Un documento puede ser un archivo nuevo (`archivo`) o un documento que ya
 * quedó radicado en la versión anterior (`radicadoId`). Así la actualización
 * conserva los soportes sin volver a subirlos y el mismo modelo sirve para
 * P-04 y P-05.
 */
export interface DocumentoRespuestaProveedor {
  readonly requisitoId: string;
  readonly archivo?: File;
  readonly radicadoId?: string;
  readonly nombre?: string;
  readonly tamanoBytes?: number;
}

/** Resumen inmutable de una versión radicada de la respuesta. */
export interface VersionRespuestaProveedor {
  readonly version: string;
  readonly revision: number;
  readonly fecha: string;
  readonly radicado?: string;
  readonly versionSolicitud: string;
  readonly total: number;
  readonly usuario?: string;
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
  readonly total: number;
  readonly version: string;
  readonly revision: number;
  /** Versión de la solicitud que se estaba respondiendo al radicar. */
  readonly versionSolicitudRespondida: string;
  /** Versión de solicitud para la que ya se aplicó esta actualización. */
  readonly actualizadaParaVersion?: string;
  readonly fechaRadicacion?: string;
  readonly fechaActualizacion?: string;
  readonly usuarioActualizacion?: string;
  readonly reemplazaRadicado?: string;
  readonly radicado?: string;
  readonly versionesAnteriores: readonly VersionRespuestaProveedor[];
  /**
   * Huella local de integridad de la versión radicada.
   *
   * Es provisional: no sustituye la firma institucional ni el sello
   * criptográfico del gestor documental. Se calcula en el cliente para que la
   * constancia de P-06 muestre una referencia estable.
   */
  readonly hash?: string;
}

export interface BaseRespuestaProveedor {
  readonly items: readonly ItemSolicitud[];
  readonly documentos: readonly DocumentoOferente[];
  readonly respuesta: RespuestaProveedor | null;
}

/** Datos de la primera carga de P-05. */
export interface BaseActualizacionRespuesta {
  readonly items: readonly ItemSolicitud[];
  /** Ítems de la versión de solicitud anterior, para la comparativa. */
  readonly itemsAnteriores: readonly ItemSolicitud[];
  readonly documentos: readonly DocumentoOferente[];
  readonly respuestaVigente: RespuestaProveedor;
  readonly adenda: {
    readonly numero?: string;
    readonly versionAnterior: string;
    readonly versionVigente: string;
    readonly publicadaEl: string;
    readonly motivo?: string;
    readonly diferencias: ResumenDiferencias;
    readonly itemsAnteriores: readonly ItemSolicitud[];
  };
  readonly proveedor: {
    readonly id: string;
    readonly nombre: string;
    readonly nit: string;
    readonly tipoPersona: string;
    readonly correo: string;
    readonly direccion: string;
    readonly representante: string;
    readonly ciudad: string;
  };
  readonly borrador: RespuestaProveedor | null;
}

/** Resultado de radicar una actualización. */
export interface ResultadoActualizacionRespuesta {
  readonly respuesta: RespuestaProveedor;
  readonly totalAnterior: number;
  readonly itemsActivos: number;
  readonly itemsSuprimidos: number;
  readonly hash: string;
}

export interface TotalesRespuestaProveedor {
  readonly subtotal: number;
  readonly descuento: number;
  readonly baseGravable: number;
  readonly iva: number;
  readonly total: number;
}

/** Fila de lectura de la oferta: ítem solicitado + precio y liquidación. */
export interface FilaOfertaRespuesta {
  readonly item: ItemSolicitud;
  readonly oferta: ItemRespuestaProveedor | undefined;
  readonly valorUnitario: number;
  /** Cantidad × valor unitario, antes de descuento. */
  readonly subtotal: number;
  /** Subtotal menos la parte proporcional del descuento comercial. */
  readonly baseGravable: number;
  readonly iva: number;
  /** Base gravable + IVA del ítem. */
  readonly total: number;
  readonly etiquetaIva: string;
  readonly nota: string;
}

/** Tasa numérica de un tratamiento de IVA (19, 5, 0). */
export function tasaIvaOferta(tipo: TipoIvaOferta | undefined): number {
  return tipo === "19" || tipo === "5" || tipo === "0" ? Number(tipo) : 0;
}

/** Etiqueta visible del tratamiento de IVA de un ítem. */
export function etiquetaIvaOferta(tipo: TipoIvaOferta | undefined): string {
  if (tipo === "excluido" || tipo === "exento") {
    return tipo === "excluido" ? "Excluido" : "Exento";
  }
  return `${tipo ?? "0"} %`;
}

/**
 * Construye las filas de la oferta con la misma liquidación que
 * `calcularTotalesRespuesta`: el descuento comercial se reparte de forma
 * proporcional sobre cada ítem antes de aplicar el IVA.
 *
 * Así la suma de las filas coincide con las tarjetas de totales, tanto en P-06
 * como en la revisión de P-04.
 */
export function construirFilasOferta(
  items: readonly ItemSolicitud[],
  ofertas: readonly ItemRespuestaProveedor[],
  descuentoPorcentaje: number | null,
): readonly FilaOfertaRespuesta[] {
  return items.map((item) => {
    const oferta = ofertas.find((fila) => fila.itemId === item.id);
    const valorUnitario = oferta?.valorUnitario ?? 0;
    const subtotal = item.cantidad * valorUnitario;
    const factorDescuento = 1 - (descuentoPorcentaje ?? 0) / 100;
    const baseGravable = Math.max(0, subtotal * factorDescuento);
    const iva = baseGravable * (tasaIvaOferta(oferta?.iva) / 100);

    return {
      item,
      oferta,
      valorUnitario,
      subtotal,
      baseGravable,
      iva,
      total: baseGravable + iva,
      etiquetaIva: etiquetaIvaOferta(oferta?.iva),
      nota: oferta?.nota?.trim() ?? "",
    };
  });
}

/** Resultado de pedir un documento radicado de la propia respuesta (P-06). */
export interface DocumentoRespuestaResuelto {
  readonly disponible: boolean;
  readonly mensaje: string;
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
