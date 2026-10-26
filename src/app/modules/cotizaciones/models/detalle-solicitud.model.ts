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
import {
  ParametroPago,
  PORCENTAJE_TOTAL,
  ResumenPagos,
  calcularResumenPagos,
} from "./contratacion.model";
import { SegmentacionProveedores } from "./proveedores.model";
import { AnexoSolicitud, DocumentoOferente } from "./documentos.model";
import { EventoHistorial } from "./historial.model";

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

/* ── Pestaña 3: ítems solicitados (solo lectura) ─────────────────────────── */

/**
 * Cabecera de la pestaña "Ítems".
 *
 * Sólo aporta la unidad ejecutora y la ubicación de entrega, que el mockup
 * muestra en su propia tarjeta. El listado de ítems vive aparte, en
 * `SolicitudDetalle.items`, porque es el mismo modelo del asistente (S-02).
 */
export interface ItemsDetalle {
  /** Unidad ejecutora con su nombre ("División de Tecnologías … (DITIC)"). */
  readonly unidadEjecutora: string;
  /** Código institucional de la dependencia ("CÓD. 02-304-DITIC"). */
  readonly codigoDependencia: string;
  /** Lugar de entrega ("Sede Aduanilla de Paiba - Bloque B Sala DataCenter"). */
  readonly sede: string;
}

/* ── Pestaña 4: contratación y pago (solo lectura) ────────────────────────── */

/**
 * Sub-tarjeta de una validación obligatoria de pago (póliza, aportes PILA…).
 */
export interface RequisitoGarantia {
  /** Icono Material del bloque ("verified_user"). */
  readonly icono: string;
  /** Título de la validación ("Póliza Única de Cumplimiento"). */
  readonly titulo: string;
  /** Explicación de la validación (texto plano). */
  readonly descripcion: string;
}

/** Supervisión técnica designada por la institución. */
export interface SupervisorContrato {
  /** Cargo del supervisor ("Director de la DIRTEI…"). */
  readonly cargo: string;
  /** Párrafo explicativo (HTML); se pinta con `htmlSeguro`. */
  readonly parrafoHtml: string;
}

/**
 * Contenido completo de la pestaña "Contratación y pago".
 *
 * Es un agregado independiente del de las demás pestañas. Cuando la solicitud
 * aún no tiene condiciones contractuales definidas (p. ej. un borrador) el
 * detalle trae `contratacion: null` y la pestaña muestra su estado vacío.
 *
 * `tipoContrato`, `medioPago` y `formaPago` guardan el `valor` del catálogo de
 * `contratacion.model.ts` (el mismo del asistente); la vista resuelve la
 * etiqueta legible con `etiquetaCorta`, igual que el paso 7 de S-02. El
 * cronograma reutiliza `ParametroPago`, de modo que no hay un segundo modelo
 * del mismo concepto.
 */
export interface ContratacionDetalle {
  /** Valor del catálogo `TIPOS_CONTRATO`. */
  readonly tipoContrato: string;
  /** Referencia normativa del tipo de contrato. */
  readonly tipoContratoNorma: string;
  /** Modalidad de selección ("Convocatoria Pública …"). */
  readonly modalidadSeleccion: string;
  /** Nota de la modalidad. */
  readonly modalidadNota: string;
  /** Plazo destacado ("4 meses calendario"). */
  readonly plazoEjecucion: string;
  /** Plazo en días ("120 días continuos"). */
  readonly plazoDias: string;
  /** Nota del plazo. */
  readonly plazoNota: string;
  /** Lugar de ejecución. */
  readonly lugarEjecucion: string;
  /** Dirección del lugar de ejecución. */
  readonly lugarDireccion: string;
  /** Valor del catálogo `MEDIOS_PAGO`. */
  readonly medioPago: string;
  /** Nota del medio de pago. */
  readonly medioPagoNota: string;
  /** Valor del catálogo `FORMAS_PAGO`. */
  readonly formaPago: string;
  /** Nota de la forma de pago. */
  readonly formaPagoNota: string;
  /** Reglamentación aplicable ("Resolución 067 de 2017"). */
  readonly reglamentacion: string;
  /** Nota de la reglamentación. */
  readonly reglamentacionNota: string;
  /** Banner de retenciones tributarias (texto plano). */
  readonly notaTributaria: string;
  /** Hitos contractuales de desembolso (mismo modelo del asistente, S-02). */
  readonly parametros: readonly ParametroPago[];
  /** Supervisión técnica designada. */
  readonly supervisor: SupervisorContrato;
  /** Validaciones obligatorias de pago. */
  readonly garantias: readonly RequisitoGarantia[];
}

/**
 * Resumen porcentual del cronograma de pagos.
 *
 * Reutiliza el cálculo del asistente (S-02) para que la pestaña y el paso 4
 * lleguen siempre al mismo resultado; no se reimplementa la suma.
 */
export function resumenPagos(
  contratacion: ContratacionDetalle,
): ResumenPagos {
  return calcularResumenPagos(contratacion.parametros);
}

