import { Injectable } from "@angular/core";
import { Observable, of, throwError, delay } from "rxjs";
import {
  EstadoSolicitud,
  MATRIZ_ACCIONES_POR_ESTADO,
} from "src/app/core/constants/estados-solicitud.const";
import type {
  ConteosFiltrosInvitaciones,
  FiltroInvitacionesProveedor,
  GrupoFiltroInvitacion,
  InvitacionProveedor,
  InvitacionProveedorConSolicitud,
  ResultadoListadoInvitaciones,
} from "../models/invitacion-proveedor.model";
import { grupoDeInvitacion } from "../models/invitacion-proveedor.model";
import {
  FiltroSolicitudes,
  ResultadoListado,
  Solicitud,
  SolicitudDetalle,
  DatosCancelacionSolicitud,
  TipoCotizacion,
  tipoNecesidad,
} from "../models/solicitud.model";
import {
  CaracteristicasDetalle,
  ContadoresPestanas,
  ContratacionDetalle,
  DocumentosDetalle,
  FirmaAval,
  GeneralDetalle,
  HistorialDetalle,
  ImputacionPresupuestal,
  ItemsDetalle,
  PlanAccionDetalle,
  PresupuestoDetalle,
  ProveedoresObjetivoDetalle,
  ResponsableDetalle,
  TEXTO_NORMATIVO_PRESUPUESTO,
} from "../models/detalle-solicitud.model";
import {
  EventoHistorial,
  EvidenciaHistorial,
  TipoEventoHistorial,
  TonoNodoHistorial,
} from "../models/historial.model";
import { ItemSolicitud, TipoNecesidadSolicitud } from "../models/items.model";
import { ParametroPago } from "../models/contratacion.model";
import { formatoCop } from "../models/necesidad.model";
import {
  AnexoSolicitud,
  DOCUMENTOS_OFERENTE_SEMILLA,
  DocumentoResuelto,
  iconoPorFormato,
} from "../models/documentos.model";
import {
  ACTIVIDADES_CIIU,
  ActividadCiiu,
  ActividadVinculada,
  SegmentacionProveedores,
  buscarProveedores,
  exigeSnies,
} from "../models/proveedores.model";
import type {
  DatosEdicionSolicitud,
  ModoEdicionSolicitud,
  ModificacionPendiente,
  ResultadoGuardadoSolicitud,
  VersionEdicionSolicitud,
} from "../models/edicion-solicitud.model";
import {
  revisionSolicitud,
  siguienteVersionBorrador,
  siguienteVersionModificacion,
  versionSolicitud,
} from "../models/edicion-solicitud.model";
import type { ResultadoCruce } from "../models/necesidad.model";
import {
  DEPENDENCIAS_DESTINO,
  DEPENDENCIAS_SOLICITANTES,
} from "../models/datos-generales.model";
import { DiferenciasSolicitudService } from "./diferencias-solicitud.service";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { MIN_CARACTERES_JUSTIFICACION } from "src/app/shared/validators/justificacion.validator";

/**
 * Capa de datos de solicitudes.
 *
 * Los componentes solo conocen esta clase abstracta; el enlace con la
 * implementación simulada se hace en UN solo punto (provider de
 * `SolicitanteModule`). Cuando exista el backend se reemplaza por
 * `SolicitudesServiceHttp` con `HttpClient` y no se toca ninguna pantalla.
 */
