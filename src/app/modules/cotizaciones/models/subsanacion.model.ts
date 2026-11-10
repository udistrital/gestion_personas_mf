/**
 * Modelo de la subsanación documental (S-12).
 *
 * Un periodo de subsanación agrupa uno o varios oferentes con cotización y, por
 * cada uno, los documentos autorizados para corregir o complementar. El modelo
 * conserva la trazabilidad exigida por RN-08: fecha, hora y usuario autorizado
 * en cada evento.
 *
 * El periodo no cambia el `EstadoSolicitud` ni el estado de la invitación: el
 * estado de la subsanación es derivado (`EstadoSubsanacion`) y el estado del
 * oferente dentro del periodo también (`EstadoSubsanacionOferente`).
 */

import type {
  EstadoSubsanacion,
  EstadoSubsanacionOferente,
} from "src/app/core/constants/estados-solicitud.const";
import type {
  ClasificacionDocumento,
  DocumentoOferente,
} from "./documentos.model";
import { etiquetaClasificacion } from "./documentos.model";
import type { OferenteTablero } from "./oferente.model";
import { formatoFechaHoraOferente } from "./oferente.model";
import { identidadProveedor } from "./proveedores.model";

/* ── Documentos y oferentes ───────────────────────────────────────────────── */

/** Motivo por el que el documento requiere subsanación. */
export type MotivoObservacionDocumento =
  | "vencido"
  | "incompleto"
  | "ilegible"
  | "no-aportado";

/** Estado de un documento dentro del periodo de subsanación. */
export type EstadoDocumentoSubsanacion =
  | "observado"
  | "sin-observacion"
  | "subsanado"
  | "pendiente"
  | "no-subsanado";

/** Documento de la matriz que puede incluirse en la subsanación. */
export interface DocumentoSubsanable {
  readonly id: string;
  /** Documento de la matriz de S-03; coincide con su id. */
  readonly requisitoId: string;
  readonly nombre: string;
  readonly clasificacion: ClasificacionDocumento;
  readonly etiquetaClasificacion: string;
  readonly icono: string;
  /** true si el documento afecta el puntaje de la ponderación. */
  readonly afectaPuntaje: boolean;
  /** false para los requisitos bloqueados por el pliego. */
  readonly subsanable: boolean;
  readonly bloqueadoPorPliego: boolean;
  /** Estado de presentación dentro del periodo. */
  readonly estado: EstadoDocumentoSubsanacion;
  readonly motivo?: MotivoObservacionDocumento;
  /** Observación formal al oferente; vacía si no se ha definido. */
  readonly observacion: string;
  /** true si el documento se incluye en el periodo. */
  readonly seleccionado: boolean;
}

/** Oferente incluido (o candidato) en un periodo de subsanación. */
export interface OferenteSubsanacion {
  readonly proveedorId: string;
  readonly invitacionId: string;
  readonly nombre: string;
  readonly nit: string;
  readonly tipoPersona: string;
  /** Representante legal o persona natural que radicó la oferta. */
  readonly representante: string;
  /** Valor total de la oferta en pesos. */
  readonly valor: number;
  readonly documentos: readonly DocumentoSubsanable[];
}

/* ── Autoría y acciones ───────────────────────────────────────────────────── */

/** Autorización de una acción de subsanación (RN-08). */
export interface AutorSubsanacion {
  readonly usuario: string;
  readonly autor: string;
  readonly rol: string;
}

/** Ampliación del plazo de subsanación. */
export interface AmpliacionSubsanacion {
  /** Fecha y hora en que se registró la ampliación (ISO). */
  readonly fecha: string;
  /** Nueva fecha y hora de cierre (ISO). */
  readonly nuevaFecha: string;
  /** Horas adicionales cuando la ampliación es fija (24/48). */
  readonly horas?: number;
  readonly motivo: string;
  readonly usuario: string;
  readonly autor: string;
  readonly rol: string;
}

/** Cancelación del periodo. */
export interface CancelacionSubsanacion {
  readonly fecha: string;
  readonly motivo: string;
  readonly usuario: string;
  readonly autor: string;
  readonly rol: string;
}

/* ── Eventos del historial ────────────────────────────────────────────────── */

/** Naturaleza de un evento de subsanación. */
export type TipoEventoSubsanacion =
  | "periodo-abierto"
  | "documento-cargado"
  | "documento-reemplazado"
  | "periodo-ampliado"
  | "periodo-cancelado"
  | "periodo-vencido"
  | "intento-extemporaneo";

