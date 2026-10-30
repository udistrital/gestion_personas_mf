/**
 * Modelos de la edición de una solicitud (S-04).
 *
 * S-04 reutiliza el asistente de S-02: el formulario y sus validaciones no
 * cambian. Lo que agrega este módulo es el estado de edición (modo completo o
 * restringido), el borrador por solicitud y el resumen de diferencias que el
 * paso 7 muestra antes de guardar.
 */

import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";
import type { ParametroPago } from "./contratacion.model";
import type { AnexoSolicitud, DocumentoOferente } from "./documentos.model";
import type { ItemSolicitud, ModoRegistro } from "./items.model";
import type { ResultadoCruce } from "./necesidad.model";
import type { ActividadVinculada } from "./proveedores.model";
import type { SolicitudDetalle } from "./solicitud.model";

/**
 * Alcance de la edición.
 *
 * - `completa`: borrador. Se pueden modificar los pasos 2 a 6.
 * - `restringida`: solicitud ya enviada. Solo se modifican los ítems y la
 *   fecha de cierre, y el cambio queda pendiente de aprobación (S-08).
 */
export type ModoEdicionSolicitud = "completa" | "restringida";

/** Criterios del paso 1 (solo lectura en edición). */
export interface ValoresNecesidad {
  readonly unidadEjecutora: string;
  readonly vigencia: string;
  readonly numeroNecesidad: string;
}

/** Campos propios del paso 2. Los textos largos son HTML del editor. */
export interface ValoresDatosGenerales {
  readonly dependenciaSolicitante: string;
  readonly dependenciaDestino: string;
  readonly fechaApertura: string;
  readonly fechaCierre: string;
  readonly criterioSeleccion: string;
  readonly planAccion: string;
}

/** Registros y metadatos del paso 3. */
export interface ValoresItems {
  readonly modo: ModoRegistro;
  readonly archivo: string;
  readonly procesado: boolean;
  readonly registros: readonly ItemSolicitud[];
}

/** Condiciones contractuales del paso 4. */
export interface ValoresContratacion {
  readonly tipoContrato: string;
  readonly medioPago: string;
  readonly formaPago: string;
  readonly parametros: readonly ParametroPago[];
}

/** Segmentación de proveedores del paso 5. */
export interface ValoresProveedores {
  readonly actividades: readonly ActividadVinculada[];
  readonly areaSnies: string;
  readonly nucleoSnies: string;
}

/** Expediente documental del paso 6. */
export interface ValoresDocumentos {
  readonly anexos: readonly AnexoSolicitud[];
  readonly requeridos: readonly DocumentoOferente[];
}

/**
 * Fotografía editable de una solicitud.
 *
 * Es la fuente única para hidratar el asistente en edición y para calcular las
 * diferencias: se guarda junto al detalle (`SolicitudDetalle.edicion`) y el
 * borrador de edición la persiste sin archivos binarios.
 */
export interface DatosEdicionSolicitud {
  readonly necesidad: ValoresNecesidad;
  readonly datosGenerales: ValoresDatosGenerales;
  readonly items: ValoresItems;
  readonly contratacion: ValoresContratacion;
  readonly proveedores: ValoresProveedores;
  readonly documentos: ValoresDocumentos;
  /** Cruce SICAPITAL original: el paso 1 no vuelve a consultarlo. */
  readonly resultadoCruce: ResultadoCruce;
}

/** Contexto que el armazón S-04 entrega al asistente reutilizado. */
export interface ContextoEdicionSolicitud {
  readonly solicitud: SolicitudDetalle;
  readonly modo: ModoEdicionSolicitud;
  readonly valores: DatosEdicionSolicitud;
}

/** Modificación restringida pendiente de aprobación (S-08). */
export interface ModificacionPendiente {
  readonly version: string;
  readonly revision: number;
  readonly solicitadaEl: string;
  readonly solicitadaPor: string;
  readonly cambios: number;
  /** Propuesta que se aplicará cuando el aprobador la acepte. */
  readonly valores: DatosEdicionSolicitud;
}

/** Cambio puntual de un campo, con su paso de origen. */
export interface CambioCampo {
  /** Paso del asistente al que pertenece el cambio (2 a 6). */
  readonly paso: number;
  /** Etiqueta visible del campo ("Fecha de cierre"). */
  readonly etiqueta: string;
  /** Valor anterior en texto plano; vacío = campo nuevo. */
  readonly anterior: string;
  /** Valor nuevo en texto plano; vacío = campo eliminado. */
  readonly nuevo: string;
}

/** Cambios agrupados por paso; el paso 7 los pinta en tarjetas. */
export interface GrupoDiferencias {
  readonly paso: number;
  readonly titulo: string;
  readonly icono: string;
  readonly cambios: readonly CambioCampo[];
}

/** Resultado del cálculo de diferencias entre la versión base y el formulario. */
export interface ResumenDiferencias {
  readonly grupos: readonly GrupoDiferencias[];
  /** Total de campos modificados (suma de los grupos). */
  readonly total: number;
}

/**
 * Versión guardada de la edición de una solicitud.
 *
 * El descarte de S-04 es progresivo: el usuario puede conservar la versión
 * vigente o volver a una anterior. Cada versión informa los cambios guardados
 * que se perderían al elegirla, calculados contra la versión vigente.
 */
export interface VersionEdicionSolicitud {
  /** Versión visible de la fotografía ("v1.2"). */
  readonly version: string;
  /** Revisión asociada a la versión. */
  readonly revision: number;
  /** Fecha de la versión ("18/02/2026 11:40 COT"). */
  readonly fecha: string;
  /** Etiqueta visible: "Versión vigente", "Versión guardada" u "Original". */
  readonly etiqueta: string;
  /** true si es la versión vigente: elegirla solo descarta lo no guardado. */
  readonly actual: boolean;
  /** Cambios guardados que se perderían al volver a esta versión. */
  readonly diferencias: ResumenDiferencias;
}

/** Resultado de guardar una edición. */
export interface ResultadoGuardadoSolicitud {
  readonly modo: ModoEdicionSolicitud;
  readonly version: string;
  readonly revision: number;
  readonly estado: EstadoSolicitud;
  readonly fecha: string;
  readonly hash: string;
  readonly cambios: number;
  readonly grupos: readonly GrupoDiferencias[];
}

/* ── Etiquetas y valores por defecto ──────────────────────────────────────── */

/** Versión visible de una solicitud (las filas antiguas asumen v1.0). */
export function versionSolicitud(solicitud: {
  readonly version?: string;
}): string {
  return solicitud.version ?? "v1.0";
}

/** Número de revisión visible (las filas antiguas asumen 1). */
export function revisionSolicitud(solicitud: {
  readonly revision?: number;
}): number {
  return solicitud.revision ?? 1;
}

/** Versión del borrador de edición: cada guardado sube la revisión menor. */
export function siguienteVersionBorrador(version: string): string {
  const coincidencia = /^v(\d+)\.(\d+)$/.exec(version);
  if (!coincidencia) {
    return "v1.1";
  }
  return `v${coincidencia[1]}.${Number(coincidencia[2]) + 1}`;
}

/** Versión de una modificación restringida: sube la revisión mayor. */
export function siguienteVersionModificacion(version: string): string {
  const coincidencia = /^v(\d+)\.(\d+)$/.exec(version);
  if (!coincidencia) {
    return "v2.0";
  }
  return `v${Number(coincidencia[1]) + 1}.0`;
}