export abstract class SolicitudesService {
  /**
   * Listado paginado con filtros.
   *
   * @param criterios filtros del formulario (valores vacíos = sin filtro)
   * @param pagina índice de página base 0
   * @param porPagina tamaño de página
   */
  abstract listar(
    criterios: Partial<FiltroSolicitudes>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListado>;

  /** Listado paginado de invitaciones del proveedor y su solicitud asociada. */
  abstract listarInvitacionesProveedor(
    criterios: Partial<FiltroInvitacionesProveedor>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoInvitaciones>;

  /**
   * Detalle de una solicitud por su identificador.
   *
   * Devuelve `null` cuando la solicitud no existe; la pantalla de detalle
   * traduce ese `null` al estado "solicitud no encontrada".
   */
  abstract obtenerPorId(id: string): Observable<SolicitudDetalle | null>;

  /**
   * Guarda una edición de la solicitud (S-04).
   *
   * - Edición completa: aplica los cambios y mantiene el borrador.
   * - Edición restringida: registra la propuesta y pasa a `en-aprobacion`;
   *   los datos no cambian hasta que S-08 la apruebe.
   */
  abstract guardarEdicion(
    id: string,
    valores: DatosEdicionSolicitud,
    modo: ModoEdicionSolicitud,
  ): Observable<ResultadoGuardadoSolicitud>;

  /** Cancela una solicitud permitida por la matriz y registra su auditoría. */
  abstract cancelarSolicitud(
    id: string,
    justificacion: string,
  ): Observable<SolicitudDetalle>;

  /**
   * Versiones guardadas de la edición de una solicitud (S-04).
   *
   * El descarte es progresivo: la lista permite conservar la versión vigente o
   * volver a una anterior. Se devuelve de la más reciente a la más antigua e
   * incluye, en cada entrada, los cambios guardados que se perderían al
   * elegirla.
   */
  abstract historialVersiones(
    id: string,
  ): Observable<readonly VersionEdicionSolicitud[]>;

  /**
   * Devuelve la solicitud a una versión guardada anterior (S-04).
   *
   * La fotografía, la fila del listado y la bitácora vuelven al estado de la
   * versión elegida: los guardados posteriores se descartan de forma
   * progresiva, sin borrar toda la edición de la sesión.
   */
  abstract revertirEdicion(id: string, version: string): Observable<void>;

  /**
   * Documento adjunto de una solicitud, listo para verse o descargarse.
   *
   * Es el único punto que cambia cuando se conecte el gestor documental
   * institucional (Alfresco UD): hoy devuelve los metadatos del archivo y el
   * aviso de que la operación es simulada.
   *
   * @param id identificador del anexo (único en todo el repositorio)
   */
  abstract obtenerDocumento(id: string): Observable<DocumentoResuelto>;
}

const DATOS_MOCK: readonly Solicitud[] = [
  {
    id: "SOL-2026-0047",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Adquisición de estaciones de trabajo para el laboratorio de análisis de datos",
    apertura: "23/02/2026",
    cierre: "06/03/2026",
    dependencia: "Vicerrectoría Académica",
    tipoCotizacion: "BIEN",
    estado: "borrador",
    version: "v1.2",
    revision: 2,
    ultimaModificacion: "18/02/2026 11:40 COT",
  },
  {
    id: "SOL-2026-0046",
    vigencia: 2026,
    unidadEjecutora: "4",
    titulo:
      "Servicio de traducción y localización de documentos académicos oficiales",
    apertura: null,
    cierre: null,
    dependencia: "Facultad de Ciencias y Educación",
    tipoCotizacion: "SERVICIO",
    estado: "borrador",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "16/02/2026 09:20 COT",
  },
  {
    id: "SOL-2026-0044",
    vigencia: 2026,
    unidadEjecutora: "3",
    titulo: "Suministro de materiales de laboratorio para prácticas de química",
    apertura: "02/02/2026",
    cierre: "11/02/2026",
    dependencia: "Facultad de Ingeniería",
    tipoCotizacion: "BIEN",
    estado: "enviada-proveedores",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "02/02/2026 08:52 COT",
    fechaLimiteObservaciones: "2026-11-02T18:00:00-05:00",
  },
  {
    id: "SOL-2026-0042",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo: "Suministro de equipos de cómputo para laboratorios de posgrados",
    apertura: "15/02/2026",
    cierre: "26/02/2026",
    dependencia: "Vicerrectoría Académica",
    tipoCotizacion: "BIEN",
    estado: "enviada-con-modificaciones",
    version: "v2.0",
    revision: 3,
    ultimaModificacion: "02/03/2026 11:30 COT",
  },
  {
    id: "SOL-2026-0041",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo:
      "Renovación de la plataforma de gestión documental y firma electrónica",
    apertura: "10/02/2026",
    cierre: "20/02/2026",
    dependencia: "División de TI",
    tipoCotizacion: "SERVICIO",
    estado: "en-aprobacion",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "19/02/2026 15:05 COT",
  },
  {
    id: "SOL-2026-0039",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo:
      "Servicios de mantenimiento preventivo y correctivo de servidores centrales",
    apertura: "11/02/2026",
    cierre: "18/02/2026",
    dependencia: "División de TI",
    tipoCotizacion: "SERVICIO",
    estado: "en-evaluacion",
    version: "v1.1",
    revision: 2,
    ultimaModificacion: "25/02/2026 09:15 COT",
  },
  {
    id: "SOL-2026-0035",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo: "Adquisición de licencias de software estadístico y de modelado",
    apertura: null,
    cierre: null,
    dependencia: "Facultad del Medio Ambiente",
    tipoCotizacion: "BIEN",
    estado: "borrador",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "10/02/2026 16:45 COT",
  },
  {
    id: "SOL-2026-0028",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Servicio de auditoría contable y financiera para convenios especiales",
    apertura: "29/01/2026",
    cierre: "04/02/2026",
    dependencia: "Oficina Asesora de Control Interno",
    tipoCotizacion: "SERVICIO",
    estado: "enviada-proveedores",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "29/01/2026 10:45 COT",
    fechaLimiteObservaciones: "2026-10-12T18:00:00-05:00",
  },
  {
    id: "SOL-2026-0021",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo:
      "Renovación de pólizas institucionales de seguros de bienes muebles",
    apertura: "16/01/2026",
    cierre: "22/01/2026",
    dependencia: "Secretaría General",
    tipoCotizacion: "SERVICIO",
    estado: "desierta",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "22/01/2026 17:45 COT",
  },
  {
    id: "SOL-2026-0015",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Impresión de material editorial y pedagógico para el catálogo universitario",
    apertura: "09/01/2026",
    cierre: "14/01/2026",
    dependencia: "Editorial Universidad Distrital",
    tipoCotizacion: "BIEN_Y_SERVICIO",
    estado: "adjudicada",
    version: "v1.1",
    revision: 2,
    ultimaModificacion: "14/01/2026 17:45 COT",
  },
  {
    id: "SOL-2026-0008",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Adecuación locativa de cubículos para docentes ocasionales sede Macarena",
    apertura: null,
    cierre: null,
    dependencia: "División de Recursos Físicos",
    tipoCotizacion: "SERVICIO",
    estado: "desierta",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "12/01/2026 14:10 COT",
  },
  {
    id: "SOL-2026-0005",
    vigencia: 2026,
    unidadEjecutora: "3",
    titulo: "Licenciamiento de plataforma de analítica institucional",
    apertura: "20/01/2026",
    cierre: "28/01/2026",
    dependencia: "Facultad de Ingeniería",
    tipoCotizacion: "SERVICIO",
    estado: "cancelada",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "28/01/2026 09:05 COT",
    fechaLimiteObservaciones: "2026-01-28T18:00:00-05:00",
    cancelacion: {
      estadoAnterior: "enviada-proveedores",
      justificacion:
        "La necesidad institucional fue replanteada antes del cierre del proceso.",
      fecha: "28/01/2026 09:05 COT",
      usuario: "raquimbayap",
      autor: "Raúl Quimbaya",
      rol: "Solicitante",
      destinatariosNotificados: 12,
    },
  },
  {
    id: "SOL-2025-0117",
    vigencia: 2025,
    unidadEjecutora: "2",
    titulo: "Suministro de mobiliario para salas de estudio",
    apertura: "10/12/2025",
    cierre: "18/12/2025",
    dependencia: "IDEXUD",
    tipoCotizacion: "BIEN",
    estado: "desierta",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "18/12/2025 17:30 COT",
  },
  {
    id: "SOL-2025-0098",
    vigencia: 2025,
    unidadEjecutora: "4",
    titulo: "Servicio de aseo y cafetería sedes regionales",
    apertura: "05/11/2025",
    cierre: "14/11/2025",
    dependencia: "Facultad de Ciencias y Educación",
    tipoCotizacion: "SERVICIO",
    estado: "adjudicada",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "14/11/2025 17:45 COT",
  },
  {
    id: "SOL-2025-0074",
    vigencia: 2025,
    unidadEjecutora: "1",
    titulo: "Consultoría para el plan estratégico institucional 2026",
    apertura: "01/10/2025",
    cierre: "10/10/2025",
    dependencia: "Rectoría",
    tipoCotizacion: "SERVICIO",
    estado: "cancelada",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "10/10/2025 11:20 COT",
    cancelacion: {
      estadoAnterior: "enviada-proveedores",
      justificacion:
        "Se canceló el proceso por ajuste de la planeación institucional.",
      fecha: "10/10/2025 11:20 COT",
      usuario: "mpulido",
      autor: "Martha Patricia Pulido",
      rol: "Solicitante",
      destinatariosNotificados: 8,
    },
  },
  {
    id: "SOL-2024-0061",
    vigencia: 2024,
    unidadEjecutora: "3",
    titulo: "Adquisición de equipos de laboratorio de electrónica",
    apertura: "12/09/2024",
    cierre: "20/09/2024",
    dependencia: "Facultad de Ingeniería",
    tipoCotizacion: "BIEN",
    estado: "adjudicada",
    version: "v1.0",
    revision: 1,
    ultimaModificacion: "20/09/2024 16:30 COT",
  },
];

/**
 * Solicitudes sintéticas exclusivas de la bandeja del proveedor. Se mantienen
 * fuera de DATOS_MOCK para no alterar el listado del solicitante (S-01).
 */
const SOLICITUDES_PROVEEDOR_MOCK: readonly Solicitud[] = [
  {
    id: "SOL-2026-0142",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Adquisición de equipamiento de servidores y virtualización para el centro de cómputo",
    apertura: "01/10/2026",
    cierre: "30/10/2026",
    dependencia: "DIRTEI (Tecnología)",
    tipoCotizacion: "BIEN",
    estado: "enviada-proveedores",
  },
  {
    id: "SOL-2026-0139",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Renovación y licenciamiento de plataforma de gestión de laboratorios virtuales STEM",
    apertura: "24/10/2026",
    cierre: "02/11/2026",
    dependencia: "Recursos Educativos",
    tipoCotizacion: "SERVICIO",
    estado: "enviada-con-modificaciones",
  },
  {
    id: "SOL-2026-0135",
    vigencia: 2026,
    unidadEjecutora: "3",
    titulo:
      "Suministro de mobiliario ergonómico para aulas de posgrado Sede Macarena A",
    apertura: "24/10/2026",
    cierre: "08/11/2026",
    dependencia: "División de Planta Física",
    tipoCotizacion: "BIEN",
    estado: "enviada-proveedores",
  },
  {
    id: "SOL-2026-0128",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Mantenimiento preventivo y actualización de UPS de media potencia en sedes Bogotá",
    apertura: "25/10/2026",
    cierre: "12/11/2026",
    dependencia: "Vicerrectoría Académica",
    tipoCotizacion: "SERVICIO",
    estado: "enviada-proveedores",
  },
  {
    id: "SOL-2026-0115",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo:
      "Implementación de sistema de cableado estructurado e infraestructura de red pasiva",
    apertura: "01/10/2026",
    cierre: "20/10/2026",
    dependencia: "Red de Datos UD",
    tipoCotizacion: "BIEN_Y_SERVICIO",
    estado: "en-evaluacion",
  },
  {
    id: "SOL-2026-0098",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo:
      "Adquisición de kits de robótica y sensores IoT para semilleros de investigación",
    apertura: "01/10/2026",
    cierre: "05/12/2026",
    dependencia: "Centro de Investigaciones (CIDC)",
    tipoCotizacion: "BIEN",
    estado: "adjudicada",
  },
  {
    id: "SOL-2026-0084",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo:
      "Servicio integral de conectividad WAN e internet dedicado para campus universitarios",
    apertura: "01/09/2026",
    cierre: "20/09/2026",
    dependencia: "DIRTEI",
    tipoCotizacion: "SERVICIO",
    estado: "desierta",
  },
  {
    id: "SOL-2026-0072",
    vigencia: 2026,
    unidadEjecutora: "4",
    titulo:
      "Suministro de reactivos químicos y material de vidrio para laboratorio central",
    apertura: "01/10/2026",
    cierre: "15/10/2026",
    dependencia: "Facultad de Ciencias y Educación",
    tipoCotizacion: "BIEN",
    estado: "en-evaluacion",
  },
  {
    id: "SOL-2026-0064",
    vigencia: 2026,
    unidadEjecutora: "3",
    titulo: "Suministro de equipos y accesorios para salas de cómputo",
    apertura: "01/10/2026",
    cierre: "04/12/2026",
    dependencia: "Facultad de Ingeniería",
    tipoCotizacion: "BIEN",
    estado: "enviada-proveedores",
  },
];

const INVITACIONES_PROVEEDOR_MOCK: readonly InvitacionProveedor[] = [
  { id: "INV-0142", solicitudId: "SOL-2026-0142", estado: "borrador" },
  {
    id: "INV-0139",
    solicitudId: "SOL-2026-0139",
    estado: "pendiente-ajuste",
    fechaRadicacion: "2026-10-25T10:20:00-05:00",
  },
  {
    id: "INV-0135",
    solicitudId: "SOL-2026-0135",
    estado: "enviada",
    fechaRadicacion: "2026-10-25T14:35:00-05:00",
  },
  {
    id: "INV-0128",
    solicitudId: "SOL-2026-0128",
    estado: "enviada",
    fechaRadicacion: "2026-10-25T15:10:00-05:00",
  },
  {
    id: "INV-0115",
    solicitudId: "SOL-2026-0115",
    estado: "excluida",
    fechaRadicacion: "2026-10-15T08:30:00-05:00",
  },
  {
    id: "INV-0098",
    solicitudId: "SOL-2026-0098",
    estado: "aceptada",
    fechaRadicacion: "2026-10-18T09:00:00-05:00",
  },
  {
    id: "INV-0084",
    solicitudId: "SOL-2026-0084",
    estado: "rechazada",
    fechaRadicacion: "2026-09-10T11:00:00-05:00",
  },
  { id: "INV-0072", solicitudId: "SOL-2026-0072", estado: "vencida" },
  {
    id: "INV-0064",
    solicitudId: "SOL-2026-0064",
    estado: "declinada",
    fechaRadicacion: "2026-10-19T13:15:00-05:00",
  },
];

const ORDENADORES_PROVEEDOR_MOCK: Readonly<Record<string, string>> = {
  "SOL-2026-0142": "Dr. Ricardo Gómez Morales",
  "SOL-2026-0139": "Dr. Ricardo Gómez Morales",
  "SOL-2026-0135": "Ing. Martha Cecilia Bello",
  "SOL-2026-0128": "Dr. Carlos Julio González",
  "SOL-2026-0115": "Dr. Ricardo Gómez Morales",
  "SOL-2026-0098": "Dra. Elvia María Sanabria",
  "SOL-2026-0084": "Dr. Ricardo Gómez Morales",
  "SOL-2026-0072": "Lic. Fernando Triana",
  "SOL-2026-0064": "Ing. Martha Cecilia Bello",
};

const NOTAS_PROVEEDOR_MOCK: Readonly<Record<string, string>> = {
  "SOL-2026-0142": "ID Requisición: RQ-8841-UD · CDP 1402",
  "SOL-2026-0139": "Adenda publicada: ajuste en cantidad de usuarios",
  "SOL-2026-0135": "Lotes 1 y 2 · Especificaciones técnicas anexas",
  "SOL-2026-0128": "Cotización enviada",
  "SOL-2026-0115": "Plazo cerrado",
  "SOL-2026-0098": "Oferta seleccionada",
  "SOL-2026-0084": "Informe comparativo publicado",
  "SOL-2026-0072": "Motivo de rechazo por definir",
  "SOL-2026-0064": "Invitación declinada por el proveedor",
};

const MAPA_TIPOS: Readonly<Record<string, TipoCotizacion>> = {
  bienes: "BIEN",
  servicios: "SERVICIO",
  mixto: "BIEN_Y_SERVICIO",
};

/* ── Detalle de la solicitud (S-03, pestaña "General") ────────────────────── */

/** Textos largos con formato que el asistente guardó desde el editor. */
const OBJETIVO_MOCK =
  "<p>Suministro, puesta en marcha y soporte técnico de equipamiento para cómputo de alto rendimiento y clúster de virtualización institucional.</p>";

const CRITERIO_MOCK =
  "<p>Menor precio que cumpla la totalidad de especificaciones técnicas mínimas habilitantes.</p>";

const PLAN_ACCION_MOCK =
  "<p>Plan Estratégico Institucional de Transformación Digital 2024-2028: Modernización de la infraestructura central de procesamiento y almacenamiento para soportar sistemas académicos y administrativos de la Universidad Distrital Francisco José de Caldas.</p>";

/** Responsable por defecto (mockup aprobado de S-03). */
const RESPONSABLE_MOCK: ResponsableDetalle = {
  nombres: "Raúl Andrés",
  apellidos: "Quimbaya Puentes",
  identificacion: "C.C. 79.845.120 de Bogotá D.C.",
  unidadEjecutora: "1 - Rectoría (Sede Aduanilla de Paiba)",
  ordenadorGasto: "ORD-0042 - Dr. Ricardo Gómez Morales",
  ordenadorCargo: "(Vicerrector Administrativo)",
  dependenciaSolicitante:
    "División de Recursos Tecnológicos e Informáticos (DIRTEI)",
  dependenciaDestino: "Vicerrectoría Administrativa y Financiera",
};

/**
 * Borradores que ya tienen expediente técnico cargado.
 *
 * La solicitud de referencia de S-04 (`SOL-2026-0047`) es un borrador real: ya
 * tiene pliego, contratación, segmentación, anexos y CDP. Los demás borradores
 * de la semilla siguen vacíos para conservar el estado inicial del asistente.
 */
const BORRADORES_CON_EXPEDIENTE: readonly string[] = ["SOL-2026-0047"];

/**
 * true si la solicitud ya tiene expediente técnico.
 *
 * Los borradores sin expediente devuelven `null` en cada pestaña para que el
 * detalle muestre su estado vacío; los borradores de referencia se comportan
 * como una solicitud diligenciada.
 */
function tieneExpediente(solicitud: Solicitud): boolean {
  return (
    solicitud.estado !== "borrador" ||
    BORRADORES_CON_EXPEDIENTE.includes(solicitud.id)
  );
}

/**
 * Contenido de la pestaña "General" para una solicitud.
 *
 * Los hitos de apertura y cierre se toman de la fila del listado; cuando la
 * solicitud es un borrador (sin fechas) se muestra el texto de reserva.
 */
function generalDetalle(solicitud: Solicitud): GeneralDetalle {
  const caracteristicas: CaracteristicasDetalle = {
    apertura: {
      fecha: solicitud.apertura || "Sin programar",
      nota: solicitud.apertura
        ? "08:00 COT (Hora legal colombiana)"
        : "Pendiente de publicación del proceso",
    },
    cierre: {
      fecha: solicitud.cierre || "Sin programar",
      nota: solicitud.cierre
        ? "17:00 COT (Hora de cierre de plataforma)"
        : "Se calcula desde la fecha de apertura",
    },
    plazoEjecucion: "4 meses calendario",
    plazoNota: "A partir de suscripción del acta de inicio",
    objetivo: OBJETIVO_MOCK,
    requisitos:
      "Persona jurídica con certificación de fabricante categoría Gold o Platinum y mínimo 3 años de experiencia en entidades del Estado demostrable mediante actas de liquidación contractual.",
    criterioSeleccion: CRITERIO_MOCK,
    observaciones:
      "Las entregas físicas deberán realizarse en el Centro de Cómputo de la sede Aduanilla de Paiba con póliza de transporte amparada y previo agendamiento con la jefatura de la DIRTEI.",
  };

  const planAccion: PlanAccionDetalle = {
    codigo: "PAA-2026-META-14",
    descripcion: PLAN_ACCION_MOCK,
    eje: "Eje: Gobernanza Tecnológica y Conectividad",
    aprobacion: "Aprobación Consejo Superior: Acuerdo 012 de 2024",
  };

  return { responsable: RESPONSABLE_MOCK, caracteristicas, planAccion };
}

/**
 * Contadores de la barra de pestañas, derivados del modelo simulado.
 *
 * Los de "proveedores" y "documentos" no se usan como valor fijo: `comoDetalle`
 * los recalcula con el cruce y los anexos de cada solicitud para que coincidan
 * con la pestaña.
 */
const CONTADORES_MOCK: ContadoresPestanas = {
  items: 18,
  proveedores: 12,
  documentos: 5,
};

/** Cotizaciones recibidas por defecto (tarjeta métrica de la cabecera). */
const COTIZACIONES_RECIBIDAS_MOCK = 4;

/* ── Presupuesto SICAPITAL (pestaña "Presupuesto") ────────────────────────── */

/**
 * Número del certificado de disponibilidad presupuestal del expediente.
 *
 * Es la fuente única del número: lo usan la imputación, el saldo y la
 * bitácora de la pestaña "Historial".
 */
const NUMERO_CDP_MOCK = "CDP-2026-00412";

/** Valor del certificado de disponibilidad presupuestal, en pesos. */
const VALOR_CDP_MOCK = 184_500_000;

/** Imputaciones oficiales del CDP (mockup aprobado de la pestaña 2). */
const IMPUTACIONES_MOCK: readonly ImputacionPresupuestal[] = [
  {
    vigencia: "2026",
    solicitudNecesidad: "NEC-2026-00892",
    numeroCdp: NUMERO_CDP_MOCK,
    valor: VALOR_CDP_MOCK,
    dependencia: "Rectoría",
    dependenciaArea: "DIRTEI (Tecnología TIC)",
    rubro: "2.1.2.02.02.008",
    rubroNombre: "Equipamiento e Infraestructura Tecnológica TIC",
    estado: "Vigente / Reservado",
    tono: "exito",
  },
];

/** Firmas de aval presupuestal electrónico (mockup aprobado de la pestaña 2). */
const FIRMAS_MOCK: readonly FirmaAval[] = [
  {
    rol: "Ordenador del Gasto",
    nombre: "Dr. Ricardo Gómez Morales",
    cargo: "Vicerrector Administrativo y Financiero (Delegado)",
    icono: "assignment_turned_in",
    hash: "SHA-256: 8F2A...99C1",
    fechaRefrendacion: "28/02/2026 - 15:42:10 COT",
    aprobado: true,
  },
  {
    rol: "División de Recursos Financieros",
    nombre: "Dra. Martha Patricia Pulido",
    cargo: "Jefe Sección de Presupuesto - SICAPITAL UD",
    icono: "verified",
    hash: "SHA-256: 310B...E54A",
    fechaRefrendacion: "28/02/2026 - 16:15:32 COT",
    aprobado: true,
  },
];

/**
 * Presupuesto de una solicitud.
 *
 * Devuelve `null` cuando la solicitud todavía no tiene CDP (borrador): así la
 * pestaña muestra su estado vacío sin inventar cifras. En cualquier otro estado
 * se replica el certificado del mockup.
 */
function presupuestoDetalle(solicitud: Solicitud): PresupuestoDetalle | null {
  if (!tieneExpediente(solicitud)) {
    return null;
  }

  return {
    valorCdp: VALOR_CDP_MOCK,
    sincronizado: true,
    mensajeSincronizacion: "SICAPITAL: Sincronizado y Aprobado",
    descripcionCdp:
      "Monto reservado exclusivamente para la contratación de infraestructura de servidores Sede Aduanilla de Paiba.",
    saldo: {
      numeroCdp: NUMERO_CDP_MOCK,
      fechaExpedicion: "28 de Febrero de 2026",
      saldoDisponible: 210_000_000,
    },
    imputaciones: IMPUTACIONES_MOCK,
    firmas: FIRMAS_MOCK,
    textoNormativo: TEXTO_NORMATIVO_PRESUPUESTO,
  };
}

/* ── Ítems solicitados (pestaña "Ítems") ──────────────────────────────────── */

/**
 * Ítems del pliego para la solicitud de referencia (mockup de la pestaña 3).
 *
 * Reproduce las 18 filas del mockup con mezcla de bienes y servicios, códigos
 * UNSPSC, notas técnicas y etiquetas de especificaciones, de modo que se puedan
 * probar el filtro por tipo, la búsqueda y la paginación (5/10/20 filas).
 */
const ITEMS_MOCK: readonly ItemSolicitud[] = [
  {
    id: "1",
    tipo: "bien",
    nombre: "Servidor Blade de Cómputo Avanzado",
    descripcion:
      "Procesador dual 32 cores 2.8GHz, 256GB RAM DDR5 ECC, 2x 960GB NVMe SSD redundantes para centro de cómputo Paiba. Chasis compatible con rack estándar de 19 pulgadas y tarjetas mezzanina 25GbE dual port.",
    unidad: "Unidad",
    cantidad: 2,
    codigoUnspsc: "43211501",
    notaTecnica: "Garantía 36 meses NBD",
    iconoNota: "format_image_left",
    especificaciones: [
      "Dual Redundant PSU",
      "IPMI 2.0 / iDRAC9",
      "Hardware RAID 1",
    ],
  },
  {
    id: "2",
    tipo: "servicio",
    nombre: "Licenciamiento Enterprise Virtualización",
    descripcion:
      "Suscripción por 12 meses con soporte oficial 24x7 en sitio, cobertura para 64 zócalos físicos institucionales. Incluye consola unificada de gestión, HA, DRS, vMotion en caliente y parches de seguridad automatizados.",
    unidad: "Suscripción",
    cantidad: 1,
    codigoUnspsc: "43232800",
    notaTecnica: "SLA Crítico 2 horas",
    iconoNota: "support_agent",
    especificaciones: ["Soporte Nivel 3", "Actualizaciones Mayores"],
  },
  {
    id: "3",
    tipo: "bien",
    nombre: "Switch de Núcleo 48 Puertos 10GbE",
    descripcion:
      "Capa 3 gestionable, 48x SFP+ 10Gbps, 4x QSFP28 100Gbps uplinks, protocolo OSPF/BGP, fuentes y ventiladores hot-swap. Capacidad de conmutación mínima de 1.76 Tbps y latencia sub-microsegundo para topología spine-leaf.",
    unidad: "Unidad",
    cantidad: 4,
    codigoUnspsc: "43222612",
    notaTecnica: "Transceivers incluidos",
    iconoNota: "cable",
    especificaciones: ["10G/100G", "LACP Stacking", "Dual AC Redundante"],
  },
  {
    id: "4",
    tipo: "servicio",
    nombre: "Instalación y Cableado Estructurado Cat 6A",
    descripcion:
      "Certificación Categoría 6A en puntos de red para laboratorio Sala 304 y datacenter Paiba, tendido con canaleta perimetral de aluminio anodizado, patch panels blindados y rotulado ANSI/TIA-606-B institucional.",
    unidad: "Punto",
    cantidad: 48,
    codigoUnspsc: "72151601",
    notaTecnica: "Certificación Fluke Networks",
    iconoNota: "verified",
    especificaciones: ["Cat 6A F/UTP", "LSZH Cero Halógenos", "Norma RETIE"],
  },
  {
    id: "5",
    tipo: "bien",
    nombre: "UPS On-Line Trifásica 20 kVA",
    descripcion:
      "Topología doble conversión, banco de baterías VRLA externo para 30 minutos de autonomía a plena carga, tarjeta SNMP para monitoreo web centralizado, factor de potencia 1.0 y transformador de aislamiento galvánico.",
    unidad: "Unidad",
    cantidad: 1,
    codigoUnspsc: "39121011",
    notaTecnica: "Bypass Estático y Manual",
    iconoNota: "electric_bolt",
    especificaciones: ["Factor Potencia 1.0", "SNMP v3", "THDi < 3%"],
  },
  {
    id: "6",
    tipo: "bien",
    nombre: "Arreglo de Almacenamiento SAN 96 TB",
    descripcion:
      "Controladoras duales activas, caché 64GB por controladora, discos SAS 12Gbps, replicación remota asíncrona y conectividad FC 32Gbps para el clúster de virtualización institucional.",
    unidad: "Unidad",
    cantidad: 2,
    codigoUnspsc: "43201802",
    notaTecnica: "Garantía 60 meses en sitio",
    iconoNota: "storage",
    especificaciones: ["FC 32Gbps", "Replicación Remota"],
  },
  {
    id: "7",
    tipo: "bien",
    nombre: "Chasis Blade con 8 Bahías",
    descripcion:
      "Chasis de 6U con backplane pasivo, ventilación N+1 y gestión integrada de todas las hojas instaladas, compatible con las hojas de cómputo y almacenamiento del proyecto.",
    unidad: "Unidad",
    cantidad: 1,
    codigoUnspsc: "43211501",
    notaTecnica: "Compatible con hojas SAN",
    iconoNota: "dns",
    especificaciones: ["Backplane Pasivo", "Ventilación N+1"],
  },
  {
    id: "8",
    tipo: "bien",
    nombre: "Tarjetas Mezzanina 25GbE Dual Port",
    descripcion:
      "Interfaz de red 25Gbps por puerto con soporte para SR-IOV y offload de funciones de virtualización, instalable en las hojas de cómputo del chasis blade.",
    unidad: "Unidad",
    cantidad: 16,
    codigoUnspsc: "43201404",
    notaTecnica: "Soporte SR-IOV",
    iconoNota: "settings_ethernet",
    especificaciones: ["25GbE", "Offload Virtualización"],
  },
  {
    id: "9",
    tipo: "servicio",
    nombre: "Soporte Técnico Especializado 24x7",
    descripcion:
      "Atención de incidentes críticos en sitio con tiempos de respuesta de 4 horas y 24 horas para casos menores, durante 12 meses contados desde la puesta en marcha del centro de cómputo.",
    unidad: "Servicio",
    cantidad: 1,
    codigoUnspsc: "81111803",
    notaTecnica: "Respuesta 4 horas en sitio",
    iconoNota: "headset_mic",
    especificaciones: ["Cobertura 24x7", "Técnico certificado"],
  },
  {
    id: "10",
    tipo: "servicio",
    nombre: "Capacitación y Transferencia de Conocimiento",
    descripcion:
      "Programa de formación para el personal de la DIRTEI en administración del clúster, consola de virtualización y procedimientos de recuperación ante desastres, con material didáctico incluido.",
    unidad: "Servicio",
    cantidad: 1,
    codigoUnspsc: "86132000",
    notaTecnica: "Material incluido",
    iconoNota: "school",
    especificaciones: ["Modalidad presencial", "Certificado de asistencia"],
  },
  {
    id: "11",
    tipo: "bien",
    nombre: "Gabinetes Rack 42U 800x1000 mm",
    descripcion:
      "Gabinete de piso con puerta frontal perforada, gestión vertical de cableado, bandejas fijas y kit de ventilación para el alojamiento de servidores y equipos de red.",
    unidad: "Unidad",
    cantidad: 6,
    codigoUnspsc: "43222801",
    notaTecnica: "Garantía 24 meses",
    iconoNota: "inventory_2",
    especificaciones: ["42U", "Cierre con llave"],
  },
  {
    id: "12",
    tipo: "bien",
    nombre: "PDU Inteligente Monitoreada 32A",
    descripcion:
      "Unidad de distribución de energía con monitoreo por toma, medición de consumo y corte remoto, montaje horizontal en gabinete de 19 pulgadas.",
    unidad: "Unidad",
    cantidad: 12,
    codigoUnspsc: "39121002",
    notaTecnica: "Monitoreo por toma",
    iconoNota: "power",
    especificaciones: ["32A", "Corte Remoto"],
  },
  {
    id: "13",
    tipo: "servicio",
    nombre: "Interventoría Técnica del Proyecto",
    descripcion:
      "Supervisión técnica de la instalación, configuración y puesta en marcha del centro de cómputo, con informes de avance y actas de aceptación por hitos.",
    unidad: "Servicio",
    cantidad: 1,
    codigoUnspsc: "81112000",
    notaTecnica: "Informes por hito",
    iconoNota: "fact_check",
    especificaciones: ["Acta de aceptación", "Supervisión en sitio"],
  },
  {
    id: "14",
    tipo: "bien",
    nombre: "Patch Panel Blindado Cat 6A 24 Puertos",
    descripcion:
      "Panel de parcheo de 1U con puertos blindados y etiquetado institucional ANSI/TIA-606-B, para el cerramiento de los puntos de red certificados.",
    unidad: "Unidad",
    cantidad: 4,
    codigoUnspsc: "43223309",
    notaTecnica: "Etiquetado ANSI/TIA",
    iconoNota: "grid_on",
    especificaciones: ["Cat 6A", "1U"],
  },
  {
    id: "15",
    tipo: "bien",
    nombre: "Transceptores SFP+ 10Gbps",
    descripcion:
      "Módulos ópticos de 10Gbps compatibles con los switches de núcleo y de acceso del proyecto, con diagnóstico digital y certificación del fabricante.",
    unidad: "Unidad",
    cantidad: 64,
    codigoUnspsc: "43201553",
    notaTecnica: "Certificados de fábrica",
    iconoNota: "settings_input_antenna",
    especificaciones: ["10Gbps", "DDM"],
  },
  {
    id: "16",
    tipo: "servicio",
    nombre: "Migración de Servicios y Aplicaciones",
    descripcion:
      "Traslado planificado de las máquinas virtuales y servicios académicos y administrativos al nuevo clúster, con ventanas de mantenimiento y plan de reversa.",
    unidad: "Servicio",
    cantidad: 1,
    codigoUnspsc: "81112200",
    notaTecnica: "Incluye plan de reversa",
    iconoNota: "sync_alt",
    especificaciones: ["Ventanas nocturnas", "Plan de contingencias"],
  },
  {
    id: "17",
    tipo: "bien",
    nombre: "Monitoreo Ambiental del DataCenter",
    descripcion:
      "Sensores de temperatura, humedad y detección temprana de humo conectados a la plataforma central de monitoreo, con alertas por correo y SNMP.",
    unidad: "Kit",
    cantidad: 3,
    codigoUnspsc: "41111947",
    notaTecnica: "Alertas SNMP",
    iconoNota: "thermostat",
    especificaciones: ["Temperatura y humedad", "Detección de humo"],
  },
  {
    id: "18",
    tipo: "servicio",
    nombre: "Adecuación Eléctrica y Puesta a Tierra",
    descripcion:
      "Obras eléctricas para alimentación redundante, tablero de distribución y sistema de puesta a tierra con certificación RETIE, conforme a la norma vigente.",
    unidad: "Servicio",
    cantidad: 1,
    codigoUnspsc: "72151500",
    notaTecnica: "Certificación RETIE",
    iconoNota: "electrical_services",
    especificaciones: ["Circuito redundante", "Puesta a tierra"],
  },
];

/** Cabecera de la pestaña "Ítems" (mockup aprobado de la pestaña 3). */
const ITEMS_DETALLE_MOCK: ItemsDetalle = {
  unidadEjecutora: "División de Tecnologías de la Información (DITIC)",
  codigoDependencia: "CÓD. 02-304-DITIC",
  sede: "Sede Aduanilla de Paiba - Bloque B Sala DataCenter",
};

/**
 * Ítems de una solicitud.
 *
 * Los borradores sin expediente todavía no tienen pliego cargado, así que
 * devuelven una lista vacía y la pestaña muestra su estado vacío. El borrador
 * de referencia y el resto de estados replican el mockup.
 */
function itemsSolicitud(solicitud: Solicitud): readonly ItemSolicitud[] {
  return tieneExpediente(solicitud) ? ITEMS_MOCK : [];
}

/* ── Contratación y pago (pestaña "Contratación y pago") ──────────────────── */

/**
 * Hitos contractuales del estudio previo (mockup de la pestaña 4).
 *
 * Reproduce los tres hitos 40 % / 40 % / 20 % con sus requisitos verificables.
 * Los montos no se guardan aquí: la vista los deriva del valor total con
 * `montoHito`, para no duplicar la cifra que muestra el presupuesto.
 */
const PARAMETROS_MOCK: readonly ParametroPago[] = [
  {
    id: "1",
    condicion: "Parámetros del primer mes",
    porcentaje: 40,
    nota: "Entrega física, montaje en rack y pruebas de encendido de servidores en el datacenter institucional.",
    requisitos: [
      { icono: "inventory_2", etiqueta: "Entrega en sitio" },
      { icono: "power", etiqueta: "Pruebas energéticas OK" },
    ],
  },
  {
    id: "2",
    condicion: "Parámetros del segundo mes",
    porcentaje: 40,
    nota: "Configuración de virtualización, migración de máquinas virtuales y pruebas de carga y estrés en clúster.",
    requisitos: [
      { icono: "cloud_sync", etiqueta: "Migración completada" },
      { icono: "speed", etiqueta: "Stress Test Superado" },
    ],
  },
  {
    id: "3",
    condicion: "Culminar actividades finales",
    porcentaje: 20,
    nota: "Suscripción del acta de recibo a satisfacción final, capacitación técnica al equipo DIRTEI y entrega de pólizas de garantía de fábrica.",
    requisitos: [
      { icono: "assignment_turned_in", etiqueta: "Acta Final" },
      { icono: "school", etiqueta: "Transferencia de conocimiento" },
    ],
  },
];

/**
 * Contenido institucional fijo de la pestaña "Contratación y pago".
 *
 * Los campos que el solicitante puede cambiar (tipo de contrato, medio, forma
 * de pago y cronograma) se agregan al construir el detalle; el resto es texto
 * normativo que no se edita y que la edición (S-04) reutiliza tal cual.
 */
const CONTRATACION_BASE: Omit<
  ContratacionDetalle,
  "tipoContrato" | "medioPago" | "formaPago" | "parametros"
> = {
  tipoContratoNorma:
    "Ley 80 de 1993 / Estatuto General UD (Acuerdo 003 de 2015)",
  modalidadSeleccion:
    "Convocatoria Pública para Solicitud de Cotizaciones / Estudio de Mercado",
  modalidadNota:
    "Etapa precontractual conducente a consolidación de presupuesto oficial",
  plazoEjecucion: "4 meses calendario",
  plazoDias: "120 días continuos",
  plazoNota:
    "Inicia a partir del perfeccionamiento, acta de inicio y aprobación de garantías",
  lugarEjecucion: "Sede Aduanilla de Paiba - Sala de Servidores Datacenter",
  lugarDireccion:
    "Calle 13 N.° 31-75, Bloque de Infraestructura de TI, Bogotá D.C.",
  medioPagoNota:
    "A cuenta bancaria (Ahorros o Corriente) previamente validada, certificada e inscrita por el proveedor en el portal ÁGORA.",
  formaPagoNota:
    "Reembolsos supeditados a la suscripción del acta de recibo a satisfacción expedida por la supervisión designada.",
  reglamentacion: "Resolución 067 de 2017",
  reglamentacionNota:
    "Concordante con el Estatuto de Presupuesto de la Universidad Distrital Francisco José de Caldas y directrices PAC.",
  notaTributaria:
    "Cada desembolso estará sujeto a las retenciones tributarias nacionales y distritales vigentes (Retefuente, ReteICA y Estampillas Universidad Distrital 50 años y Pro-Cultura), liquidadas sobre el valor bruto facturado.",
  supervisor: {
    cargo:
      "Director de la DIRTEI (División de Recursos Tecnológicos e Informáticos)",
    parrafoHtml:
      "La verificación del cumplimiento de los hitos y la autorización de cada desembolso estará a cargo exclusivo del <strong>Director de la DIRTEI (División de Recursos Tecnológicos e Informáticos)</strong>.",
  },
  garantias: [
    {
      icono: "verified_user",
      titulo: "Póliza Única de Cumplimiento",
      descripcion:
        "Amparos de cumplimiento contractual (20%), calidad de bienes y servicios (20%) y salarios y prestaciones (5%) vigentes ante la aseguradora universitaria.",
    },
    {
      icono: "health_and_safety",
      titulo: "Aportes a Seguridad Social y Parafiscales (PILA)",
      descripcion:
        "Certificación mensual emitida por Revisor Fiscal o Representante Legal adjuntando planilla PILA cancelada de todo el personal asignado al proyecto.",
    },
  ],
};

/**
 * Contratación y pagos de una solicitud.
 *
 * Devuelve `null` cuando la solicitud todavía no tiene condiciones
 * contractuales definidas (borrador): así la pestaña muestra su estado vacío.
 * El tipo de contrato, el medio y la forma de pago guardan el `valor` del
 * catálogo del asistente (S-02); la vista resuelve su etiqueta con
 * `etiquetaCorta`.
 */
function contratacionDetalle(solicitud: Solicitud): ContratacionDetalle | null {
  if (!tieneExpediente(solicitud)) {
    return null;
  }

  return {
    ...CONTRATACION_BASE,
    tipoContrato: "suministro",
    medioPago: "transferencia_sebra",
    formaPago: "pagos_parciales",
    parametros: PARAMETROS_MOCK,
  };
}

/* ── Proveedores objetivo (pestaña "Proveedores objetivo") ─────────────────── */

/**
 * Códigos CIIU de una solicitud de bienes.
 *
 * Un suministro de equipamiento se segmenta por las dos actividades del banco
 * que lo cubren: comercio al por mayor de computadores y fabricación de
 * computadoras y equipo periférico. Los bienes no exigen idoneidad SNIES.
 */
const CODIGOS_BIENES: readonly string[] = ["4651", "2620"];

/**
 * Códigos CIIU de una solicitud de servicios.
 *
 * Son las tres actividades de TIC que el banco de proveedores acredita con
 * idoneidad técnica (NBC SISTEMAS).
 */
const CODIGOS_SERVICIOS: readonly string[] = ["6201", "6202", "6209"];

/** Solicitudes cuya segmentación de proveedores aún no se ha registrado. */
const SIN_SEGMENTACION: readonly string[] = ["SOL-2026-0008"];

/** Nota institucional sobre el requisito de idoneidad técnica (SNIES). */
const NOTA_IDONEIDAD =
  "Para la componente de servicios técnicos especializados y consultoría en virtualización, se requirió idoneidad amparada en el núcleo SNIES convalidado ante el Ministerio de Educación y el banco de proveedores UD.";

/** Referencia normativa del núcleo básico de conocimiento. */
const ACUERDO_SNIES = "Acuerdo CSU 002/2021";

/** Hash abreviado de la auditoría de notificación (simulado). */
const HASH_AUDITORIA = "SHA-256: 8F4C...3E1A";

/**
 * Cifras de la notificación a los proveedores objetivo.
 *
 * Son coherentes con el cruce de cada caso: 9/7/4 de 12 proveedores notificados
 * (segmentación de servicios) y 18/14/8 de 24 (segmentación de bienes).
 */
const NOTIFICACION_SERVICIOS = { vistos: 9, descargaron: 7, cotizaron: 4 };
const NOTIFICACION_BIENES = { vistos: 18, descargaron: 14, cotizaron: 8 };

/**
 * Actividades CIIU de una solicitud, tomadas del catálogo DANE.
 *
 * Las descripciones y clases NO se reescriben: salen del mismo catálogo que
 * usa el buscador del paso 5 (S-02), de modo que el detalle y el asistente
 * muestran exactamente el mismo texto.
 */
function actividadesDesde(
  codigos: readonly string[],
): readonly ActividadVinculada[] {
  return codigos
    .map((codigo) => ACTIVIDADES_CIIU.find((a) => a.codigo === codigo))
    .filter((actividad): actividad is ActividadCiiu => !!actividad)
    .map((actividad) => ({ ...actividad, id: actividad.codigo }));
}

/**
 * Segmentación de proveedores objetivo según la naturaleza de la solicitud.
 *
 * Reproduce la regla de negocio: los bienes se segmentan solo por actividad
 * económica (CIIU) y los servicios exigen además idoneidad técnica (SNIES).
 * La solicitud mixta acumula ambos conjuntos de códigos.
 */
function segmentacionProveedores(
  tipo: TipoNecesidadSolicitud,
  conIdoneidad: boolean,
): SegmentacionProveedores {
  const codigos =
    tipo === "mixta"
      ? [...CODIGOS_BIENES, ...CODIGOS_SERVICIOS]
      : conIdoneidad
        ? CODIGOS_SERVICIOS
        : CODIGOS_BIENES;

  return {
    actividades: actividadesDesde(codigos),
    areaSnies: conIdoneidad ? "ING" : "",
    nucleoSnies: conIdoneidad ? "SISTEMAS" : "",
  };
}

/**
 * Proveedores objetivo de una solicitud.
 *
 * Devuelve `null` cuando la solicitud todavía no tiene segmentación
 * registrada (borrador o expediente sin cruce registral): así la pestaña
 * muestra su estado vacío sin inventar cifras.
 */
function proveedoresDetalle(
  solicitud: Solicitud,
): ProveedoresObjetivoDetalle | null {
  if (!tieneExpediente(solicitud) || SIN_SEGMENTACION.includes(solicitud.id)) {
    return null;
  }

  const tipo = tipoNecesidad(solicitud.tipoCotizacion);
  const conIdoneidad = exigeSnies(tipo);

  return {
    segmentacion: segmentacionProveedores(tipo, conIdoneidad),
    requiereIdoneidad: conIdoneidad,
    notaIdoneidad: NOTA_IDONEIDAD,
    acuerdo: ACUERDO_SNIES,
    notificacion: {
      enviada: solicitud.apertura
        ? `${solicitud.apertura} 08:00 COT`
        : "Pendiente de envío",
      ...(conIdoneidad ? NOTIFICACION_SERVICIOS : NOTIFICACION_BIENES),
      hash: HASH_AUDITORIA,
    },
  };
}

/**
 * Número de proveedores objetivo de una segmentación.
 *
 * Se cruza el banco simulado con los CIIU y el NBC de la segmentación, igual
 * que el paso 5 del asistente; de ahí sale también el contador de la barra de
 * pestañas, para que badge y contenido nunca se contradigan.
 */
function contarProveedores(detalle: ProveedoresObjetivoDetalle): number {
  const codigos = detalle.segmentacion.actividades.map(
    (actividad) => actividad.codigo,
  );
  return buscarProveedores(
    codigos,
    detalle.segmentacion.nucleoSnies,
    detalle.requiereIdoneidad,
  ).length;
}

/* ── Documentos (pestaña "Documentos") ─────────────────────────────────────── */

/**
 * Nota institucional del banner normativo de la pestaña "Documentos".
 *
 * Reproduce el texto del mockup: los documentos habilitantes son obligatorios
 * y los complementarios se aportan durante la subsanación.
 */
const NOTA_NORMATIVA_DOCUMENTOS =
  "La Unidad de Contratación se encuentra en proceso de validación previa según la Resolución de Rectoría 2026. Los oferentes registrados deben remitir obligatoriamente los documentos marcados como habilitantes. Los complementarios podrán aportarse durante la subsanación.";

/** Estado de la matriz documental (la institución aún no la define). */
const ESTADO_MATRIZ_DOCUMENTOS =
  "Por definir: Matriz de documentos obligatorios y complementarios";

/** Fecha de la última modificación del expediente documental. */
const ULTIMA_MODIFICACION_DOCUMENTOS = "02 Mar 2026 10:22 COT";

/** Versión del sistema que generó el expediente documental. */
const VERSION_SISTEMA_DOCUMENTOS = "ÁGORA v3.4.1";

/** Aviso de que el gestor documental institucional todavía no está conectado. */
const MENSAJE_GESTOR_DOCUMENTAL =
  "El gestor documental institucional (Alfresco UD) aún no está conectado: la operación se simuló con los metadatos del archivo.";

/** Solicitudes sin expediente documental (borradores y expediente sin apertura). */
const SIN_DOCUMENTOS: readonly string[] = ["SOL-2026-0008"];

/** Autor de la carga en los expedientes de la Vicerrectoría Académica. */
const AUTOR_VICERRECTORIA = "cjgonzalezp";

/** Autor de la carga en los expedientes de la División de TI. */
const AUTOR_TI = "mrodriguezs";

/** Autor de la carga en los expedientes de la Facultad de Ingeniería. */
const AUTOR_INGENIERIA = "lperdomo";

/**
 * Construye un anexo oficial ya cargado (estado "cargado").
 *
 * El icono se deriva del formato con la misma función del paso 6, de modo que
 * el detalle y el asistente coinciden en la iconografía.
 */
function anexoCargado(
  id: string,
  nombre: string,
  descripcion: string,
  pesoBytes: number,
  subidoEl: string,
  autor: string,
): AnexoSolicitud {
  return {
    id,
    nombre,
    descripcion,
    pesoBytes,
    icono: iconoPorFormato(nombre),
    estado: "cargado",
    progreso: 100,
    subidoEl,
    autor,
  };
}

/**
 * Anexos oficiales cargados por cada solicitud (semilla del detalle).
 *
 * Cada solicitud tiene sus propios soportes, con formatos distintos: así se
 * revisa la columna "Tipo" con más de una variante. Las solicitudes que no
 * aparecen aquí todavía no tienen anexos cargados.
 */
const ANEXOS_POR_SOLICITUD: Readonly<
  Record<string, readonly AnexoSolicitud[]>
> = {
  "SOL-2026-0047": [
    anexoCargado(
      "anexo-0047-estudio-previo",
      "Estudio_Previo_Estaciones_Trabajo_2026.pdf",
      "Estudio de conveniencia y necesidad del laboratorio de análisis de datos",
      2.1 * 1024 * 1024,
      "Subido el 18 Feb 2026, 11:12 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0047-especificaciones",
      "Especificaciones_Tecnicas_Estaciones_Trabajo.docx",
      "Requerimientos mínimos de CPU, memoria, almacenamiento y garantía",
      760 * 1024,
      "Subido el 18 Feb 2026, 11:20 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0047-matriz-items",
      "Matriz_Items_Estaciones_Trabajo.xlsx",
      "Matriz tabulada con los 18 ítems del pliego para cotización",
      164 * 1024,
      "Subido el 18 Feb 2026, 11:28 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0047-cdp",
      "CDP_Presupuestal_Firmado_2026.pdf",
      "Certificado de Disponibilidad Presupuestal ref. 2026-00412",
      1.8 * 1024 * 1024,
      "Subido el 18 Feb 2026, 11:35 AM",
      AUTOR_VICERRECTORIA,
    ),
  ],
  "SOL-2026-0042": [
    anexoCargado(
      "anexo-0042-estudios-previos",
      "Estudios_Previos_Infraestructura_2026.pdf",
      "Estudio de conveniencia técnica y necesidad institucional",
      2.4 * 1024 * 1024,
      "Subido el 02 Mar 2026, 10:15 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0042-anexo-tecnico",
      "Anexo_Tecnico_Especificaciones_Servidores.docx",
      "Requerimientos mínimos de CPU, RAM, redundancia y SAN",
      840 * 1024,
      "Subido el 02 Mar 2026, 10:18 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0042-cdp-presupuestal",
      "CDP_Presupuestal_Firmado_2026.pdf",
      "Certificado de Disponibilidad Presupuestal ref. 2026-04192",
      1.8 * 1024 * 1024,
      "Subido el 02 Mar 2026, 10:20 AM",
      AUTOR_VICERRECTORIA,
    ),
    anexoCargado(
      "anexo-0042-ficha-tecnica-items",
      "Ficha_Tecnica_Items_Consolidada.xlsx",
      "Matriz tabulada con 12 ítems discriminados para cotización",
      148 * 1024,
      "Subido el 02 Mar 2026, 10:22 AM",
      AUTOR_VICERRECTORIA,
    ),
  ],
  "SOL-2026-0039": [
    anexoCargado(
      "anexo-0039-informe-diagnostico",
      "Informe_Diagnostico_Servidores_Centrales.pdf",
      "Informe de diagnóstico de la infraestructura de servidores centrales",
      3.1 * 1024 * 1024,
      "Subido el 11 Feb 2026, 09:05 AM",
      AUTOR_TI,
    ),
    anexoCargado(
      "anexo-0039-certificaciones-tecnicas",
      "Certificaciones_Tecnicas_Equipos_Ofertados.xlsx",
      "Certificaciones técnicas de los equipos ofertados",
      612 * 1024,
      "Subido el 11 Feb 2026, 09:12 AM",
      AUTOR_TI,
    ),
    anexoCargado(
      "anexo-0039-metodologia-mantenimiento",
      "Metodologia_Mantenimiento_Preventivo_Correctivo.doc",
      "Metodología de los servicios de mantenimiento preventivo y correctivo",
      320 * 1024,
      "Subido el 11 Feb 2026, 09:20 AM",
      AUTOR_TI,
    ),
  ],
  "SOL-2026-0044": [
    anexoCargado(
      "anexo-0044-especificaciones-insumos",
      "Especificaciones_Insumos_Laboratorio_Quimica.pdf",
      "Especificaciones técnicas de los insumos de laboratorio",
      1.2 * 1024 * 1024,
      "Subido el 02 Feb 2026, 08:40 AM",
      AUTOR_INGENIERIA,
    ),
    anexoCargado(
      "anexo-0044-comparativo-precios",
      "Comparativo_Precios_Insumos_Cotizados.xlsx",
      "Comparativo de precios de los insumos cotizados",
      96 * 1024,
      "Subido el 02 Feb 2026, 08:47 AM",
      AUTOR_INGENIERIA,
    ),
  ],
  "SOL-2026-0015": [
    anexoCargado(
      "anexo-0015-plan-impresion",
      "Plan_Impresion_Catalogo_Universitario.docx",
      "Plan de impresión del catálogo universitario 2026",
      720 * 1024,
      "Subido el 09 Jan 2026, 15:10 AM",
      AUTOR_VICERRECTORIA,
    ),
  ],
};

/**
 * Contenido documental de una solicitud.
 *
 * Devuelve `null` cuando la solicitud todavía no tiene expediente documental
 * (borrador o expediente sin apertura): así la pestaña muestra su estado
 * vacío sin inventar soportes.
 *
 * Solo se listan los anexos ya cargados: los estados "subiendo" y "error"
 * pertenecen al flujo de carga del asistente, no a un expediente archivado.
 */
function documentosDetalle(solicitud: Solicitud): DocumentosDetalle | null {
  if (!tieneExpediente(solicitud) || SIN_DOCUMENTOS.includes(solicitud.id)) {
    return null;
  }

  const anexos = (ANEXOS_POR_SOLICITUD[solicitud.id] ?? []).filter(
    (anexo) => anexo.estado === "cargado",
  );

  return {
    anexos,
    requeridos: DOCUMENTOS_OFERENTE_SEMILLA,
    notaNormativa: NOTA_NORMATIVA_DOCUMENTOS,
    estadoMatriz: ESTADO_MATRIZ_DOCUMENTOS,
    ultimaModificacion: ULTIMA_MODIFICACION_DOCUMENTOS,
    versionSistema: VERSION_SISTEMA_DOCUMENTOS,
  };
}

/* ── Historial (pestaña "Historial") ───────────────────────────────────────── */

/**
 * Nota institucional del banner de la bitácora.
 *
 * Reproduce el texto del mockup: la bitácora está sujeta a confidencialidad y
 * a visualización diferencial según privilegios de usuario.
 */
const NOTA_CONFIDENCIALIDAD_HISTORIAL =
  "Esta bitácora se encuentra sujeta a los protocolos de confidencialidad institucional y visualización diferencial según privilegios de usuario.";

/** Encabezado del banner: qué falta por definir (RF-016, RF-017). */
const TITULO_MATRIZ_HISTORIAL =
  "Por definir: Eventos que se registran y su visibilidad por rol (RF-016, RF-017)";

/** Etiqueta de la matriz normativa que acompaña al banner. */
const MATRIZ_NORMATIVA_HISTORIAL = "Matriz RF-016 / RF-017";

/** Sello de tiempo certificado que respalda la bitácora. */
const SELLO_TIEMPO_HISTORIAL = "Sello de Tiempo Certificado NTP UD";

/** Nota de integridad del pie de la bitácora. */
const NOTA_INTEGRIDAD_HISTORIAL =
  "Integridad de bitácora garantizada mediante Ledger Institucional";

/** Solicitudes sin bitácora (expediente sin apertura). */
const SIN_HISTORIAL: readonly string[] = ["SOL-2026-0008"];

/** Meses en español para formatear la fecha de los eventos. */
const MESES_HISTORIAL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Desfase de Colombia (COT) frente a UTC: no aplica horario de verano. */
const DESFASE_COT = "-05:00";

/** Datos del evento antes de formatearlos para pantalla. */
interface EventoHistorialSemilla {
  readonly id: string;
  /** Fecha en formato dd/MM/yyyy ("15/02/2026"). */
  readonly fecha: string;
  /** Hora en formato 24 h ("09:20"). */
  readonly hora: string;
  readonly tipo: TipoEventoHistorial;
  readonly titulo: string;
  readonly detalle?: string;
  readonly usuario: string;
  readonly nombreUsuario?: string;
  readonly rol: string;
  readonly estadoAnterior: EstadoSolicitud;
  readonly estadoNuevo: EstadoSolicitud;
  readonly icono: string;
  readonly tono: TonoNodoHistorial;
  readonly resultado?: string;
  readonly tonoResultado?: "neutro" | "exito" | "advertencia" | "primario";
  readonly sello?: string;
  readonly evidencia?: EvidenciaHistorial;
}

/** Fecha y hora legibles ("15 de Febrero de 2026 - 09:20 COT"). */
function fechaLegibleHistorial(fecha: string, hora: string): string {
  const [dia, mes, anio] = fecha.split("/").map(Number);
  if (!dia || !mes || !anio) {
    return `${fecha} - ${hora} COT`;
  }
  return `${dia} de ${MESES_HISTORIAL[mes - 1]} de ${anio} - ${hora} COT`;
}

/** Fecha y hora en ISO-8601 con desfase de Colombia. */
function fechaIsoHistorial(fecha: string, hora: string): string {
  const [dia, mes, anio] = fecha.split("/").map(Number);
  if (!dia || !mes || !anio) {
    return "";
  }
  const iso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return `${iso}T${hora}:00${DESFASE_COT}`;
}

/** Construye un evento de la bitácora con la fecha ya formateada. */
function eventoHistorial(semilla: EventoHistorialSemilla): EventoHistorial {
  return {
    id: semilla.id,
    tipo: semilla.tipo,
    titulo: semilla.titulo,
    fecha: fechaLegibleHistorial(semilla.fecha, semilla.hora),
    fechaIso: fechaIsoHistorial(semilla.fecha, semilla.hora),
    detalle: semilla.detalle,
    usuario: semilla.usuario,
    nombreUsuario: semilla.nombreUsuario,
    rol: semilla.rol,
    estadoAnterior: semilla.estadoAnterior,
    estadoNuevo: semilla.estadoNuevo,
    icono: semilla.icono,
    tono: semilla.tono,
    resultado: semilla.resultado,
    tonoResultado: semilla.tonoResultado,
    sello: semilla.sello,
    evidencia: semilla.evidencia,
  };
}

/** Evento de creación del expediente. */
function eventoCreacion(
  id: string,
  fecha: string,
  hora: string,
  usuario: string,
  nombreUsuario: string,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "creacion",
    titulo: "Solicitud creada en borrador",
    detalle:
      "Registro preliminar de necesidad técnica y estructuración del pliego preliminar en ÁGORA.",
    usuario,
    nombreUsuario,
    rol: "Solicitante",
    estadoAnterior: "borrador",
    estadoNuevo: "borrador",
    icono: "drafts",
    tono: "neutro",
    evidencia: {
      icono: "source",
      texto: "Origen: Módulo de Necesidades DIRTEI v3.4",
    },
  });
}

