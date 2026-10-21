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
