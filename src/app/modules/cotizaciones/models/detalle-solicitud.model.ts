/**
 * Modelos del detalle de una solicitud (S-03).
 *
 * El detalle consolida en modo lectura lo que el solicitante diligenció en el
 * asistente de creación (S-02). La pestaña "General" reúne la información del
 * responsable, las características de la solicitud y el plan de acción
 * relacionado, más los datos de cabecera (encabezado de página).
 *
 * Los textos largos (`objetivo`, `criterioSeleccion`, `planAccion`, …) llegan
 * como HTML del editor enriquecido; las vistas deben pintarlos con
 * `html-seguro.pipe` (sanitizado), nunca con `bypassSecurityTrustHtml`.
 */

import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";

/* ── Tarjeta 1: responsable de la solicitud ───────────────────────────────── */

/** Funcionario radicador y dependencias intervinientes (solo lectura). */
export interface ResponsableDetalle {
  readonly nombres: string;
  readonly apellidos: string;
  /** Documento con tipo y ciudad ("C.C. 79.845.120 de Bogotá D.C."). */
  readonly identificacion: string;
  /** Unidad ejecutora con sede ("1 - Rectoría (Sede Aduanilla de Paiba)"). */
  readonly unidadEjecutora: string;
  /** Código y nombre del ordenador del gasto ("ORD-0042 - Dr. …"). */
  readonly ordenadorGasto: string;
  /** Cargo del ordenador ("(Vicerrector Administrativo)"). */
  readonly ordenadorCargo: string;
  readonly dependenciaSolicitante: string;
  readonly dependenciaDestino: string;
}

/* ── Tarjeta 2: características de la solicitud ───────────────────────────── */

/** Fecha/hora de un hito del cronograma, ya formateada para lectura. */
export interface FechaCaracteristica {
  /** Fecha larga ("02 de Marzo de 2026"). */
  readonly fecha: string;
  /** Nota complementaria ("08:00 COT (Hora legal colombiana)"). */
  readonly nota: string;
}

/** Condiciones técnicas y operativas de la solicitud (solo lectura). */
export interface CaracteristicasDetalle {
  readonly apertura: FechaCaracteristica;
  readonly cierre: FechaCaracteristica;
  /** Plazo de ejecución ("4 meses calendario"). */
  readonly plazoEjecucion: string;
  /** Nota del plazo ("A partir de suscripción del acta de inicio"). */
  readonly plazoNota: string;
  /** Objetivo/tema (HTML del editor enriquecido). */
  readonly objetivo: string;
  /** Requisitos habilitantes mínimos (texto). */
  readonly requisitos: string;
  /** Criterio de selección (HTML del editor enriquecido). */
  readonly criterioSeleccion: string;
  /** Observaciones adicionales (texto). */
  readonly observaciones: string;
}

/* ── Tarjeta 3: plan de acción relacionado ────────────────────────────────── */

/** Plan de acción institucional que respalda la solicitud. */
export interface PlanAccionDetalle {
  /** Código de la meta ("PAA-2026-META-14"). */
  readonly codigo: string;
  /** Descripción del plan y meta estratégica (HTML). */
  readonly descripcion: string;
  /** Eje estratégico ("Eje: Gobernanza Tecnológica y Conectividad"). */
  readonly eje: string;
  /** Acto de aprobación ("Aprobación Consejo Superior: Acuerdo 012 de 2024"). */
  readonly aprobacion: string;
}

/* ── Agregado del detalle (lo que consume la Pestaña 1) ───────────────────── */

/**
 * Contenido completo de la pestaña "General".
 *
 * Es un agregado independiente de `CabeceraSolicitud`: la cabecera la pinta el
 * armazón y la pestaña sólo pinta su propio bloque.
 */
export interface GeneralDetalle {
  readonly responsable: ResponsableDetalle;
  readonly caracteristicas: CaracteristicasDetalle;
  readonly planAccion: PlanAccionDetalle;
}

/* ── Pestaña 2: presupuesto (SICAPITAL, solo lectura) ─────────────────────── */

/** Tono con el que se pinta el estado de una fila de imputación. */
export type TonoEstadoPresupuesto = "exito" | "neutro" | "info";

