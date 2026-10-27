import type {
  EstadoPostulacionProveedor,
} from "src/app/core/constants/estados-solicitud.const";
import type { Solicitud, TipoCotizacion } from "./solicitud.model";

/** Invitación del proveedor; los datos de la solicitud se conservan en Solicitud. */
export interface InvitacionProveedor {
  readonly id: string;
  readonly solicitudId: string;
  readonly estado: EstadoPostulacionProveedor;
  /** Fecha ISO de radicación; ausente mientras la postulación es borrador. */
  readonly fechaRadicacion?: string;
}

/** Proyección de lectura para la bandeja, sin duplicar atributos de Solicitud. */
export interface InvitacionProveedorConSolicitud {
  readonly invitacion: InvitacionProveedor;
  readonly solicitud: Solicitud;
  readonly ordenadorGasto: string;
  readonly nota: string;
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