/** Archivo vinculado a un evento de cargue o reemplazo. */
export interface ArchivoSubsanado {
  readonly nombre: string;
  readonly peso: string;
  /** Hash simulado; el backend emitirá el definitivo. */
  readonly hash: string;
}

/** Evento del historial de subsanación. */
export interface EventoSubsanacion {
  readonly id: string;
  readonly tipo: TipoEventoSubsanacion;
  /** Fecha y hora en ISO-8601 con desfase de Colombia. */
  readonly fecha: string;
  readonly usuario: string;
  readonly nombreUsuario?: string;
  readonly rol: string;
  readonly oferenteId?: string;
  readonly oferenteNombre?: string;
  readonly documentoId?: string;
  readonly documentoNombre?: string;
  /** Detalle funcional; puede traer HTML del editor enriquecido. */
  readonly detalleHtml: string;
  /** Justificación escrita por el proveedor o el gestor. */
  readonly justificacion?: string;
  readonly versionAnterior?: ArchivoSubsanado;
  readonly versionNueva?: ArchivoSubsanado;
  readonly hash?: string;
  readonly radicado?: string;
  /** false cuando el evento ocurrió fuera del periodo. */
  readonly dentroDelPeriodo: boolean;
}

/* ── Periodo ──────────────────────────────────────────────────────────────── */

/** Periodo de subsanación documental de una solicitud. */
export interface Subsanacion {
  readonly id: string;
  /** Radicado de la actuación (ACT-SUB-2026-0034). */
  readonly radicado: string;
  readonly solicitudId: string;
  readonly oferentes: readonly OferenteSubsanacion[];
  /** Inicio del periodo en ISO-8601 con desfase de Colombia. */
  readonly inicio: string;
  /** Fin del periodo en ISO-8601 con desfase de Colombia. */
  readonly fin: string;
  /** Mensaje formal para los oferentes (HTML del editor enriquecido). */
  readonly motivoHtml: string;
  readonly notificar: boolean;
  readonly permitirReemplazo: boolean;
  readonly configuradaPor: AutorSubsanacion;
  readonly configuradaEl: string;
  readonly ampliaciones: readonly AmpliacionSubsanacion[];
  readonly cancelacion?: CancelacionSubsanacion;
  readonly eventos: readonly EventoSubsanacion[];
}

/* ── Registro de configuración ────────────────────────────────────────────── */

export interface RegistroDocumentoSubsanacion {
  readonly documentoId: string;
  readonly observacion: string;
}

export interface RegistroOferenteSubsanacion {
  readonly proveedorId: string;
  readonly documentos: readonly RegistroDocumentoSubsanacion[];
}

/** Datos que la pantalla envía al servicio para configurar el periodo. */
export interface RegistroSubsanacion {
  readonly oferentes: readonly RegistroOferenteSubsanacion[];
  readonly inicio: string;
  readonly fin: string;
  readonly motivoHtml: string;
  readonly notificar: boolean;
  readonly permitirReemplazo: boolean;
}

/* ── Resúmenes de seguimiento ─────────────────────────────────────────────── */

export interface DocumentoResumenSubsanacion {
  readonly id: string;
  readonly nombre: string;
  readonly estado: EstadoDocumentoSubsanacion;
  readonly subsanado: boolean;
  readonly noSubsanado: boolean;
}

export interface ResumenOferenteSubsanacion {
  readonly proveedorId: string;
  readonly nombre: string;
  readonly nit: string;
  readonly tipoPersona: string;
  readonly estado: EstadoSubsanacionOferente;
  readonly total: number;
  readonly subsanados: number;
  readonly pendientes: number;
  readonly noSubsanados: number;
  readonly porcentaje: number;
  readonly ultimaModificacion: string | null;
  readonly documentos: readonly DocumentoResumenSubsanacion[];
}

export interface ResumenSubsanacion {
  readonly oferentes: number;
  readonly totalDocumentos: number;
  readonly subsanados: number;
  readonly pendientes: number;
  readonly noSubsanados: number;
  readonly oferentesHabilitados: number;
  readonly porcentaje: number;
  readonly porOferente: readonly ResumenOferenteSubsanacion[];
}

/** Historial completo de un periodo de subsanación. */
export interface HistorialSubsanacion {
  readonly subsanacion: Subsanacion;
  readonly estado: EstadoSubsanacion;
  readonly eventos: readonly EventoSubsanacion[];
  readonly resumen: ResumenSubsanacion;
}