/** Evento de vinculación del certificado de disponibilidad presupuestal. */
function eventoCdp(id: string, fecha: string, hora: string): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "estado",
    titulo: "Aprobación y vinculación de CDP presupuestal",
    detalle: `Certificado <strong>${NUMERO_CDP_MOCK}</strong> vinculado por valor de <strong>${formatoCop(VALOR_CDP_MOCK)} COP</strong> con firma digital PKI validada.`,
    usuario: "mpulido",
    nombreUsuario: "Dra. Martha Patricia Pulido",
    rol: "Jefe Sección de Presupuesto - SICAPITAL",
    estadoAnterior: "borrador",
    estadoNuevo: "enviada-proveedores",
    icono: "account_balance_wallet",
    tono: "primario",
    resultado: "Aprobación presupuestal",
    tonoResultado: "exito",
    sello: "SICAPITAL OK",
    evidencia: {
      icono: "key",
      texto: "Hash PKI: e7c2..49a1 (Validación CA Institucional)",
    },
  });
}

/** Evento de radicación formal y despacho de invitaciones. */
function eventoRadicacion(
  id: string,
  fecha: string,
  hora: string,
  radicado: string,
  totalProveedores: number,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "notificacion",
    titulo: "Solicitud procesada y radicada formalmente",
    detalle: `Radicado oficial generado: <strong>${radicado}</strong>. Despacho automático de invitaciones por correo electrónico institucional a ${totalProveedores} empresas habilitadas.`,
    usuario: "raquimbayap",
    nombreUsuario: "Raúl Quimbaya",
    rol: "Solicitante",
    estadoAnterior: "enviada-proveedores",
    estadoNuevo: "enviada-proveedores",
    icono: "send",
    tono: "destacado",
    resultado: "Despacho Conforme",
    tonoResultado: "exito",
    evidencia: {
      icono: "mail",
      texto: `Servidor SMTP Institucional UD: ${totalProveedores} Entregas Exitosas`,
    },
  });
}

