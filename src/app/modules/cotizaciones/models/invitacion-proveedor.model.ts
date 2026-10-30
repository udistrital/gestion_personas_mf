import type {
  EstadoPostulacionProveedor,
  EstadoSolicitud,
} from "src/app/core/constants/estados-solicitud.const";
import type {
  GeneralDetalle,
  ImputacionPresupuestal,
  ItemsDetalle,
  SaldoRubro,
  ContratacionDetalle,
} from "./detalle-solicitud.model";
import type { DocumentoOferente, AnexoSolicitud } from "./documentos.model";
import type { ResumenDiferencias } from "./edicion-solicitud.model";
import type { ItemSolicitud } from "./items.model";
import type { Solicitud, TipoCotizacion } from "./solicitud.model";

/** Invitación del proveedor; los datos de la solicitud se conservan en Solicitud. */
export interface InvitacionProveedor {
  readonly id: string;
  readonly solicitudId: string;
  readonly estado: EstadoPostulacionProveedor;
  /** Fecha ISO de radicación; ausente mientras la postulación es borrador. */
  readonly fechaRadicacion?: string;
  /** Metadatos de una adenda oficialmente publicada para esta invitación. */
  readonly adendaPublicada?: {
    readonly versionAnterior: string;
    readonly versionVigente: string;
    readonly publicadaEl: string;
    readonly anexoId: string;
  };
}

/** Anexo público sin datos de autoría o auditoría interna. */
export type AnexoPublicoProveedor = Pick<
  AnexoSolicitud,
  | "id"
  | "nombre"
  | "pesoBytes"
  | "icono"
  | "estado"
  | "progreso"
  | "descripcion"
>;

/** Proyección de lectura del detalle del proveedor: solo campos autorizados. */
export interface SolicitudDetalleProveedor {
  readonly id: string;
  readonly vigencia: number;
  readonly unidadEjecutora: string;
  readonly titulo: string;
  readonly apertura: string | null;
  readonly cierre: string | null;
  /** Fecha límite específica para observaciones; no se deriva del cierre del proceso. */
  readonly fechaLimiteObservaciones?: string | null;
  readonly dependencia: string;
  readonly tipoCotizacion: TipoCotizacion;
  readonly estado: EstadoSolicitud;
  readonly version: string;
  readonly general: GeneralDetalle;
  readonly presupuesto: {
    readonly valorCdp: number;
    readonly descripcionCdp: string;
    readonly saldo: SaldoRubro;
    readonly imputaciones: readonly Pick<
      ImputacionPresupuestal,
      | "vigencia"
      | "numeroCdp"
      | "valor"
      | "rubro"
      | "rubroNombre"
      | "estado"
      | "tono"
    >[];
  } | null;
  readonly itemsDetalle: ItemsDetalle;
  readonly items: readonly (ItemSolicitud & {
    readonly valorUnitarioTecho: number | null;
  })[];
  readonly contratacion: ContratacionDetalle | null;
  readonly documentos: {
    readonly anexos: readonly AnexoPublicoProveedor[];
    readonly requeridos: readonly DocumentoOferente[];
  } | null;
}

/** Datos que P-02 necesita además de la solicitud proyectada. */
export interface DetalleInvitacionProveedor {
  readonly invitacion: InvitacionProveedor;
  readonly solicitud: SolicitudDetalleProveedor;
  readonly yaRespondio: boolean;
  readonly adenda: {
    readonly versionAnterior: string;
    readonly versionVigente: string;
    readonly publicadaEl: string;
    readonly anexoId: string;
    readonly diferencias: ResumenDiferencias;
  } | null;
}

/** Proyección de lectura para la bandeja, sin duplicar atributos de Solicitud. */
export interface InvitacionProveedorConSolicitud {
  readonly invitacion: InvitacionProveedor;
  readonly solicitud: Solicitud;
  readonly ordenadorGasto: string;
}

export type GrupoFiltroInvitacion =
  | "todas"
  | "por-responder"
  | "respondidas"
  | "con-modificaciones"
  | "cerradas";

export interface FiltroInvitacionesProveedor {
  readonly vigencia: string;
  readonly estado: string;
  readonly tipoCotizacion: string;
  readonly dependencia: string;
  readonly busqueda: string;
  readonly grupo: GrupoFiltroInvitacion;
  readonly ordenNumero?: "asc" | "desc";
}

export interface ConteosFiltrosInvitaciones {
  readonly todas: number;
  readonly "por-responder": number;
  readonly respondidas: number;
  readonly "con-modificaciones": number;
  readonly cerradas: number;
}

export interface ResultadoListadoInvitaciones {
  readonly invitaciones: readonly InvitacionProveedorConSolicitud[];
  readonly total: number;
  readonly conteos: ConteosFiltrosInvitaciones;
  readonly dependencias: readonly string[];
}

/** Categorización temporal de los chips rápidos del mockup. */
export function grupoDeInvitacion(
  estado: EstadoPostulacionProveedor,
): Exclude<GrupoFiltroInvitacion, "todas"> {
  switch (estado) {
    case "borrador":
      return "por-responder";
    case "pendiente-ajuste":
      return "con-modificaciones";
    case "enviada":
      return "respondidas";
    case "excluida":
    case "aceptada":
    case "rechazada":
    case "declinada":
    case "vencida":
      return "cerradas";
  }
}

export const GRUPOS_FILTRO_INVITACION: readonly {
  readonly valor: GrupoFiltroInvitacion;
  readonly etiqueta: string;
}[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "por-responder", etiqueta: "Por responder" },
  { valor: "respondidas", etiqueta: "Respondidas" },
  { valor: "con-modificaciones", etiqueta: "Con modificaciones" },
  { valor: "cerradas", etiqueta: "Cerradas" },
];

export const TIPOS_COTIZACION_PROVEEDOR: readonly {
  readonly valor: string;
  readonly etiqueta: string;
}[] = [
  { valor: "", etiqueta: "Todos los tipos" },
  { valor: "BIEN", etiqueta: "Bien" },
  { valor: "SERVICIO", etiqueta: "Servicio" },
  { valor: "BIEN_Y_SERVICIO", etiqueta: "Bien y servicio" },
];

export function etiquetaTipoCotizacionProveedor(
  tipo: TipoCotizacion,
): string {
  switch (tipo) {
    case "BIEN":
      return "Bien";
    case "SERVICIO":
      return "Servicio";
    case "BIEN_Y_SERVICIO":
      return "Bien y servicio";
  }
}

/** Indica si el proveedor ya presentó una postulación según su estado. */
export function tienePostulacionRadicada(
  invitacion: InvitacionProveedor,
): boolean {
  return invitacion.estado !== "borrador" && invitacion.estado !== "vencida";
}