/** Fila de la tabla "Imputación y Desagregación Presupuestal". */
export interface ImputacionPresupuestal {
  /** Año de la vigencia ("2026"). */
  readonly vigencia: string;
  /** Necesidad que originó el CDP ("NEC-2026-00892"). */
  readonly solicitudNecesidad: string;
  /** Número del certificado ("CDP-2026-00412"). */
  readonly numeroCdp: string;
  /** Valor imputado en pesos; se formatea con `formatoCop`. */
  readonly valor: number;
  /** Dependencia responsable ("Rectoría"). */
  readonly dependencia: string;
  /** Área interna de la dependencia ("DIRTEI (Tecnología TIC)"). */
  readonly dependenciaArea: string;
  /** Código del rubro ("2.1.2.02.02.008"). */
  readonly rubro: string;
  /** Nombre del rubro ("Equipamiento e Infraestructura Tecnológica TIC"). */
  readonly rubroNombre: string;
  /** Estado de la reserva ("Vigente / Reservado"). */
  readonly estado: string;
  readonly tono: TonoEstadoPresupuesto;
}

/** Firma electrónica de aval presupuestal (PKI institucional). */
export interface FirmaAval {
  /** Rol del firmante ("Ordenador del Gasto"). */
  readonly rol: string;
  readonly nombre: string;
  readonly cargo: string;
  /** Icono Material del bloque. */
  readonly icono: string;
  /** Hash abreviado del sello ("SHA-256: 8F2A...99C1"). */
  readonly hash: string;
  /** Fecha de refrendación ("28/02/2026 - 15:42:10 COT"). */
  readonly fechaRefrendacion: string;
  readonly aprobado: boolean;
}

/** Metadatos del saldo del rubro que acompañan al valor del CDP. */
export interface SaldoRubro {
  /** Número del certificado ("CDP-2026-00412"). */
  readonly numeroCdp: string;
  /** Fecha de expedición ("28 de Febrero de 2026"). */
  readonly fechaExpedicion: string;
  /** Saldo disponible del rubro en pesos ("$ 210.000.000"). */
  readonly saldoDisponible: number;
}

/**
 * Contenido completo de la pestaña "Presupuesto".
 *
 * Es un agregado independiente del de la pestaña "General": ambas cuelgan de
 * `SolicitudDetalle`. Cuando la solicitud no tiene información presupuestal
 * (p. ej. un borrador sin CDP) el detalle trae `presupuesto: null` y la pestaña
 * muestra su estado vacío.
 */
export interface PresupuestoDetalle {
  /** Valor del CDP en pesos (cifra destacada). */
  readonly valorCdp: number;
  /** true si SICAPITAL confirmó el certificado (badge de sincronización). */
  readonly sincronizado: boolean;
  /** Texto del badge de sincronización ("SICAPITAL: Sincronizado y Aprobado"). */
  readonly mensajeSincronizacion: string;
  /** Texto de apoyo bajo el valor del CDP. */
  readonly descripcionCdp: string;
  readonly saldo: SaldoRubro;
  readonly imputaciones: readonly ImputacionPresupuestal[];
  readonly firmas: readonly FirmaAval[];
  /** Texto del banner normativo (constante institucional). */
  readonly textoNormativo: string;
}

/** Suma los valores imputados de la tabla de presupuesto. */
export function totalImputado(
  imputaciones: readonly ImputacionPresupuestal[],
): number {
  return imputaciones.reduce(
    (acumulado, imputacion) => acumulado + imputacion.valor,
    0,
  );
}

/** Texto legal fijo del banner normativo de la pestaña "Presupuesto". */
export const TEXTO_NORMATIVO_PRESUPUESTO =
  "De conformidad con el Estatuto de Contratación de la Universidad Distrital (Acuerdo 003 de 2015) y el Régimen Presupuestal de Entidades Autónomas (Ley 30 de 1992), ningún compromiso u ordenación de gasto podrá contraerse sin el correspondiente Certificado de Disponibilidad Presupuestal que ampare la totalidad de la vigencia estimada.";

/* ── Contadores compartidos por la barra de pestañas ──────────────────────── */

/**
 * Contadores de la barra de pestañas (Ítems / Proveedores / Documentos).
 *
 * Se derivan del modelo simulado; cuando exista backend vendrán del detalle
 * real de la solicitud.
 */
export interface ContadoresPestanas {
  readonly items: number;
  readonly proveedores: number;
  readonly documentos: number;
}