/** Evento de publicación del proceso en el portal institucional. */
function eventoPublicacion(
  id: string,
  fecha: string,
  hora: string,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "estado",
    titulo: "Publicación del proceso en el portal institucional",
    usuario: "sistema",
    nombreUsuario: "Sistema ÁGORA",
    rol: "Automatización institucional",
    estadoAnterior: "enviada-proveedores",
    estadoNuevo: "enviada-proveedores",
    icono: "campaign",
    tono: "primario",
    evidencia: {
      icono: "public",
      texto: "Portal de Contratación UD: Proceso publicado",
    },
  });
}

/** Evento de solicitud de modificación del pliego. */
function eventoModificacion(
  id: string,
  fecha: string,
  hora: string,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "modificacion",
    titulo: "Modificación solicitada: ampliación de fecha de cierre",
    detalle:
      "Se solicitó prórroga de 2 días hábiles en el plazo de recepción de ofertas para permitir mayor concurrencia de proponentes mayoristas.",
    usuario: "raquimbayap",
    nombreUsuario: "Raúl Quimbaya",
    rol: "Solicitante / Contratista Registrado",
    estadoAnterior: "enviada-proveedores",
    estadoNuevo: "enviada-con-modificaciones",
    icono: "edit_calendar",
    tono: "destacado",
    resultado: "En revisión por Ordenador del Gasto",
    tonoResultado: "advertencia",
    evidencia: {
      icono: "fingerprint",
      texto: "ID Transacción: TXN-894102-DIRTEI",
    },
  });
}

