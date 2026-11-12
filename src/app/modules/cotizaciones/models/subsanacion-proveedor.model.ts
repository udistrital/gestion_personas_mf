/**
 * Proyección de P-08: la subsanación vista por el proveedor.
 *
 * No es un modelo persistente paralelo: reutiliza `Subsanacion`,
 * `OferenteSubsanacion`, `EventoSubsanacion` y las funciones puras de S-12.
 * Su única responsabilidad es filtrar el periodo al proveedor de la sesión y
 * traducirlo a lo que la pantalla necesita pintar (documentos habilitados,
 * archivo actual, estado por documento y avance).
 *
 * RN-29: nunca devuelve oferentes, eventos ni documentos de otros proveedores.
 */

import type {
  EstadoDocumentoSubsanacionProveedor,
  EstadoSubsanacion,
  EstadoSubsanacionOferente,
} from "src/app/core/constants/estados-solicitud.const";
export type { EstadoDocumentoSubsanacionProveedor } from "src/app/core/constants/estados-solicitud.const";
import type {
  ClasificacionDocumento,
  DocumentoOfertaRadicado,
  DocumentoOferente,
} from "./documentos.model";
import {
  etiquetaClasificacion,
  etiquetaFormato,
  iconoPorFormato,
} from "./documentos.model";
import { formatoFechaHoraOferente } from "./oferente.model";
import type {
  ArchivoSubsanado,
  DocumentoSubsanable,
  EventoSubsanacion,
  OferenteSubsanacion,
  Subsanacion,
} from "./subsanacion.model";
import {
  estadoOferenteSubsanacion,
  estadoSubsanacion,
  eventoDocumento,
  eventosVigentes,
} from "./subsanacion.model";

/** Archivo que se muestra en la columna «Archivo actual». */
export interface ArchivoVistaSubsanacion {
  readonly nombre: string;
  readonly peso: string;
  readonly icono: string;
  readonly formato: string;
  readonly fecha: string;
  readonly fechaIso: string | null;
  readonly origen: "oferta" | "subsanacion";
}

/** Documento de la matriz con su estado dentro del periodo. */
export interface DocumentoSubsanacionProveedor {
  readonly id: string;
  readonly requisitoId: string | null;
  readonly nombre: string;
  readonly clasificacion: ClasificacionDocumento;
  readonly etiquetaClasificacion: string;
  readonly instruccion: string;
  readonly observacion: string;
  readonly icono: string;
  readonly afectaPuntaje: boolean;
  readonly habilitado: boolean;
  readonly bloqueadoPorPliego: boolean;
  readonly estado: EstadoDocumentoSubsanacionProveedor;
  readonly archivoActual: ArchivoVistaSubsanacion | null;
  readonly archivoAnterior: ArchivoVistaSubsanacion | null;
  readonly evento: EventoSubsanacion | null;
  readonly fechaCarga: string | null;
  readonly fechaCargaIso: string | null;
}

/** Periodo filtrado a un proveedor, listo para P-08. */
export interface SubsanacionProveedor {
  /** El periodo con un solo oferente y solo sus eventos. */
  readonly subsanacion: Subsanacion;
  readonly estadoPeriodo: EstadoSubsanacion;
  readonly estadoProveedor: EstadoSubsanacionOferente;
  readonly oferente: OferenteSubsanacion;
  readonly documentos: readonly DocumentoSubsanacionProveedor[];
  readonly eventos: readonly EventoSubsanacion[];
  readonly total: number;
  readonly completados: number;
  readonly porcentaje: number;
  readonly obligatoriosPendientes: number;
  readonly radicada: boolean;
  readonly radicadaEl: string | null;
  readonly radicadoProveedor: string | null;
  readonly puedeEditar: boolean;
  readonly puedeRadicar: boolean;
}

/** Resumen liviano para la bandeja y los avisos de P-02/P-06. */
export interface ResumenSubsanacionProveedor {
  readonly estadoPeriodo: EstadoSubsanacion;
  readonly estadoProveedor: EstadoSubsanacionOferente;
  readonly inicio: string;
  readonly fin: string;
  readonly inicioTexto: string;
  readonly finTexto: string;
  readonly completados: number;
  readonly total: number;
  readonly porcentaje: number;
  readonly radicada: boolean;
  readonly radicadoProveedor: string | null;
}

/**
 * Filtra el periodo al proveedor de la sesión antes de entregarlo a P-01,
 * P-02, P-06 o P-08. Es la barrera de RN-29 en la capa de datos: el cliente no
 * recibe nombres, documentos ni eventos de otros oferentes.
 */
export function filtrarSubsanacionProveedor(
  subsanacion: Subsanacion | null | undefined,
  proveedorId: string,
): Subsanacion | null {
  if (!subsanacion) {
    return null;
  }
  const oferente = subsanacion.oferentes.find(
    (item) => item.proveedorId === proveedorId,
  );
  if (!oferente) {
    return null;
  }
  return {
    ...subsanacion,
    oferentes: [oferente],
    eventos: subsanacion.eventos.filter(
      (evento) => !evento.oferenteId || evento.oferenteId === proveedorId,
    ),
  };
}