/** Filtros del historial de subsanación (S-12b). */
export interface FiltroHistorialSubsanacion {
  readonly busqueda: string;
  readonly oferenteId: string;
  readonly documentoId: string;
}

/* ── Funciones puras ──────────────────────────────────────────────────────── */

/** Contrato mínimo de la solicitud para construir candidatos. */
export interface SolicitudSubsanable {
  readonly id: string;
  readonly documentos: {
    readonly requeridos: readonly DocumentoOferente[];
  } | null;
}

/**
 * Construye la lista de oferentes con cotización y sus documentos subsanables.
 *
 * Los documentos observados en la semilla llegan seleccionados y con la
 * observación formal precargada. Los oferentes sin observaciones también se
 * incluyen: el gestor puede decidir manualmente qué documentos subsanar.
 */
export function crearOferentesSubsanables(
  solicitud: SolicitudSubsanable,
  oferentes: readonly OferenteTablero[],
): readonly OferenteSubsanacion[] {
  const requeridos = solicitud.documentos?.requeridos ?? [];
  const observaciones = OBSERVACIONES_DOCUMENTALES_MOCK[solicitud.id] ?? {};

  return oferentes
    .filter((oferente) => !!oferente.respuesta)
    .map((oferente) => {
      const identidad = identidadProveedor(oferente.proveedor);
      const porDocumento = observaciones[oferente.proveedor.id] ?? {};
      const documentos = requeridos.map((documento) => {
        const observacion = porDocumento[documento.id];
        const subsanable = documento.subsanable !== false;
        return {
          id: documento.id,
          requisitoId: documento.id,
          nombre: documento.nombre,
          clasificacion: documento.clasificacion,
          etiquetaClasificacion: etiquetaClasificacion(
            documento.clasificacion,
          ),
          icono: documento.icono,
          afectaPuntaje: documento.afectaPuntaje ?? false,
          subsanable,
          bloqueadoPorPliego: !subsanable,
          estado: observacion ? ("observado" as const) : ("sin-observacion" as const),
          motivo: observacion?.motivo,
          observacion: observacion?.observacion ?? "",
          seleccionado: !!observacion && subsanable,
        } satisfies DocumentoSubsanable;
      });

      return {
        proveedorId: oferente.proveedor.id,
        invitacionId: oferente.invitacion.id,
        nombre: oferente.proveedor.nombre,
        nit: oferente.proveedor.nit,
        tipoPersona: identidad.etiquetaTipoPersona,
        representante: identidad.representante,
        valor: oferente.respuesta?.total ?? 0,
        documentos,
      } satisfies OferenteSubsanacion;
    });
}

/** Documentos observados de un oferente candidato. */
export function documentosObservados(
  oferente: OferenteSubsanacion,
): readonly DocumentoSubsanable[] {
  return oferente.documentos.filter(
    (documento) => documento.estado === "observado",
  );
}

/** true si el oferente tiene al menos un documento observado. */
export function tieneObservaciones(oferente: OferenteSubsanacion): boolean {
  return documentosObservados(oferente).length > 0;
}

/** Estado del periodo según sus fechas y su cancelación. */
export function estadoSubsanacion(
  subsanacion: Subsanacion,
  ahora: number = Date.now(),
): EstadoSubsanacion {
  if (subsanacion.cancelacion) {
    return "cancelada";
  }
  if (ahora < Date.parse(subsanacion.inicio)) {
    return "configurada";
  }
  if (ahora >= Date.parse(subsanacion.fin)) {
    return "vencida";
  }
  return "activa";
}

/** Etiqueta legible de un motivo de observación. */
export function etiquetaMotivo(
  motivo: MotivoObservacionDocumento | undefined,
): string {
  switch (motivo) {
    case "vencido":
      return "Vencido";
    case "incompleto":
      return "Incompleto";
    case "ilegible":
      return "Ilegible";
    case "no-aportado":
      return "No aportado";
    default:
      return "";
  }
}

/** Evento de cargue o reemplazo más reciente de un documento. */
export function eventoDocumento(
  subsanacion: Subsanacion,
  oferenteId: string,
  documentoId: string,
): EventoSubsanacion | null {
  return (
    [...subsanacion.eventos]
      .filter(
        (evento) =>
          evento.oferenteId === oferenteId &&
          evento.documentoId === documentoId &&
          (evento.tipo === "documento-cargado" ||
            evento.tipo === "documento-reemplazado"),
      )
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
      .at(0) ?? null
  );
}