/** Evento de apertura de la evaluación técnica y económica. */
function eventoEvaluacion(
  id: string,
  fecha: string,
  hora: string,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "estado",
    titulo: "Evaluación técnica de las propuestas recibidas",
    detalle: `Se abrió el cuadro comparativo de las <strong>${COTIZACIONES_RECIBIDAS_MOCK} cotizaciones</strong> recibidas para evaluación técnica y económica.`,
    usuario: "rgomez",
    nombreUsuario: "Dr. Ricardo Gómez Morales",
    rol: "Vicerrector Administrativo (Ordenador del Gasto)",
    estadoAnterior: "enviada-proveedores",
    estadoNuevo: "en-evaluacion",
    icono: "rate_review",
    tono: "primario",
    resultado: "Comparador de ofertas activo",
    tonoResultado: "primario",
    evidencia: {
      icono: "assessment",
      texto: `Cotizaciones evaluadas: ${COTIZACIONES_RECIBIDAS_MOCK}`,
    },
  });
}

/** Evento de cierre del proceso. */
function eventoCierre(
  id: string,
  fecha: string,
  hora: string,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "estado",
    titulo: "Cierre del proceso y publicación del Acta de Adjudicación",
    detalle:
      "El proceso quedó cerrado en ÁGORA con la publicación del acta de adjudicación y la carpeta de soporte archivada.",
    usuario: "sistema",
    nombreUsuario: "Sistema ÁGORA",
    rol: "Automatización institucional",
    estadoAnterior: "en-evaluacion",
    estadoNuevo: "adjudicada",
    icono: "lock",
    tono: "neutro",
    resultado: "Expediente archivado",
    tonoResultado: "neutro",
    evidencia: {
      icono: "inventory_2",
      texto: "Carpeta de soporte: 6 documentos",
    },
  });
}

/** Evento de cancelación; la justificación queda en la bitácora interna. */
function eventoCancelacion(solicitud: Solicitud): EventoHistorial | null {
  const cancelacion = solicitud.cancelacion;
  if (!cancelacion) {
    return null;
  }
  const [fecha, hora = "00:00"] = cancelacion.fecha.split(" ");

  return eventoHistorial({
    id: `evento-${solicitud.id}-cancelacion`,
    fecha,
    hora: hora.slice(0, 5),
    tipo: "estado",
    titulo: "Solicitud cancelada",
    detalle: `Justificación interna: ${cancelacion.justificacion}`,
    usuario: cancelacion.usuario,
    nombreUsuario: cancelacion.autor,
    rol: cancelacion.rol,
    estadoAnterior: cancelacion.estadoAnterior,
    estadoNuevo: "cancelada",
    icono: "cancel",
    tono: "destacado",
    resultado: "Cancelación registrada",
    tonoResultado: "advertencia",
    evidencia: {
      icono: "groups",
      texto: `${cancelacion.destinatariosNotificados} destinatarios de notificación (envío simulado)`,
    },
  });
}

/**
 * Bitácoras específicas por solicitud (semilla del detalle).
 *
 * `SOL-2026-0039` tiene el historial más extenso (seis eventos, con y sin
 * observación) y `SOL-2026-0042` reproduce los cuatro eventos del mockup. Las
 * demás solicitudes reciben el historial canónico de su estado.
 *
 * Cada semilla es una función porque el número de proveedores notificados
 * (que aparece en la radicación) depende de la solicitud y lo calcula la
 * pestaña "Proveedores objetivo".
 */
const HISTORIAL_POR_SOLICITUD: Readonly<
  Record<string, (totalProveedores: number) => readonly EventoHistorial[]>