/** Evento de radicación formal del proveedor, si ya existe. */
export function radicacionSubsanacion(
  subsanacion: Subsanacion,
  proveedorId: string,
): EventoSubsanacion | null {
  return (
    [...subsanacion.eventos]
      .reverse()
      .find(
        (evento) =>
          evento.tipo === "subsanacion-radicada" &&
          evento.oferenteId === proveedorId,
      ) ?? null
  );
}

/** Resumen del avance para P-01 y las tarjetas de P-02/P-06. */
export function resumenSubsanacionProveedor(
  subsanacion: Subsanacion,
  proveedorId: string,
  ahora: number = Date.now(),
): ResumenSubsanacionProveedor | null {
  const oferente = subsanacion.oferentes.find(
    (item) => item.proveedorId === proveedorId,
  );
  if (!oferente) {
    return null;
  }

  const seleccionados = oferente.documentos.filter(
    (documento) => documento.seleccionado,
  );
  const completados = seleccionados.filter(
    (documento) =>
      !!eventoDocumento(subsanacion, proveedorId, documento.id),
  ).length;
  const radicacion = radicacionSubsanacion(subsanacion, proveedorId);

  return {
    estadoPeriodo: estadoSubsanacion(subsanacion, ahora),
    estadoProveedor: estadoOferenteSubsanacion(oferente, subsanacion, ahora),
    inicio: subsanacion.inicio,
    fin: subsanacion.fin,
    inicioTexto: formatoFechaHoraOferente(subsanacion.inicio),
    finTexto: formatoFechaHoraOferente(subsanacion.fin),
    completados,
    total: seleccionados.length,
    porcentaje:
      seleccionados.length === 0
        ? 0
        : Math.round((completados / seleccionados.length) * 100),
    radicada: !!radicacion,
    radicadoProveedor: radicacion?.radicado ?? null,
  };
}

/**
 * Construye la proyección de P-08.
 *
 * `documentosOferta` es la lista de P-06 (`documentosDeLaRespuesta`), que ya
 * incluye el archivo vigente de cada requisito. `requeridos` es la matriz de
 * S-03 y aporta la clasificación, la instrucción y el bloqueo por pliego.
 */
export function construirSubsanacionProveedor(
  subsanacion: Subsanacion,
  proveedorId: string,
  requeridos: readonly DocumentoOferente[],
  documentosOferta: readonly DocumentoOfertaRadicado[],
  ahora: number = Date.now(),
): SubsanacionProveedor | null {
  const oferente = subsanacion.oferentes.find(
    (item) => item.proveedorId === proveedorId,
  );
  if (!oferente) {
    return null;
  }

  const estadoPeriodo = estadoSubsanacion(subsanacion, ahora);
  const vencida = estadoPeriodo === "vencida";
  const eventos = eventosVigentes(subsanacion, ahora).filter(
    (evento) => !evento.oferenteId || evento.oferenteId === proveedorId,
  );
  const documentos = requeridos.map((requisito) =>
    construirDocumento(
      subsanacion,
      proveedorId,
      requisito,
      documentosOferta,
      vencida,
    ),
  );
  const habilitados = documentos.filter((documento) => documento.habilitado);
  const completados = habilitados.filter(
    (documento) =>
      documento.estado === "adjuntado" ||
      documento.estado === "reemplazado",
  ).length;
  const radicacion = radicacionSubsanacion(subsanacion, proveedorId);
  const radicada = !!radicacion;
  const total = habilitados.length;

  return {
    subsanacion: {
      ...subsanacion,
      oferentes: [oferente],
      eventos,
    },
    estadoPeriodo,
    estadoProveedor: estadoOferenteSubsanacion(oferente, subsanacion, ahora),
    oferente,
    documentos,
    eventos,
    total,
    completados,
    porcentaje: total === 0 ? 0 : Math.round((completados / total) * 100),
    obligatoriosPendientes: habilitados.filter(
      (documento) =>
        documento.clasificacion === "obligatorio" &&
        (documento.estado === "pendiente-carga" ||
          documento.estado === "no-subsanado-plazo"),
    ).length,
    radicada,
    radicadaEl: radicacion?.fecha ?? null,
    radicadoProveedor: radicacion?.radicado ?? null,
    puedeEditar: estadoPeriodo === "activa" && !radicada && total > 0,
    puedeRadicar:
      estadoPeriodo === "activa" &&
      !radicada &&
      total > 0 &&
      habilitados.filter(
        (documento) =>
          documento.clasificacion === "obligatorio" &&
          (documento.estado === "pendiente-carga" ||
            documento.estado === "no-subsanado-plazo"),
      ).length === 0 &&
      completados > 0,
  };
}