/**
 * Monto estimado de un hito a partir del valor total.
 *
 * El valor total es el mismo que muestra la pestaña "Presupuesto"
 * (`totalImputado`), así que los montos no se escriben a mano ni se duplican.
 */
export function montoHito(parametro: ParametroPago, valorTotal: number): number {
  return Math.round((valorTotal * Number(parametro.porcentaje || 0)) / PORCENTAJE_TOTAL);
}

/** true cuando los porcentajes del cronograma suman exactamente el 100 %. */
export function pagoCompleto(contratacion: ContratacionDetalle): boolean {
  return resumenPagos(contratacion).completo;
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

/* ── Pestaña 5: proveedores objetivo (solo lectura) ───────────────────────── */

/**
 * Registro de la notificación automatizada a los proveedores objetivo.
 *
 * Es la evidencia de que la convocatoria salió a los oferentes del segmento;
 * las cifras acompañan al contador de la tarjeta principal.
 */
export interface NotificacionProveedores {
  /** Fecha y hora del envío certificado ("15/02/2026 08:00 COT"). */
  readonly enviada: string;
  /** Proveedores que consultaron la convocatoria. */
  readonly vistos: number;
  /** Proveedores que descargaron el pliego de condiciones. */
  readonly descargaron: number;
  /** Proveedores que enviaron cotización. */
  readonly cotizaron: number;
  /** Hash abreviado de la auditoría de notificación. */
  readonly hash: string;
}

/**
 * Contenido completo de la pestaña "Proveedores objetivo".
 *
 * Es un agregado independiente del de las demás pestañas. Cuando la solicitud
 * todavía no tiene segmentación registrada (p. ej. un borrador) el detalle
 * trae `proveedores: null` y la pestaña muestra su estado vacío.
 *
 * La segmentación (CIIU y SNIES) es el mismo modelo del asistente (S-02); el
 * número de proveedores objetivo NO se guarda: se calcula cruzando el banco de
 * proveedores con la segmentación, igual que hace el paso 5.
 */
export interface ProveedoresObjetivoDetalle {
  /** Criterios de segmentación registrados (CIIU y SNIES). */
  readonly segmentacion: SegmentacionProveedores;
  /**
   * true cuando el cruce filtra por idoneidad técnica certificada (SNIES).
   *
   * La regla es de negocio: los bienes se segmentan solo por CIIU y los
   * servicios exigen además núcleo básico de conocimiento.
   */
  readonly requiereIdoneidad: boolean;
  /** Nota institucional sobre el requisito de idoneidad técnica (SNIES). */
  readonly notaIdoneidad: string;
  /** Referencia normativa del núcleo de conocimiento ("Acuerdo CSU 002/2021"). */
  readonly acuerdo: string;
  /** Registro de la notificación a los proveedores objetivo. */
  readonly notificacion: NotificacionProveedores;
}

/* ── Pestaña 6: documentos (solo lectura) ──────────────────────────────────── */

/**
 * Contenido documental de la solicitud.
 *
 * Reúne los dos bloques de la pestaña "Documentos": los anexos oficiales que
 * adjuntó la institución (sección 1) y la matriz de documentos que debe
 * presentar cada oferente al cotizar (sección 2).
 *
 * Los anexos y la matriz son los mismos del paso 6 del asistente (S-02): la
 * pestaña no define un segundo modelo de documento, solo lo muestra en solo
 * lectura.
 */
export interface DocumentosDetalle {
  /** Anexos oficiales cargados por la institución. */
  readonly anexos: readonly AnexoSolicitud[];
  /** Documentos exigidos al oferente al cotizar. */
  readonly requeridos: readonly DocumentoOferente[];
  /** Nota institucional sobre la obligatoriedad de los soportes. */
  readonly notaNormativa: string;
  /** Estado de la matriz documental (aún por definir). */
  readonly estadoMatriz: string;
  /** Fecha de la última modificación del expediente documental. */
  readonly ultimaModificacion: string;
  /** Versión del sistema que generó el expediente. */
  readonly versionSistema: string;
}

/* ── Pestaña 7: historial (bitácora de eventos, solo lectura) ─────────────── */

/**
 * Bitácora de eventos de la solicitud.
 *
 * Registro inmutable de lo que le pasó al expediente, del evento más reciente
 * al inicial. Los eventos y sus estados están definidos en
 * `historial.model.ts`; aquí solo se agrupan con los textos institucionales
 * que acompañan la bitácora.
 */
export interface HistorialDetalle {
  /** Eventos del expediente, del más reciente al más antiguo. */
  readonly eventos: readonly EventoHistorial[];
  /** Nota institucional sobre la confidencialidad de la bitácora. */
  readonly notaConfidencialidad: string;
  /** Etiqueta de la matriz normativa que falta por definir. */
  readonly matrizNormativa: string;
  /** Sello de tiempo certificado que respalda la bitácora. */
  readonly selloTiempo: string;
  /** Nota de integridad del pie de la bitácora. */
  readonly notaIntegridad: string;
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