> = {
  "SOL-2026-0039": (totalProveedores) => [
    eventoCreacion(
      "evento-0039-creacion",
      "11/02/2026",
      "09:20",
      "raquimbayap",
      "Raúl Quimbaya",
    ),
    eventoCdp("evento-0039-cdp", "12/02/2026", "16:15"),
    eventoRadicacion(
      "evento-0039-radicacion",
      "13/02/2026",
      "10:45",
      "SOL-2026-0039",
      totalProveedores,
    ),
    eventoPublicacion("evento-0039-publicacion", "17/02/2026", "08:05"),
    eventoModificacion("evento-0039-modificacion", "24/02/2026", "11:30"),
    eventoEvaluacion("evento-0039-evaluacion", "25/02/2026", "09:15"),
  ],
  "SOL-2026-0042": (totalProveedores) => [
    eventoCreacion(
      "evento-0042-creacion",
      "15/02/2026",
      "09:20",
      "raquimbayap",
      "Raúl Quimbaya",
    ),
    eventoCdp("evento-0042-cdp", "28/02/2026", "16:15"),
    eventoRadicacion(
      "evento-0042-radicacion",
      "02/03/2026",
      "10:45",
      "SOL-2026-0042",
      totalProveedores,
    ),
    eventoModificacion("evento-0042-modificacion", "02/03/2026", "11:30"),
  ],
  "SOL-2026-0028": () => [
    eventoCreacion(
      "evento-0028-creacion",
      "29/01/2026",
      "09:20",
      "raquimbayap",
      "Raúl Quimbaya",
    ),
    eventoCdp("evento-0028-cdp", "02/02/2026", "16:15"),
  ],
};