/** Texto del estado del documento; el color nunca va solo. */
export function etiquetaEstadoDocumentoSubsanacion(
  estado: EstadoDocumentoSubsanacionProveedor,
): string {
  switch (estado) {
    case "no-habilitado":
      return "No habilitado";
    case "pendiente-carga":
      return "Pendiente de cargue";
    case "adjuntado":
      return "Cargado";
    case "reemplazado":
      return "Reemplazado";
    case "no-subsanado-plazo":
      return "No subsanado en plazo";
  }
}

/** Texto del avance del proveedor para P-01 y los avisos. */
export function etiquetaAvanceSubsanacion(
  estado: EstadoSubsanacionOferente,
): string {
  switch (estado) {
    case "sin-observaciones":
      return "Sin observaciones";
    case "requiere-subsanacion":
      return "Requiere subsanación";
    case "en-espera":
      return "Subsanación pendiente";
    case "subsanado-parcial":
      return "Subsanación parcial";
    case "subsanado-completo":
      return "Subsanación cumplida";
    case "no-subsanado":
      return "No subsanado en plazo";
  }
}

function construirDocumento(
  subsanacion: Subsanacion,
  proveedorId: string,
  requisito: DocumentoOferente,
  documentosOferta: readonly DocumentoOfertaRadicado[],
  vencida: boolean,
): DocumentoSubsanacionProveedor {
  const periodo = subsanacion.oferentes
    .find((item) => item.proveedorId === proveedorId)
    ?.documentos.find((documento) => documento.id === requisito.id);
  const oferta = archivoDeLaOferta(requisito, documentosOferta);
  const evento = eventoDocumento(subsanacion, proveedorId, requisito.id);
  const habilitado = habilitadoParaSubsanar(periodo);
  const estado = estadoDocumento(habilitado, evento, vencida);
  const archivoActual = evento?.versionNueva
    ? archivoDesdeEvento(evento.versionNueva, evento.fecha)
    : oferta
      ? archivoDesdeOferta(oferta)
      : null;

  return {
    id: requisito.id,
    requisitoId: requisito.id,
    nombre: requisito.nombre,
    clasificacion: requisito.clasificacion,
    etiquetaClasificacion: etiquetaClasificacion(requisito.clasificacion),
    instruccion: requisito.instruccion,
    observacion: periodo?.observacion ?? "",
    icono: periodo?.icono ?? requisito.icono,
    afectaPuntaje: periodo?.afectaPuntaje ?? requisito.afectaPuntaje ?? false,
    habilitado,
    bloqueadoPorPliego:
      periodo?.bloqueadoPorPliego ?? requisito.subsanable === false,
    estado,
    archivoActual,
    archivoAnterior: evento?.versionAnterior
      ? archivoDesdeEvento(evento.versionAnterior, evento.fecha)
      : null,
    evento,
    fechaCarga: evento ? formatoFechaHoraOferente(evento.fecha) : null,
    fechaCargaIso: evento?.fecha ?? null,
  };
}

function habilitadoParaSubsanar(
  documento: DocumentoSubsanable | undefined,
): boolean {
  return (
    !!documento &&
    documento.seleccionado &&
    documento.subsanable !== false &&
    !documento.bloqueadoPorPliego
  );
}

function estadoDocumento(
  habilitado: boolean,
  evento: EventoSubsanacion | null,
  vencida: boolean,
): EstadoDocumentoSubsanacionProveedor {
  if (!habilitado) {
    return "no-habilitado";
  }
  if (evento?.tipo === "documento-reemplazado") {
    return "reemplazado";
  }
  if (evento) {
    return "adjuntado";
  }
  return vencida ? "no-subsanado-plazo" : "pendiente-carga";
}

/**
 * Archivo vigente de la oferta para un requisito.
 *
 * La cotización propia se representa con el soporte principal de P-06; el
 * resto se busca por `requisitoId`.
 */
function archivoDeLaOferta(
  requisito: DocumentoOferente,
  documentosOferta: readonly DocumentoOfertaRadicado[],
): DocumentoOfertaRadicado | null {
  return (
    documentosOferta.find(
      (documento) => documento.requisitoId === requisito.id,
    ) ??
    (requisito.id === "doc-cotizacion-propia"
      ? documentosOferta.find((documento) => documento.principal) ?? null
      : null)
  );
}

function archivoDesdeOferta(
  documento: DocumentoOfertaRadicado,
): ArchivoVistaSubsanacion {
  return {
    nombre: documento.nombreArchivo,
    peso: documento.peso,
    icono: documento.icono,
    formato: documento.formato,
    fecha: documento.fechaRadicacion,
    fechaIso: null,
    origen: "oferta",
  };
}

function archivoDesdeEvento(
  archivo: ArchivoSubsanado,
  fecha: string,
): ArchivoVistaSubsanacion {
  return {
    nombre: archivo.nombre,
    peso: archivo.peso,
    icono: iconoPorFormato(archivo.nombre),
    formato: etiquetaFormato(archivo.nombre) || "—",
    fecha: formatoFechaHoraOferente(fecha),
    fechaIso: fecha,
    origen: "subsanacion",
  };
}