/** true si el documento ya fue cargado o reemplazado dentro del periodo. */
export function documentoSubsanado(
  subsanacion: Subsanacion,
  oferenteId: string,
  documentoId: string,
): boolean {
  return !!eventoDocumento(subsanacion, oferenteId, documentoId);
}

/** Estado de un oferente dentro del periodo. */
export function estadoOferenteSubsanacion(
  oferente: OferenteSubsanacion,
  subsanacion: Subsanacion,
  ahora: number = Date.now(),
): EstadoSubsanacionOferente {
  const seleccionados = oferente.documentos.filter(
    (documento) => documento.seleccionado,
  );
  if (seleccionados.length === 0) {
    return "sin-observaciones";
  }

  const subsanados = seleccionados.filter((documento) =>
    documentoSubsanado(subsanacion, oferente.proveedorId, documento.id),
  ).length;

  if (subsanados === seleccionados.length) {
    return "subsanado-completo";
  }
  if (subsanados > 0) {
    return "subsanado-parcial";
  }
  if (estadoSubsanacion(subsanacion, ahora) === "vencida") {
    return "no-subsanado";
  }
  return "en-espera";
}

/** Resumen de un oferente para las tablas de seguimiento. */
export function resumenOferenteSubsanacion(
  subsanacion: Subsanacion,
  oferenteId: string,
  ahora: number = Date.now(),
): ResumenOferenteSubsanacion | null {
  const oferente = subsanacion.oferentes.find(
    (item) => item.proveedorId === oferenteId,
  );
  if (!oferente) {
    return null;
  }

  const seleccionados = oferente.documentos.filter(
    (documento) => documento.seleccionado,
  );
  const estado = estadoOferenteSubsanacion(oferente, subsanacion, ahora);
  const vencida = estadoSubsanacion(subsanacion, ahora) === "vencida";

  const documentos = seleccionados.map((documento) => {
    const subsanado = documentoSubsanado(
      subsanacion,
      oferenteId,
      documento.id,
    );
    return {
      id: documento.id,
      nombre: documento.nombre,
      estado: subsanado
        ? ("subsanado" as const)
        : vencida
          ? ("no-subsanado" as const)
          : ("pendiente" as const),
      subsanado,
      noSubsanado: !subsanado && vencida,
    } satisfies DocumentoResumenSubsanacion;
  });

  const subsanados = documentos.filter((documento) => documento.subsanado).length;
  const noSubsanados = documentos.filter(
    (documento) => documento.noSubsanado,
  ).length;
  const ultimoEvento = [...subsanacion.eventos]
    .filter((evento) => evento.oferenteId === oferenteId)
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    .at(0);

  return {
    proveedorId: oferente.proveedorId,
    nombre: oferente.nombre,
    nit: oferente.nit,
    tipoPersona: oferente.tipoPersona,
    estado,
    total: documentos.length,
    subsanados,
    pendientes: documentos.length - subsanados - noSubsanados,
    noSubsanados,
    porcentaje:
      documentos.length === 0
        ? 0
        : Math.round((subsanados / documentos.length) * 100),
    ultimaModificacion: ultimoEvento
      ? formatoFechaHoraOferente(ultimoEvento.fecha)
      : null,
    documentos,
  };
}

/** Resumen global del periodo. */
export function resumenSubsanacion(
  subsanacion: Subsanacion,
  ahora: number = Date.now(),
): ResumenSubsanacion {
  const porOferente = subsanacion.oferentes
    .map((oferente) =>
      resumenOferenteSubsanacion(subsanacion, oferente.proveedorId, ahora),
    )
    .filter((resumen): resumen is ResumenOferenteSubsanacion => !!resumen);

  const totalDocumentos = porOferente.reduce(
    (total, oferente) => total + oferente.total,
    0,
  );
  const subsanados = porOferente.reduce(
    (total, oferente) => total + oferente.subsanados,
    0,
  );
  const noSubsanados = porOferente.reduce(
    (total, oferente) => total + oferente.noSubsanados,
    0,
  );

  return {
    oferentes: porOferente.length,
    totalDocumentos,
    subsanados,
    pendientes: totalDocumentos - subsanados - noSubsanados,
    noSubsanados,
    oferentesHabilitados: porOferente.filter(
      (oferente) => oferente.estado === "subsanado-completo",
    ).length,
    porcentaje:
      totalDocumentos === 0
        ? 0
        : Math.round((subsanados / totalDocumentos) * 100),
    porOferente,
  };
}

