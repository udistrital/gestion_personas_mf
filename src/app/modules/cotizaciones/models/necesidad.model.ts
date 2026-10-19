/**
 * Modelos del paso 1 del asistente de solicitud (S-02).
 *
 * Todo lo que proviene de SICAPITAL es de solo lectura en la pantalla: el
 * solicitante solo define los criterios de búsqueda (unidad, vigencia y
 * número de necesidad) y el resto se cruza en el sistema financiero.
 */

/** Criterios con los que se consulta el cruce en SICAPITAL. */
export interface CriterioNecesidad {
  readonly unidadEjecutora: string;
  readonly vigencia: string;
  readonly numeroNecesidad: string;
}

/** Necesidad aprobada disponible para el selector del paso 1. */
export interface NecesidadOpcion {
  /** Código de la necesidad ("NEC-2026-00412"). */
  readonly valor: string;
  /** Nombre corto de la necesidad. */
  readonly titulo: string;
  /** Etiqueta completa para el `<option>`. */
  readonly etiqueta: string;
  readonly unidadEjecutora: string;
  readonly vigencia: number;
}

/** Certificado de disponibilidad (CDP) asociado a la necesidad. */
export interface DisponibilidadPresupuestal {
  readonly vigencia: number;
  readonly solicitudNecesidad: string;
  readonly numeroDisponibilidad: string;
  readonly valor: number;
  readonly dependencia: string;
  /** Código del rubro ("2.3.1.01.02"). */
  readonly rubro: string;
  readonly rubroNombre: string;
  readonly estado: string;
}

/** Tarjeta 2: información presupuestal (solo lectura). */
export interface InformacionPresupuestal {
  readonly disponibilidades: readonly DisponibilidadPresupuestal[];
  /** Valor certificado disponible para contratación. */
  readonly valorCdp: number;
}

/** Tarjeta 3: resumen pre-diligenciado de la solicitud (solo lectura). */
export interface InformacionSolicitud {
  readonly titulo: string;
  readonly vigencia: number;
  readonly objeto: string;
  readonly justificacion: string;
  readonly sede: string;
  readonly plazo: string;
  readonly controlPresupuestal: string;
}

/** Acuerdo marco que bloquea el avance hasta ser aceptado por el usuario. */
export interface AcuerdoMarco {
  readonly numero: string;
  readonly vigencia: number;
  readonly valorCdp: number;
  readonly tipoProceso: string;
  readonly explicacion: string;
}

/** Respuesta completa del cruce en SICAPITAL. */
export interface ResultadoCruce {
  readonly necesidad: NecesidadOpcion;
  readonly presupuesto: InformacionPresupuestal;
  readonly solicitud: InformacionSolicitud;
  /** Presente ⇒ el asistente exige aceptar el acuerdo antes de continuar. */
  readonly acuerdoMarco?: AcuerdoMarco;
}

/**
 * Formatea un valor en pesos colombianos ("$ 45.000.000").
 *
 * Formato único para las tarjetas 2 y 3 y para el diálogo de acuerdo marco.
 */
export function formatoCop(valor: number): string {
  return `$ ${new Intl.NumberFormat("es-CO").format(Math.round(valor))}`;
}

/**
 * Falla del cruce con el detalle técnico que muestra la pantalla.
 *
 * No es un `HttpError` (todavía no hay capa HTTP): el mock la construye con
 * los datos que el backend real devolvería.
 */
export class ErrorCruceSicapital extends Error {
  constructor(
    message: string,
    /** Código visible al usuario ("ERR-SIC-504"). */
    readonly codigo: string,
    /** Estado HTTP simulado (504, 0 para fallo de red). */
    readonly estado: number,
    /** Detalle técnico de la anomalía. */
    readonly detalle: string,
    /** Servicio invocado. */
    readonly servicio: string,
    /** Host de destino. */
    readonly host: string,
  ) {
    super(message);
    this.name = "ErrorCruceSicapital";
  }
}