/** Suma días a una fecha dd/MM/yyyy ("15/02/2026" + 2 = "17/02/2026"). */
function sumarDiasHistorial(fecha: string, dias: number): string {
  const [dia, mes, anio] = fecha.split("/").map(Number);
  const base = new Date(Date.UTC(anio, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  const diaFinal = String(base.getUTCDate()).padStart(2, "0");
  const mesFinal = String(base.getUTCMonth() + 1).padStart(2, "0");
  return `${diaFinal}/${mesFinal}/${base.getUTCFullYear()}`;
}

/**
 * Bitácora canónica según el estado de la solicitud.
 *
 * Reproduce las transiciones naturales del trámite y termina siempre en el
 * estado actual de la solicitud, de modo que la bitácora sea coherente con el
 * encabezado del detalle.
 */
function historialPorDefecto(
  solicitud: Solicitud,
  totalProveedores: number,
): readonly EventoHistorial[] {
  if (solicitud.estado === "cancelada") {
    const evento = eventoCancelacion(solicitud);
    const estadoAnterior =
      solicitud.cancelacion?.estadoAnterior ?? "enviada-proveedores";
    const eventosPrevios = historialPorDefecto(
      { ...solicitud, estado: estadoAnterior },
      totalProveedores,
    );
    return evento ? [evento, ...eventosPrevios] : eventosPrevios;
  }

  const apertura = solicitud.apertura ?? "15/02/2026";
  const [dia, mes] = apertura.split("/");
  const anio = "2026";
  const fechaCreacion = `${dia}/${mes}/${anio}`;

  const eventos: EventoHistorial[] = [
    eventoCreacion(
      `evento-${solicitud.id}-creacion`,
      fechaCreacion,
      "09:20",
      "raquimbayap",
      "Raúl Quimbaya",
    ),
  ];

  if (solicitud.estado === "borrador") {
    return eventos;
  }

  eventos.push(
    eventoCdp(
      `evento-${solicitud.id}-cdp`,
      sumarDiasHistorial(fechaCreacion, 1),
      "16:15",
    ),
  );

  if (solicitud.estado === "enviada-proveedores") {
    return eventos;
  }

  eventos.push(
    eventoRadicacion(
      `evento-${solicitud.id}-radicacion`,
      sumarDiasHistorial(fechaCreacion, 2),
      "10:45",
      solicitud.id,
      totalProveedores,
    ),
  );

  if (solicitud.estado === "en-aprobacion") {
    eventos.push(
      eventoModificacion(
        `evento-${solicitud.id}-modificacion-pendiente`,
        sumarDiasHistorial(fechaCreacion, 3),
        "11:30",
      ),
    );
    return eventos;
  }

  if (solicitud.estado === "enviada-con-modificaciones") {
    eventos.push(
      eventoModificacion(
        `evento-${solicitud.id}-modificacion`,
        sumarDiasHistorial(fechaCreacion, 3),
        "11:30",
      ),
    );
    return eventos;
  }

  if (solicitud.estado === "en-evaluacion") {
    eventos.push(
      eventoEvaluacion(
        `evento-${solicitud.id}-evaluacion`,
        sumarDiasHistorial(fechaCreacion, 5),
        "09:15",
      ),
    );
    return eventos;
  }

  eventos.push(
    eventoCierre(
      `evento-${solicitud.id}-cierre`,
      sumarDiasHistorial(fechaCreacion, 7),
      "17:45",
    ),
  );
  return eventos;
}

/**
 * Evento de bitácora de una edición guardada sobre un borrador (S-04).
 *
 * El expediente de un borrador aún no tiene bitácora; este evento de sesión
 * permite que la pestaña "Historial" refleje la nueva versión sin inventar un
 * flujo de aprobación que todavía no existe.
 */
function eventoEdicionBorrador(
  id: string,
  fecha: string,
  hora: string,
  version: string,
  cambios: number,
): EventoHistorial {
  return eventoHistorial({
    id,
    fecha,
    hora,
    tipo: "modificacion",
    titulo: "Borrador actualizado desde la edición",
    detalle: `Se guardaron <strong>${cambios}</strong> ${
      cambios === 1 ? "cambio" : "cambios"
    } en el borrador y se generó la versión <strong>${version}</strong>.`,
    usuario: "raquimbayap",
    nombreUsuario: "Raúl Quimbaya",
    rol: "Solicitante / Contratista Registrado",
    estadoAnterior: "borrador",
    estadoNuevo: "borrador",
    icono: "edit_note",
    tono: "neutro",
    resultado: "Versión guardada",
    tonoResultado: "exito",
    evidencia: {
      icono: "fingerprint",
      texto: `ID Transacción: TXN-EDICION-${id}`,
    },
  });
}

/**
 * Bitácora de la solicitud.
 *
 * Devuelve `null` cuando la solicitud todavía no tiene expediente (borrador sin
 * ediciones o expediente sin apertura): así la pestaña muestra su estado vacío
 * sin inventar eventos. Los eventos se devuelven del más reciente al más
 * antiguo.
 */
function historialDetalle(
  solicitud: Solicitud,
  extras: readonly EventoHistorial[] = [],
): HistorialDetalle | null {
  if (SIN_HISTORIAL.includes(solicitud.id)) {
    return null;
  }
  if (solicitud.estado === "borrador" && extras.length === 0) {
    return null;
  }

  // El número de proveedores notificados lo calcula la pestaña "Proveedores
  // objetivo": la bitácora lo usa para no contradecirla.
  const proveedores = proveedoresDetalle(solicitud);
  const totalProveedores = proveedores ? contarProveedores(proveedores) : 0;

  const semilla = HISTORIAL_POR_SOLICITUD[solicitud.id];
  const base = semilla
    ? semilla(totalProveedores)
    : historialPorDefecto(solicitud, totalProveedores);
  const eventos = [
    ...new Map(
      [...base, ...extras].map((evento) => [evento.id, evento]),
    ).values(),
  ].sort((a, b) => Date.parse(b.fechaIso) - Date.parse(a.fechaIso));

  return {
    eventos,
    notaConfidencialidad: NOTA_CONFIDENCIALIDAD_HISTORIAL,
    matrizNormativa: MATRIZ_NORMATIVA_HISTORIAL,
    selloTiempo: SELLO_TIEMPO_HISTORIAL,
    notaIntegridad: NOTA_INTEGRIDAD_HISTORIAL,
  };
}

/** Formatea una fecha/hora al estilo del expediente ("18/02/2026 11:40 COT"). */
function fechaHoraExpediente(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const hora = String(fecha.getHours()).padStart(2, "0");
  const minuto = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${anio} ${hora}:${minuto} COT`;
}

/**
 * Convierte `yyyy-MM-dd` (valor de `<input type="date">`) a `dd/MM/yyyy`.
 *
 * El formulario de S-02 usa fechas ISO porque son las que exige el control de
 * fecha; el expediente (listado y detalle) las guarda y muestra en formato
 * colombiano. La edición de S-04 es la frontera entre ambos mundos.
 */
function fechaCortaDesdeIso(fecha: string | null | undefined): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? "");
  return coincidencia
    ? `${coincidencia[3]}/${coincidencia[2]}/${coincidencia[1]}`
    : (fecha ?? "");
}

/** Convierte `dd/MM/yyyy` a `yyyy-MM-dd` para hidratar los controles de fecha. */
function fechaIsoDesdeCorta(fecha: string | null | undefined): string {
  const coincidencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha ?? "");
  return coincidencia
    ? `${coincidencia[3]}-${coincidencia[2]}-${coincidencia[1]}`
    : (fecha ?? "");
}

/** Hash abreviado de integridad para la confirmación de guardado (mock). */
function hashIntegridad(semilla: string): string {
  let hash = 0;
  for (let indice = 0; indice < semilla.length; indice += 1) {
    hash = (hash * 31 + semilla.charCodeAt(indice)) >>> 0;
  }
  const hex = hash.toString(16).toUpperCase().padStart(8, "0");
  return `SHA-256: ${hex.slice(0, 4)}...${hex.slice(4)}`;
}

/** Valor de catálogo de una dependencia a partir de su etiqueta visible. */
function valorDependencia(
  catalogo: readonly { readonly valor: string; readonly etiqueta: string }[],
  etiqueta: string,
): string {
  return catalogo.find((opcion) => opcion.etiqueta === etiqueta)?.valor ?? "";
}

/** Etiqueta visible de una dependencia (para el listado y la cabecera). */
function etiquetaDependencia(
  catalogo: readonly { readonly valor: string; readonly etiqueta: string }[],
  valor: string,
  reserva: string,
): string {
  return catalogo.find((opcion) => opcion.valor === valor)?.etiqueta ?? reserva;
}

/**
 * Cruce de SICAPITAL reconstruido desde el detalle.
 *
 * La edición no vuelve a consultar el sistema financiero: el paso 1 se hidrata
 * con esta fotografía, que respeta la necesidad y el CDP del expediente.
 */
function resultadoCruceDesdeDetalle(solicitud: Solicitud): ResultadoCruce {
  const general = generalDetalle(solicitud);
  const presupuesto = presupuestoDetalle(solicitud);
  const imputaciones = presupuesto?.imputaciones ?? IMPUTACIONES_MOCK;
  const disponibilidades = imputaciones.map((imputacion) => ({
    vigencia: Number(imputacion.vigencia),
    solicitudNecesidad: imputacion.solicitudNecesidad,
    numeroDisponibilidad: imputacion.numeroCdp,
    valor: imputacion.valor,
    dependencia: imputacion.dependencia,
    rubro: imputacion.rubro,
    rubroNombre: imputacion.rubroNombre,
    estado: imputacion.estado,
  }));
  const numeroNecesidad =
    disponibilidades[0]?.solicitudNecesidad ??
    `NEC-${solicitud.vigencia}-${solicitud.id.slice(-4)}`;

  return {
    necesidad: {
      valor: numeroNecesidad,
      titulo: solicitud.titulo,
      etiqueta: `${numeroNecesidad} (${solicitud.titulo})`,
      unidadEjecutora: solicitud.unidadEjecutora,
      vigencia: solicitud.vigencia,
    },
    presupuesto: {
      disponibilidades,
      valorCdp: disponibilidades.reduce(
        (total, disponibilidad) => total + disponibilidad.valor,
        0,
      ),
    },
    solicitud: {
      titulo: solicitud.titulo,
      vigencia: solicitud.vigencia,
      objeto: textoPlanoDesdeHtml(general.caracteristicas.objetivo),
      justificacion: textoPlanoDesdeHtml(general.planAccion.descripcion),
      sede: "Sede Aduanilla de Paiba",
      plazo: general.caracteristicas.plazoEjecucion,
      controlPresupuestal: "100% Amparado",
    },
    responsable: {
      nombres: general.responsable.nombres,
      apellidos: general.responsable.apellidos,
      identificacion: general.responsable.identificacion,
      unidadEjecutora: general.responsable.unidadEjecutora,
      ordenadorGasto: general.responsable.ordenadorGasto,
    },
    caracteristicas: {
      objetivo: general.caracteristicas.objetivo,
      requisitos: general.caracteristicas.requisitos,
      observaciones: general.caracteristicas.observaciones,
      plazoEjecucion: general.caracteristicas.plazoEjecucion,
    },
  };
}

/**
 * Fotografía editable de una solicitud.
 *
 * La capa de datos la entrega armada (el mock no guarda el formulario de S-02)
 * para que el asistente de edición hidrate sus pasos sin reconstruir nada desde
 * las vistas de solo lectura del detalle.
 */
function datosEdicionDesdeDetalle(solicitud: Solicitud): DatosEdicionSolicitud {
  const general = generalDetalle(solicitud);
  const contratacion = contratacionDetalle(solicitud);
  const proveedores = proveedoresDetalle(solicitud);
  const documentos = documentosDetalle(solicitud);
  const registros = itemsSolicitud(solicitud);

  return {
    necesidad: {
      unidadEjecutora: solicitud.unidadEjecutora,
      vigencia: String(solicitud.vigencia),
      numeroNecesidad: resultadoCruceDesdeDetalle(solicitud).necesidad.valor,
    },
    datosGenerales: {
      dependenciaSolicitante: valorDependencia(
        DEPENDENCIAS_SOLICITANTES,
        general.responsable.dependenciaSolicitante,
      ),
      dependenciaDestino: valorDependencia(
        DEPENDENCIAS_DESTINO,
        general.responsable.dependenciaDestino,
      ),
      fechaApertura: fechaIsoDesdeCorta(solicitud.apertura),
      fechaCierre: fechaIsoDesdeCorta(solicitud.cierre),
      criterioSeleccion: general.caracteristicas.criterioSeleccion,
      planAccion: general.planAccion.descripcion,
    },
    items: {
      modo: "individual",
      archivo: "",
      procesado: registros.length > 0,
      registros,
    },
    contratacion: {
      tipoContrato: contratacion?.tipoContrato ?? "",
      medioPago: contratacion?.medioPago ?? "",
      formaPago: contratacion?.formaPago ?? "",
      parametros: contratacion?.parametros ?? [],
    },
    proveedores: {
      actividades: proveedores?.segmentacion.actividades ?? [],
      areaSnies: proveedores?.segmentacion.areaSnies ?? "",
      nucleoSnies: proveedores?.segmentacion.nucleoSnies ?? "",
    },
    documentos: {
      anexos: documentos?.anexos ?? [],
      requeridos: documentos?.requeridos ?? DOCUMENTOS_OFERENTE_SEMILLA,
    },
    resultadoCruce: resultadoCruceDesdeDetalle(solicitud),
  };
}

/**
 * Resumen general del expediente con los valores editables del formulario.
 *
 * La edición no reescribe los textos institucionales (objetivo, requisitos,
 * observaciones): solo proyecta los campos que S-04 permite cambiar. Las
 * fechas vuelven del formulario en ISO y se muestran como el resto del
 * expediente (`dd/MM/yyyy`).
 */
function generalDesdeEdicion(
  solicitud: Solicitud,
  edicion: DatosEdicionSolicitud,
): GeneralDetalle {
  const base = generalDetalle(solicitud);
  const apertura = fechaCortaDesdeIso(edicion.datosGenerales.fechaApertura);
  const cierre = fechaCortaDesdeIso(edicion.datosGenerales.fechaCierre);

  return {
    responsable: {
      ...base.responsable,
      dependenciaSolicitante: etiquetaDependencia(
        DEPENDENCIAS_SOLICITANTES,
        edicion.datosGenerales.dependenciaSolicitante,
        base.responsable.dependenciaSolicitante,
      ),
      dependenciaDestino: etiquetaDependencia(
        DEPENDENCIAS_DESTINO,
        edicion.datosGenerales.dependenciaDestino,
        base.responsable.dependenciaDestino,
      ),
    },
    caracteristicas: {
      ...base.caracteristicas,
      apertura: {
        fecha: apertura || "Sin programar",
        nota: apertura
          ? base.caracteristicas.apertura.nota
          : "Pendiente de publicación del proceso",
      },
      cierre: {
        fecha: cierre || "Sin programar",
        nota: cierre
          ? base.caracteristicas.cierre.nota
          : "Se calcula desde la fecha de apertura",
      },
      criterioSeleccion: edicion.datosGenerales.criterioSeleccion,
    },
    planAccion: {
      ...base.planAccion,
      descripcion: edicion.datosGenerales.planAccion,
    },
  };
}

/** Contratación y pagos proyectados desde la fotografía editable. */
function contratacionDesdeEdicion(
  solicitud: Solicitud,
  edicion: DatosEdicionSolicitud,
): ContratacionDetalle | null {
  const base = contratacionDetalle(solicitud);
  if (
    !base &&
    !edicion.contratacion.tipoContrato &&
    !edicion.contratacion.medioPago &&
    !edicion.contratacion.formaPago &&
    edicion.contratacion.parametros.length === 0
  ) {
    return null;
  }

  return {
    ...CONTRATACION_BASE,
    ...(base ?? {}),
    tipoContrato: edicion.contratacion.tipoContrato || base?.tipoContrato || "",
    medioPago: edicion.contratacion.medioPago || base?.medioPago || "",
    formaPago: edicion.contratacion.formaPago || base?.formaPago || "",
    parametros: edicion.contratacion.parametros.length
      ? edicion.contratacion.parametros
      : (base?.parametros ?? []),
  };
}

/** Segmentación de proveedores proyectada desde la fotografía editable. */
function proveedoresDesdeEdicion(
  solicitud: Solicitud,
  edicion: DatosEdicionSolicitud,
): ProveedoresObjetivoDetalle | null {
  const base = proveedoresDetalle(solicitud);
  const { actividades, areaSnies, nucleoSnies } = edicion.proveedores;
  if (!base && actividades.length === 0) {
    return null;
  }

  const requiereIdoneidad = Boolean(nucleoSnies);
  return {
    segmentacion: {
      actividades: actividades.length
        ? actividades
        : (base?.segmentacion.actividades ?? []),
      areaSnies: areaSnies || base?.segmentacion.areaSnies || "",
      nucleoSnies: nucleoSnies || base?.segmentacion.nucleoSnies || "",
    },
    requiereIdoneidad: base?.requiereIdoneidad ?? requiereIdoneidad,
    notaIdoneidad: base?.notaIdoneidad ?? NOTA_IDONEIDAD,
    acuerdo: base?.acuerdo ?? ACUERDO_SNIES,
    notificacion: base?.notificacion ?? {
      enviada: solicitud.apertura
        ? `${solicitud.apertura} 08:00 COT`
        : "Pendiente de envío",
      ...(requiereIdoneidad ? NOTIFICACION_SERVICIOS : NOTIFICACION_BIENES),
      hash: HASH_AUDITORIA,
    },
  };
}

/** Expediente documental proyectado desde la fotografía editable. */
function documentosDesdeEdicion(
  solicitud: Solicitud,
  edicion: DatosEdicionSolicitud,
): DocumentosDetalle | null {
  const base = documentosDetalle(solicitud);
  if (
    !base &&
    edicion.documentos.anexos.length === 0 &&
    edicion.documentos.requeridos.length === 0
  ) {
    return null;
  }

  return {
    anexos: edicion.documentos.anexos,
    requeridos: edicion.documentos.requeridos,
    notaNormativa: base?.notaNormativa ?? NOTA_NORMATIVA_DOCUMENTOS,
    estadoMatriz: base?.estadoMatriz ?? ESTADO_MATRIZ_DOCUMENTOS,
    ultimaModificacion:
      base?.ultimaModificacion ?? ULTIMA_MODIFICACION_DOCUMENTOS,
    versionSistema: base?.versionSistema ?? VERSION_SISTEMA_DOCUMENTOS,
  };
}

/**
 * Amplía una fila del listado con la información del detalle.
 *
 * Cuando hay fotografía editable (S-04) el detalle se proyecta desde ella para
 * que las pestañas muestren la versión vigente después de guardar un borrador.
 * La edición restringida no llega aquí con valores aplicados: su propuesta vive
 * en `modificacionPendiente` y el expediente conserva la versión publicada.
 */
function comoDetalle(
  solicitud: Solicitud,
  edicion?: DatosEdicionSolicitud,
  extrasHistorial: readonly EventoHistorial[] = [],
): SolicitudDetalle {
  const general = edicion
    ? generalDesdeEdicion(solicitud, edicion)
    : generalDetalle(solicitud);
  const items = edicion ? edicion.items.registros : itemsSolicitud(solicitud);
  const contratacion = edicion
    ? contratacionDesdeEdicion(solicitud, edicion)
    : contratacionDetalle(solicitud);
  const proveedores = edicion
    ? proveedoresDesdeEdicion(solicitud, edicion)
    : proveedoresDetalle(solicitud);
  const documentos = edicion
    ? documentosDesdeEdicion(solicitud, edicion)
    : documentosDetalle(solicitud);
  const historial = historialDetalle(solicitud, extrasHistorial);

  return {
    ...solicitud,
    edicion,
    // Un borrador aún no se envía a proveedores: no puede tener cotizaciones.
    cotizacionesRecibidas:
      solicitud.estado === "borrador" ? 0 : COTIZACIONES_RECIBIDAS_MOCK,
    general,
    presupuesto: presupuestoDetalle(solicitud),
    itemsDetalle: ITEMS_DETALLE_MOCK,
    items,
    contratacion,
    proveedores,
    documentos,
    historial,
    contadores: {
      ...CONTADORES_MOCK,
      items: items.length,
      proveedores: proveedores ? contarProveedores(proveedores) : 0,
      documentos: documentos ? documentos.anexos.length : 0,
    },
  };
}

/**
 * Fotografía interna de una versión guardada (S-04).
 *
 * Guarda la fotografía editable, sus metadatos visibles y cuántos eventos de
 * bitácora existían al crearla: al volver a una versión se recorta la historia
 * posterior para que el expediente no quede inconsistente.
 */
interface VersionGuardada {
  readonly version: string;
  readonly revision: number;
  readonly fecha: string;
  readonly valores: DatosEdicionSolicitud;
  readonly eventos: number;
}

/**
 * Implementación simulada con retardo RxJS.
 *
 * Trucos de desarrollo (query params del navegador, sin tocar código):
 * - `?mock=vacio` → devuelve 0 filas (estado vacío)
 * - `?mock=error` → falla la petición (estado de error)
 * - `?mockRetardo=3000` → retardo en ms (ver el skeleton más tiempo)
 * - `?mockDetalle=error` → falla la carga del detalle (estado de error de S-03)
 * - `?mockGuardar=error` → falla el guardado de la edición (S-04)
 * - `?mockCancelar=error` → falla una cancelación (S-05)
 */
@Injectable()
export class SolicitudesServiceMock extends SolicitudesService {
  /** Filas modificadas durante la sesión (sobreponen a `DATOS_MOCK`). */
  private readonly filasEditadas = new Map<string, Solicitud>();

  /** Fotografía editable vigente de cada solicitud (base del diff). */
  private readonly ediciones = new Map<string, DatosEdicionSolicitud>();

  /** Versiones guardadas de la edición, de la más antigua a la más reciente. */
  private readonly versiones = new Map<string, readonly VersionGuardada[]>();

  /** Eventos de bitácora generados por ediciones guardadas en la sesión. */
  private readonly historialEdiciones = new Map<
    string,
    readonly EventoHistorial[]
  >();

  constructor(private readonly diferencias: DiferenciasSolicitudService) {
    super();
  }

  listar(
    criterios: Partial<FiltroSolicitudes>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListado> {
    const params = new URLSearchParams(window.location.search);
    const modo = params.get("mock");
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (modo === "error") {
      return throwError(
        () => new Error("No fue posible consultar las solicitudes."),
      ).pipe(delay(retardo));
    }

    if (modo === "vacio") {
      return of({ solicitudes: [], total: 0 }).pipe(delay(retardo));
    }

    const filas = DATOS_MOCK.map(
      (solicitud) => this.filasEditadas.get(solicitud.id) ?? solicitud,
    );
    const filtradas = filas.filter((solicitud) =>
      this.coincide(solicitud, criterios),
    );

    const desde = pagina * porPagina;
    const hasta = desde + porPagina;

    return of({
      solicitudes: filtradas.slice(desde, hasta),
      total: filtradas.length,
    }).pipe(delay(retardo));
  }

  listarInvitacionesProveedor(
    criterios: Partial<FiltroInvitacionesProveedor>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoInvitaciones> {
    const params = new URLSearchParams(window.location.search);
    const modo = params.get("mockInvitaciones");
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (modo === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar las solicitudes asignadas al proveedor.",
          ),
      ).pipe(delay(retardo));
    }

    if (modo === "vacio") {
      return of({
        invitaciones: [],
        total: 0,
        conteos: conteosVacios(),
        dependencias: [],
      }).pipe(delay(retardo));
    }

    const solicitudes = new Map(
      SOLICITUDES_PROVEEDOR_MOCK.map((solicitud) => [
        solicitud.id,
        solicitud,
      ]),
    );
    const filas: InvitacionProveedorConSolicitud[] =
      INVITACIONES_PROVEEDOR_MOCK.flatMap((invitacion) => {
        const solicitud = solicitudes.get(invitacion.solicitudId);
        if (!solicitud) {
          return [];
        }
        return [
          {
            invitacion,
            solicitud,
            ordenadorGasto:
              ORDENADORES_PROVEEDOR_MOCK[solicitud.id] ??
              "Por definir",
            nota: NOTAS_PROVEEDOR_MOCK[solicitud.id] ?? "",
          },
        ];
      });

    const base = filas.filter((fila) =>
      this.coincideInvitacion(fila, criterios),
    );
    const conteos = contarInvitaciones(base);
    const filtradas = base.filter(
      ({ invitacion }) =>
        !criterios.grupo ||
        criterios.grupo === "todas" ||
        grupoDeInvitacion(invitacion.estado) === criterios.grupo,
    );
    // Provisional: conserva el orden descendente por identificador del mockup.
    const factor = criterios.ordenNumero === "asc" ? 1 : -1;
    const ordenadas = [...filtradas].sort(
      (a, b) => factor * a.solicitud.id.localeCompare(b.solicitud.id),
    );
    const desde = pagina * porPagina;

    return of({
      invitaciones: ordenadas.slice(desde, desde + porPagina),
      total: ordenadas.length,
      conteos,
      dependencias: [
        ...new Set(
          SOLICITUDES_PROVEEDOR_MOCK.map(
            (solicitud) => solicitud.dependencia,
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "es-CO")),
    }).pipe(delay(retardo));
  }

  obtenerPorId(id: string): Observable<SolicitudDetalle | null> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockDetalle") === "error") {
      return throwError(
        () => new Error("No fue posible consultar el detalle de la solicitud."),
      ).pipe(delay(retardo));
    }

    const solicitud = this.fila(id);
    if (!solicitud) {
      return of(null).pipe(delay(retardo));
    }

    const edicion = this.edicionBase(solicitud);
    const pendiente =
      solicitud.modificacionPendiente ??
      this.modificacionDemo(solicitud, edicion);
    const fila = pendiente
      ? { ...solicitud, modificacionPendiente: pendiente }
      : solicitud;

    return of(
      comoDetalle(fila, edicion, this.historialEdiciones.get(id) ?? []),
    ).pipe(delay(retardo));
  }

  /**
   * Guarda una edición (S-04).
   *
   * En modo completo aplica los cambios a la fila y a la fotografía editable;
   * en modo restringido deja la propuesta en `modificacionPendiente` y mueve la
   * solicitud a `en-aprobacion` sin tocar los datos del expediente.
   */
  guardarEdicion(
    id: string,
    valores: DatosEdicionSolicitud,
    modo: ModoEdicionSolicitud,
  ): Observable<ResultadoGuardadoSolicitud> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 600;

    if (params.get("mockGuardar") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible guardar la modificación de la solicitud. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    const actual = this.fila(id);
    if (!actual) {
      return throwError(
        () => new Error("La solicitud ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    const base = this.edicionBase(actual);
    const resumen = this.diferencias.calcular(base, valores);
    const ahora = new Date();
    const fecha = fechaHoraExpediente(ahora);
    const revision = revisionSolicitud(actual) + 1;
    const version =
      modo === "completa"
        ? siguienteVersionBorrador(versionSolicitud(actual))
        : siguienteVersionModificacion(versionSolicitud(actual));
    const estado: EstadoSolicitud =
      modo === "completa" ? "borrador" : "en-aprobacion";
    const hash = hashIntegridad(
      `${id}-${version}-${revision}-${ahora.toISOString()}-${resumen.total}`,
    );

    if (modo === "completa") {
      this.ediciones.set(id, valores);
      this.filasEditadas.set(id, {
        ...actual,
        estado,
        version,
        revision,
        ultimaModificacion: fecha,
        apertura:
          fechaCortaDesdeIso(valores.datosGenerales.fechaApertura) || null,
        cierre: fechaCortaDesdeIso(valores.datosGenerales.fechaCierre) || null,
        dependencia: etiquetaDependencia(
          DEPENDENCIAS_DESTINO,
          valores.datosGenerales.dependenciaDestino,
          actual.dependencia,
        ),
      });
      // El borrador no tiene bitácora propia: la edición deja un evento de
      // sesión para que la pestaña "Historial" muestre la nueva versión.
      const eventos = [
        ...(this.historialEdiciones.get(id) ?? []),
        eventoEdicionBorrador(
          `evento-${id}-edicion-${revision}`,
          fecha.slice(0, 10),
          fecha.slice(11, 16),
          version,
          resumen.total,
        ),
      ];
      this.historialEdiciones.set(id, eventos);
      // La versión queda disponible para el descarte progresivo: volver a una
      // anterior restaura su fotografía y recorta la bitácora posterior.
      this.versiones.set(id, [
        ...(this.versiones.get(id) ?? []),
        { version, revision, fecha, valores, eventos: eventos.length },
      ]);
    } else {
      this.filasEditadas.set(id, {
        ...actual,
        estado,
        version,
        revision,
        ultimaModificacion: fecha,
        modificacionPendiente: {
          version,
          revision,
          solicitadaEl: fecha,
          solicitadaPor: "Raúl Quimbaya",
          cambios: resumen.total,
          valores,
        },
      });
    }

    return of({
      modo,
      version,
      revision,
      estado,
      fecha,
      hash,
      cambios: resumen.total,
      grupos: resumen.grupos,
    }).pipe(delay(retardo));
  }

  cancelarSolicitud(
    id: string,
    justificacion: string,
  ): Observable<SolicitudDetalle> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockCancelar") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible cancelar la solicitud. Verifique su conexión e intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    const actual = this.fila(id);
    if (!actual) {
      return throwError(
        () => new Error("La solicitud ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    if (!MATRIZ_ACCIONES_POR_ESTADO[actual.estado].includes("cancelar")) {
      return throwError(
        () =>
          new Error("La solicitud cambió de estado y ya no se puede cancelar."),
      ).pipe(delay(retardo));
    }

    const motivo = textoPlanoDesdeHtml(justificacion).trim();
    if (motivo.length < MIN_CARACTERES_JUSTIFICACION) {
      return throwError(
        () =>
          new Error(
            `La justificación debe tener al menos ${MIN_CARACTERES_JUSTIFICACION} caracteres.`,
          ),
      ).pipe(delay(retardo));
    }

    const detalleActual = comoDetalle(
      actual,
      this.edicionBase(actual),
      this.historialEdiciones.get(id) ?? [],
    );
    // El mock solo conoce el total del segmento; el registro real de entregas
    // por destinatario se conectará cuando exista NotificacionesService.
    const destinatariosNotificados =
      actual.estado === "borrador" ? 0 : detalleActual.contadores.proveedores;
    const ahora = new Date();
    const fecha = fechaHoraExpediente(ahora);
    const cancelacion: DatosCancelacionSolicitud = {
      estadoAnterior: actual.estado,
      justificacion: motivo,
      fecha,
      usuario: "sesion",
      autor: "Usuario autenticado",
      rol: "Solicitante (JD u OG)",
      destinatariosNotificados,
    };
    const actualizada: Solicitud = {
      ...actual,
      estado: "cancelada",
      ultimaModificacion: fecha,
      cancelacion,
    };
    const evento = eventoCancelacion(actualizada);

    this.filasEditadas.set(id, actualizada);
    if (evento) {
      this.historialEdiciones.set(id, [
        ...(this.historialEdiciones.get(id) ?? []),
        evento,
      ]);
    }

    return of(
      comoDetalle(
        actualizada,
        this.edicionBase(actualizada),
        this.historialEdiciones.get(id) ?? [],
      ),
    ).pipe(delay(retardo));
  }

  /**
   * Versiones guardadas de la edición (S-04).
   *
   * Devuelve la versión vigente primero y luego las anteriores. La versión
   * vigente no tiene cambios en riesgo (elegirla solo descarta lo no guardado);
   * las anteriores informan lo que se perdería al volver a ellas.
   */
  historialVersiones(
    id: string,
  ): Observable<readonly VersionEdicionSolicitud[]> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 500;

    const solicitud = this.fila(id);
    if (!solicitud) {
      return throwError(
        () => new Error("La solicitud ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    const vigente = this.edicionBase(solicitud);
    const versiones = this.versiones.get(id) ?? [];
    const total = versiones.length;

    const resultado = [...versiones].reverse().map((guardada, indice) => {
      const actual = indice === 0;
      const esOriginal = versiones[0]?.version === guardada.version;
      return {
        version: guardada.version,
        revision: guardada.revision,
        fecha: guardada.fecha,
        etiqueta: actual
          ? "Versión vigente"
          : esOriginal || total === 1
            ? "Versión original"
            : "Versión guardada",
        actual,
        diferencias: actual
          ? { grupos: [], total: 0 }
          : this.diferencias.calcular(guardada.valores, vigente),
      };
    });

    return of(resultado).pipe(delay(retardo));
  }

  /**
   * Vuelve a una versión guardada anterior (S-04).
   *
   * Restaura la fotografía, la fila y el contador de la bitácora de esa versión:
   * los guardados posteriores se recortan y la solicitud queda lista para
   * seguir editando desde ese punto.
   */
  revertirEdicion(id: string, version: string): Observable<void> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 500;

    const solicitud = this.fila(id);
    if (!solicitud) {
      return throwError(
        () => new Error("La solicitud ya no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    this.edicionBase(solicitud);
    const versiones = this.versiones.get(id) ?? [];
    const indice = versiones.findIndex(
      (guardada) => guardada.version === version,
    );
    const objetivo = indice >= 0 ? versiones[indice] : undefined;
    const semilla = DATOS_MOCK.find((fila) => fila.id === id);

    if (!objetivo || !semilla) {
      return throwError(
        () =>
          new Error(
            "La versión seleccionada ya no está disponible. Vuelva al detalle e intente de nuevo.",
          ),
      ).pipe(delay(retardo));
    }

    // Volver a la versión vigente no cambia el expediente: solo se descarta el
    // avance local que el asistente limpia al cerrar el diálogo.
    if (indice === versiones.length - 1) {
      return of(void 0).pipe(delay(retardo));
    }

    this.versiones.set(id, versiones.slice(0, indice + 1));
    this.historialEdiciones.set(
      id,
      (this.historialEdiciones.get(id) ?? []).slice(0, objetivo.eventos),
    );
    this.ediciones.set(id, objetivo.valores);
    this.filasEditadas.set(id, this.filaDesdeVersion(semilla, objetivo));

    return of(void 0).pipe(delay(retardo));
  }

  /**
   * Devuelve los metadatos del anexo solicitado.
   *
   * No hay gestor documental conectado: el resultado informa que la operación
   * es simulada. Con `?mockDocumento=error` la consulta falla, para revisar el
   * estado de error de la pestaña.
   */
  obtenerDocumento(id: string): Observable<DocumentoResuelto> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockDocumento") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar el archivo en el repositorio institucional (Alfresco UD).",
          ),
      ).pipe(delay(retardo));
    }

    const documento = this.buscarAnexo(id);
    if (!documento) {
      return throwError(
        () => new Error("El documento solicitado no existe en el expediente."),
      ).pipe(delay(retardo));
    }

    return of({
      documento,
      disponible: true,
      mensaje: MENSAJE_GESTOR_DOCUMENTAL,
    }).pipe(delay(retardo));
  }

  /** Fila vigente de una solicitud (la editada sobrepone a la semilla). */
  private fila(id: string): Solicitud | undefined {
    return (
      this.filasEditadas.get(id) ??
      DATOS_MOCK.find((solicitud) => solicitud.id === id)
    );
  }

  /**
   * Fotografía editable vigente de una solicitud.
   *
   * Se construye la primera vez desde el detalle y se conserva para que el
   * diff compare siempre contra la última versión aplicada. Al crearla se
   * registra también la versión original del expediente, primer punto del
   * historial de descarte progresivo.
   */
  private edicionBase(solicitud: Solicitud): DatosEdicionSolicitud {
    const guardada = this.ediciones.get(solicitud.id);
    if (guardada) {
      this.asegurarVersiones(solicitud.id);
      return guardada;
    }
    const construida = datosEdicionDesdeDetalle(solicitud);
    this.ediciones.set(solicitud.id, construida);
    this.asegurarVersiones(solicitud.id);
    return construida;
  }

  /** Registra la versión original de la solicitud si aún no existe. */
  private asegurarVersiones(id: string): void {
    if (this.versiones.has(id)) {
      return;
    }
    const semilla = DATOS_MOCK.find((solicitud) => solicitud.id === id);
    const valores = this.ediciones.get(id);
    if (!semilla || !valores) {
      return;
    }
    this.versiones.set(id, [
      {
        version: versionSolicitud(semilla),
        revision: revisionSolicitud(semilla),
        fecha: semilla.ultimaModificacion ?? "",
        valores,
        eventos: 0,
      },
    ]);
  }

  /** Fila del listado reconstruida desde una versión guardada. */
  private filaDesdeVersion(
    semilla: Solicitud,
    version: VersionGuardada,
  ): Solicitud {
    return {
      ...semilla,
      estado: semilla.estado,
      version: version.version,
      revision: version.revision,
      ultimaModificacion: version.fecha,
      apertura:
        fechaCortaDesdeIso(version.valores.datosGenerales.fechaApertura) ||
        null,
      cierre:
        fechaCortaDesdeIso(version.valores.datosGenerales.fechaCierre) || null,
      dependencia: etiquetaDependencia(
        DEPENDENCIAS_DESTINO,
        version.valores.datosGenerales.dependenciaDestino,
        semilla.dependencia,
      ),
    };
  }

  /**
   * Modificación pendiente de demostración (S-08).
   *
   * La solicitud `en-aprobacion` de la semilla no tiene una propuesta guardada;
   * este mock la crea para que el detalle y el armazón bloqueado muestren el
   * flujo completo sin depender de una edición previa en la sesión.
   */
  private modificacionDemo(
    solicitud: Solicitud,
    edicion: DatosEdicionSolicitud,
  ): ModificacionPendiente | null {
    if (solicitud.id !== "SOL-2026-0041") {
      return null;
    }

    const registros = edicion.items.registros;
    const primero = registros[0];
    const valores: DatosEdicionSolicitud = {
      ...edicion,
      datosGenerales: {
        ...edicion.datosGenerales,
        fechaCierre: "2026-02-27",
      },
      items: primero
        ? {
            ...edicion.items,
            registros: [
              { ...primero, cantidad: primero.cantidad + 2 },
              ...registros.slice(1),
            ],
          }
        : edicion.items,
    };

    return {
      version: "v1.1",
      revision: 2,
      solicitadaEl: "19/02/2026 15:05 COT",
      solicitadaPor: "Raúl Quimbaya",
      cambios: 2,
      valores,
    };
  }

  /** Busca un anexo por su identificador en todos los expedientes simulados. */
  private buscarAnexo(id: string): AnexoSolicitud | null {
    for (const anexos of Object.values(ANEXOS_POR_SOLICITUD)) {
      const encontrado = anexos.find((anexo) => anexo.id === id);
      if (encontrado) {
        return encontrado;
      }
    }
    return null;
  }

  private coincide(
    solicitud: Solicitud,
    criterios: Partial<FiltroSolicitudes>,
  ): boolean {
    const { vigencia, unidadEjecutora, estado, tipoCotizacion, busqueda } =
      criterios;

    if (vigencia && vigencia !== "historico") {
      if (String(solicitud.vigencia) !== vigencia) {
        return false;
      }
    }

    if (unidadEjecutora && solicitud.unidadEjecutora !== unidadEjecutora) {
      return false;
    }

    if (estado && solicitud.estado !== (estado as EstadoSolicitud)) {
      return false;
    }

    if (tipoCotizacion) {
      const tipo = MAPA_TIPOS[tipoCotizacion];
      if (!tipo || solicitud.tipoCotizacion !== tipo) {
        return false;
      }
    }

    const texto = busqueda?.trim().toLowerCase();
    if (texto) {
      const coincide =
        solicitud.id.toLowerCase().includes(texto) ||
        solicitud.titulo.toLowerCase().includes(texto);
      if (!coincide) {
        return false;
      }
    }

    return true;
  }

  private coincideInvitacion(
    fila: InvitacionProveedorConSolicitud,
    criterios: Partial<FiltroInvitacionesProveedor>,
  ): boolean {
    const { invitacion, solicitud } = fila;
    if (
      criterios.vigencia &&
      criterios.vigencia !== "todas" &&
      String(solicitud.vigencia) !== criterios.vigencia
    ) {
      return false;
    }
    if (criterios.estado && invitacion.estado !== criterios.estado) {
      return false;
    }
    if (
      criterios.tipoCotizacion &&
      solicitud.tipoCotizacion !== criterios.tipoCotizacion
    ) {
      return false;
    }
    if (
      criterios.dependencia &&
      solicitud.dependencia !== criterios.dependencia
    ) {
      return false;
    }

    const texto = criterios.busqueda?.trim().toLocaleLowerCase("es-CO");
    if (
      texto &&
      ![
        fila.invitacion.id,
        solicitud.id,
        solicitud.titulo,
        solicitud.dependencia,
        fila.ordenadorGasto,
      ].some((valor) => valor.toLocaleLowerCase("es-CO").includes(texto))
    ) {
      return false;
    }

    return true;
  }
}

function conteosVacios(): ConteosFiltrosInvitaciones {
  return {
    todas: 0,
    "por-responder": 0,
    respondidas: 0,
    "con-modificaciones": 0,
    cerradas: 0,
  };
}

function contarInvitaciones(
  filas: readonly InvitacionProveedorConSolicitud[],
): ConteosFiltrosInvitaciones {
  const conteos: Record<GrupoFiltroInvitacion, number> = {
    todas: filas.length,
    "por-responder": 0,
    respondidas: 0,
    "con-modificaciones": 0,
    cerradas: 0,
  };
  for (const { invitacion } of filas) {
    conteos[grupoDeInvitacion(invitacion.estado)] += 1;
  }
  return conteos;
}