/**
 * Eventos vigentes del periodo.
 *
 * Si el periodo venció y la semilla no guardó el evento de cierre, se agrega
 * uno virtual con la fecha de fin. No se persiste: el estado se deriva de las
 * fechas (RF-16).
 */
export function eventosVigentes(
  subsanacion: Subsanacion,
  ahora: number = Date.now(),
): readonly EventoSubsanacion[] {
  const eventos = [...subsanacion.eventos];
  if (
    estadoSubsanacion(subsanacion, ahora) === "vencida" &&
    !eventos.some((evento) => evento.tipo === "periodo-vencido")
  ) {
    eventos.push({
      id: `${subsanacion.id}-vencimiento`,
      tipo: "periodo-vencido",
      fecha: subsanacion.fin,
      usuario: "sistema",
      nombreUsuario: "Sistema ÁGORA",
      rol: "Automatización institucional",
      detalleHtml:
        "La recepción de subsanaciones se cerró automáticamente por vencimiento del plazo. No se aceptan más adjuntos (RF-19/RF-16).",
      dentroDelPeriodo: false,
    });
  }
  return eventos.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

/** Metadatos visuales de un evento de subsanación. */
export interface MetaEventoSubsanacion {
  readonly titulo: string;
  readonly icono: string;
  readonly tono: "primario" | "destacado" | "neutro" | "exito" | "error";
  readonly etiqueta: string;
  readonly resultado: string;
  readonly tonoResultado:
    | "neutro"
    | "exito"
    | "advertencia"
    | "primario";
}

/** Título, icono y chips de un evento del historial. */
export function metaEventoSubsanacion(
  tipo: TipoEventoSubsanacion,
): MetaEventoSubsanacion {
  switch (tipo) {
    case "periodo-abierto":
      return {
        titulo: "Periodo de subsanación habilitado",
        icono: "campaign",
        tono: "primario",
        etiqueta: "Habilitación formal",
        resultado: "Periodo abierto",
        tonoResultado: "primario",
      };
    case "documento-cargado":
      return {
        titulo: "Documento cargado",
        icono: "upload_file",
        tono: "exito",
        etiqueta: "Cargue",
        resultado: "Dentro del periodo",
        tonoResultado: "exito",
      };
    case "documento-reemplazado":
      return {
        titulo: "Documento reemplazado",
        icono: "sync",
        tono: "exito",
        etiqueta: "Reemplazo",
        resultado: "Dentro del periodo",
        tonoResultado: "exito",
      };
    case "periodo-ampliado":
      return {
        titulo: "Plazo de subsanación ampliado",
        icono: "update",
        tono: "destacado",
        etiqueta: "Ampliación",
        resultado: "Plazo ampliado",
        tonoResultado: "primario",
      };
    case "periodo-cancelado":
      return {
        titulo: "Periodo de subsanación cancelado",
        icono: "cancel",
        tono: "destacado",
        etiqueta: "Cancelación",
        resultado: "Periodo cancelado",
        tonoResultado: "advertencia",
      };
    case "periodo-vencido":
      return {
        titulo: "Periodo de subsanación vencido",
        icono: "lock_clock",
        tono: "neutro",
        etiqueta: "Cierre automático",
        resultado: "Periodo cerrado",
        tonoResultado: "neutro",
      };
    case "intento-extemporaneo":
      return {
        titulo: "Intento de cargue extemporáneo rechazado",
        icono: "block",
        tono: "error",
        etiqueta: "Fuera del periodo",
        resultado: "No incorporado al expediente",
        tonoResultado: "advertencia",
      };
  }
}

/* ── Semillas simuladas ───────────────────────────────────────────────────── */

interface ObservacionDocumentalMock {
  readonly motivo: MotivoObservacionDocumento;
  readonly observacion: string;
}

const OBSERVACIONES_DOCUMENTALES_MOCK: Readonly<
  Record<
    string,
    Readonly<
      Record<string, Readonly<Record<string, ObservacionDocumentalMock>>>
    >
  >
> = {
  "SOL-2026-0039": {
    "prov-01": {
      "doc-rut": {
        motivo: "vencido",
        observacion:
          "El RUT aportado no corresponde a la vigencia 2026; adjuntar el documento actualizado con la actividad económica del objeto.",
      },
      "doc-catalogo-tecnico": {
        motivo: "incompleto",
        observacion:
          "La ficha técnica no incluye la firma del fabricante; remitir la versión completa con la garantía on-site.",
      },
    },
    "prov-02": {
      "doc-certificacion-bancaria": {
        motivo: "ilegible",
        observacion:
          "La copia escaneada no permite leer el número de cuenta; remitir una certificación bancaria legible y vigente.",
      },
    },
  },
  "SOL-2026-0160": {
    "prov-01": {
      "doc-rut": {
        motivo: "vencido",
        observacion:
          "El RUT aportado no corresponde a la vigencia 2026; adjuntar el documento actualizado.",
      },
    },
    "prov-02": {
      "doc-catalogo-tecnico": {
        motivo: "incompleto",
        observacion:
          "La ficha técnica no incluye la firma del fabricante; remitir la versión completa.",
      },
    },
  },
  "SOL-2026-0161": {
    "prov-01": {
      "doc-rut": {
        motivo: "vencido",
        observacion:
          "El RUT aportado corresponde a la vigencia anterior; adjuntar el documento actualizado.",
      },
      "doc-catalogo-tecnico": {
        motivo: "incompleto",
        observacion:
          "Falta la firma digitalizada del fabricante autorizando la garantía on-site de 36 meses.",
      },
    },
    "prov-02": {
      "doc-certificacion-bancaria": {
        motivo: "ilegible",
        observacion:
          "La certificación bancaria no es legible; remitir una copia emitida en los últimos 30 días.",
      },
    },
  },
};

/** Fecha ISO relativa a hoy, a las horas indicadas, con desfase de Colombia. */
function isoRelativo(dias: number, hora: number, minuto: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}T${String(hora).padStart(2, "0")}:${String(
    minuto,
  ).padStart(2, "0")}:00-05:00`;
}

/** Documento de semilla con su estado dentro del periodo. */
function documentoSeed(
  id: string,
  nombre: string,
  clasificacion: ClasificacionDocumento,
  icono: string,
  observacion: string,
  motivo: MotivoObservacionDocumento,
  afectaPuntaje = false,
): DocumentoSubsanable {
  return {
    id,
    requisitoId: id,
    nombre,
    clasificacion,
    etiquetaClasificacion: etiquetaClasificacion(clasificacion),
    icono,
    afectaPuntaje,
    subsanable: true,
    bloqueadoPorPliego: false,
    estado: "observado",
    motivo,
    observacion,
    seleccionado: true,
  };
}

const OFERENTE_SEMILLA_0160: readonly OferenteSubsanacion[] = [
  {
    proveedorId: "prov-01",
    invitacionId: "INV-0160-01",
    nombre: "Redes y Servidores de Colombia S.A.S.",
    nit: "900.842.119-4",
    tipoPersona: "Persona jurídica",
    representante: "Mauricio Cárdenas",
    valor: 254_200_000,
    documentos: [
      documentoSeed(
        "doc-rut",
        "RUT actualizado (Vigencia 2026)",
        "obligatorio",
        "badge",
        "El RUT aportado no corresponde a la vigencia 2026; adjuntar el documento actualizado.",
        "vencido",
      ),
    ],
  },
  {
    proveedorId: "prov-02",
    invitacionId: "INV-0160-02",
    nombre: "Soluciones Tecnológicas Universitarias LTDA",
    nit: "830.501.993-2",
    tipoPersona: "Persona jurídica",
    representante: "Claudia Marcela Silva",
    valor: 268_500_000,
    documentos: [
      documentoSeed(
        "doc-catalogo-tecnico",
        "Catálogo técnico o brochures de los bienes ofrecidos",
        "complementario",
        "menu_book",
        "La ficha técnica no incluye la firma del fabricante; remitir la versión completa.",
        "incompleto",
        true,
      ),
    ],
  },
];

const OFERENTE_SEMILLA_0161: readonly OferenteSubsanacion[] = [
  {
    proveedorId: "prov-01",
    invitacionId: "INV-0161-01",
    nombre: "Redes y Servidores de Colombia S.A.S.",
    nit: "900.842.119-4",
    tipoPersona: "Persona jurídica",
    representante: "Mauricio Cárdenas",
    valor: 254_200_000,
    documentos: [
      documentoSeed(
        "doc-rut",
        "RUT actualizado (Vigencia 2026)",
        "obligatorio",
        "badge",
        "El RUT aportado corresponde a la vigencia anterior; adjuntar el documento actualizado.",
        "vencido",
      ),
      documentoSeed(
        "doc-catalogo-tecnico",
        "Catálogo técnico o brochures de los bienes ofrecidos",
        "complementario",
        "menu_book",
        "Falta la firma digitalizada del fabricante autorizando la garantía on-site de 36 meses.",
        "incompleto",
        true,
      ),
    ],
  },
  {
    proveedorId: "prov-02",
    invitacionId: "INV-0161-02",
    nombre: "Soluciones Tecnológicas Universitarias LTDA",
    nit: "830.501.993-2",
    tipoPersona: "Persona jurídica",
    representante: "Claudia Marcela Silva",
    valor: 268_500_000,
    documentos: [
      documentoSeed(
        "doc-certificacion-bancaria",
        "Certificación bancaria (no mayor a 30 días)",
        "obligatorio",
        "account_balance",
        "La certificación bancaria no es legible; remitir una copia emitida en los últimos 30 días.",
        "ilegible",
      ),
    ],
  },
];

const AUTOR_SEMILLA: AutorSubsanacion = {
  usuario: "raquimbayap",
  autor: "Raúl Quimbaya",
  rol: "Jefe de Dependencia",
};

/** Periodo activo de demostración (SOL-2026-0160). */
const SUBSANACION_0160: Subsanacion = {
  id: "subsanacion-0160",
  radicado: "ACT-SUB-2026-0034",
  solicitudId: "SOL-2026-0160",
  oferentes: OFERENTE_SEMILLA_0160,
  inicio: isoRelativo(-1, 8, 0),
  fin: isoRelativo(2, 17, 0),
  motivoHtml:
    "<p>Apreciados oferentes: se habilita el periodo de subsanación para allegar las aclaraciones y documentos observados. Una vez vencido el plazo, el sistema cerrará la recepción sin excepciones.</p>",
  notificar: true,
  permitirReemplazo: true,
  configuradaPor: AUTOR_SEMILLA,
  configuradaEl: isoRelativo(-1, 8, 5),
  ampliaciones: [],
  eventos: [
    {
      id: "evento-0160-apertura",
      tipo: "periodo-abierto",
      fecha: isoRelativo(-1, 8, 5),
      usuario: AUTOR_SEMILLA.usuario,
      nombreUsuario: AUTOR_SEMILLA.autor,
      rol: AUTOR_SEMILLA.rol,
      detalleHtml:
        "Apertura formal del periodo de subsanación con notificación simulada a <strong>2 proponentes</strong> (RF-13).",
      radicado: "ACT-SUB-2026-0034",
      dentroDelPeriodo: true,
    },
    {
      id: "evento-0160-cargue",
      tipo: "documento-cargado",
      fecha: isoRelativo(0, 10, 14),
      usuario: "mcardenas",
      nombreUsuario: "Mauricio Cárdenas",
      rol: "Representante Legal · Proveedor",
      oferenteId: "prov-01",
      oferenteNombre: "Redes y Servidores de Colombia S.A.S.",
      documentoId: "doc-rut",
      documentoNombre: "RUT actualizado (Vigencia 2026)",
      detalleHtml:
        "El proveedor cargó el RUT actualizado con corte a la vigencia 2026.",
      justificacion:
        "Se anexa RUT actualizado con la actividad económica del objeto contractual.",
      versionNueva: {
        nombre: "RUT_9008421194_2026.pdf",
        peso: "1.4 MB",
        hash: "7f8b9e4a01cc8b92d6e3f21a8b1",
      },
      hash: "SHA-256: 7f8b9e4a01cc8b92d6e3f21a8b1",
      dentroDelPeriodo: true,
    },
  ],
};

/** Periodo vencido con historial extenso (SOL-2026-0161). */
const SUBSANACION_0161: Subsanacion = {
  id: "subsanacion-0161",
  radicado: "ACT-SUB-2026-0041",
  solicitudId: "SOL-2026-0161",
  oferentes: OFERENTE_SEMILLA_0161,
  inicio: "2026-10-21T08:00:00-05:00",
  fin: "2026-10-23T17:00:00-05:00",
  motivoHtml:
    "<p>Apreciados oferentes: se habilita el periodo de subsanación para corregir los documentos observados. La recepción cierra el 23/10/2026 a las 17:00 COT.</p>",
  notificar: true,
  permitirReemplazo: true,
  configuradaPor: AUTOR_SEMILLA,
  configuradaEl: "2026-10-21T08:30:00-05:00",
  ampliaciones: [],
  eventos: [
    {
      id: "evento-0161-apertura",
      tipo: "periodo-abierto",
      fecha: "2026-10-21T08:30:00-05:00",
      usuario: AUTOR_SEMILLA.usuario,
      nombreUsuario: AUTOR_SEMILLA.autor,
      rol: AUTOR_SEMILLA.rol,
      detalleHtml:
        "Apertura formal de la ventana de subsanación con notificación simulada a <strong>2 proponentes</strong> con observaciones preliminares.",
      radicado: "ACT-SUB-2026-0041",
      dentroDelPeriodo: true,
    },
    {
      id: "evento-0161-cargue",
      tipo: "documento-cargado",
      fecha: "2026-10-22T11:15:04-05:00",
      usuario: "mcardenas",
      nombreUsuario: "Mauricio Cárdenas",
      rol: "Representante Legal · Proveedor",
      oferenteId: "prov-01",
      oferenteNombre: "Redes y Servidores de Colombia S.A.S.",
      documentoId: "doc-catalogo-tecnico",
      documentoNombre:
        "Catálogo técnico o brochures de los bienes ofrecidos",
      detalleHtml:
        "Se cargó la ficha técnica con la firma digitalizada del mayorista.",
      justificacion:
        "Soporte subsanado con firma digitalizada del mayorista autorizando soporte on-site 36 meses.",
      versionNueva: {
        nombre: "anexo_tecnico_blade_dell_firmado_mayorista.pdf",
        peso: "3.6 MB",
        hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
      },
      hash: "SHA-256: a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
      dentroDelPeriodo: true,
    },
    {
      id: "evento-0161-reemplazo",
      tipo: "documento-reemplazado",
      fecha: "2026-10-22T14:32:10-05:00",
      usuario: "mcardenas",
      nombreUsuario: "Mauricio Cárdenas",
      rol: "Representante Legal · Proveedor",
      oferenteId: "prov-01",
      oferenteNombre: "Redes y Servidores de Colombia S.A.S.",
      documentoId: "doc-rut",
      documentoNombre: "RUT actualizado (Vigencia 2026)",
      detalleHtml:
        "Se reemplazó el RUT anterior por la versión vigente 2026.",
      justificacion:
        "Se anexa certificación con corte al 20/10/2026 suscrita por Revisor Fiscal.",
      versionAnterior: {
        nombre: "RUT_9008421194_2025.pdf",
        peso: "1.4 MB",
        hash: "c0ffee00c0ffee00c0ffee00c0ff",
      },
      versionNueva: {
        nombre: "RUT_9008421194_2026_actualizado.pdf",
        peso: "1.8 MB",
        hash: "7f8b9e4a01cc8b92d6e3f21a8b1",
      },
      hash: "SHA-256: 7f8b9e4a01cc8b92d6e3f21a8b1",
      dentroDelPeriodo: true,
    },
    {
      id: "evento-0161-extemporaneo",
      tipo: "intento-extemporaneo",
      fecha: "2026-10-23T17:42:15-05:00",
      usuario: "csilva",
      nombreUsuario: "Claudia Marcela Silva",
      rol: "Representante Legal · Proveedor",
      oferenteId: "prov-02",
      oferenteNombre: "Soluciones Tecnológicas Universitarias LTDA",
      documentoId: "doc-certificacion-bancaria",
      documentoNombre: "Certificación bancaria (no mayor a 30 días)",
      detalleHtml:
        "El intento de cargue fue bloqueado automáticamente por vencimiento del plazo (17:00:00 COT).",
      versionNueva: {
        nombre: "certificacion_bancaria_bancolombia_nov2026.pdf",
        peso: "890 KB",
        hash: "deadbeefdeadbeefdeadbeefdead",
      },
      hash: "SHA-256: deadbeefdeadbeefdeadbeefdead",
      dentroDelPeriodo: false,
    },
    {
      id: "evento-0161-vencimiento",
      tipo: "periodo-vencido",
      fecha: "2026-10-23T17:00:00-05:00",
      usuario: "sistema",
      nombreUsuario: "Sistema ÁGORA",
      rol: "Automatización institucional",
      detalleHtml:
        "La recepción de subsanaciones se cerró automáticamente por vencimiento del plazo. No se aceptan más adjuntos (RF-19/RF-16).",
      dentroDelPeriodo: false,
    },
  ],
};

/** Periodos simulados por solicitud. */
export const SUBSANACIONES_MOCK: Readonly<
  Record<string, readonly Subsanacion[]>
> = {
  "SOL-2026-0160": [SUBSANACION_0160],
  "SOL-2026-0161": [SUBSANACION_0161],
};
