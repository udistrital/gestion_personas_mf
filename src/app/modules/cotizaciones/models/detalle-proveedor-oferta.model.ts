/**
 * Modelo del detalle del proveedor y de su oferta (S-10).
 *
 * Es una proyección de lectura: no duplica `Solicitud`, `InvitacionProveedor`
 * ni la respuesta de P-04. Compone el `OferenteTablero` de S-07, la
 * `OfertaComparada` de S-09 y la matriz documental de S-03, y añade solo los
 * datos de presentación que la pantalla necesita (documentos radicados,
 * historial, navegación y concordancia CIIU).
 *
 * Las plantillas no calculan: este módulo resuelve nombres de archivo,
 * tamaños, fechas de vigencia, actividades y eventos.
 */

import type {
  DocumentoOferente,
  DocumentoOfertaRadicado,
} from "./documentos.model";
import {
  etiquetaClasificacion,
  etiquetaFormato,
  iconoPorFormato,
} from "./documentos.model";
import type { OfertaComparada } from "./comparativo.model";
import type { OferenteTablero } from "./oferente.model";
import { identidadProveedor } from "./proveedores.model";
import type { ProveedorObjetivo } from "./proveedores.model";
import {
  ACTIVIDADES_CIIU,
  etiquetaNucleoSnies,
  indiceProveedor,
} from "./proveedores.model";
import { esFormatoSoporteOferta } from "./respuesta-proveedor.model";
import type { SolicitudDetalle } from "./solicitud.model";
import { formatoTamano } from "./items.model";

/* ── Documentos de la oferta ──────────────────────────────────────────────── */

/**
 * El tipo del documento radicado vive en `documentos.model.ts` porque también
 * lo usa P-06. Se reexporta para no cambiar las importaciones de S-10.
 */
export type {
  DocumentoOfertaRadicado,
  EstadoDocumentoOferta,
} from "./documentos.model";

/** Resultado de pedir un documento de la oferta al servicio simulado. */
export interface DocumentoOfertaResuelto {
  readonly documento: DocumentoOfertaRadicado;
  readonly disponible: boolean;
  readonly mensaje: string;
}

/* ── Historial de la oferta ────────────────────────────────────────────────── */

/** Tono del nodo de un evento de la oferta. */
export type TonoEventoOferta = "primario" | "destacado" | "neutro";

/** Evento de la oferta (radicación, adenda o futura subsanación). */
export interface EventoOferta {
  readonly id: string;
  readonly titulo: string;
  readonly detalleHtml: string;
  readonly fecha: string;
  readonly fechaIso: string;
  readonly icono: string;
  readonly tono: TonoEventoOferta;
  readonly etiqueta: string;
  readonly resultado: string;
  readonly autor: string;
  readonly rol: string;
  readonly evidencia?: {
    readonly icono: string;
    readonly texto: string;
  };
}

/* ── Navegación entre oferentes ────────────────────────────────────────────── */

/** Referencia mínima para el botón anterior/siguiente. */
export interface ReferenciaOferente {
  readonly id: string;
  readonly nombre: string;
}

/** Posición del oferente dentro del tablero y vecinos disponibles. */
export interface NavegacionOferentes {
  /** Posición 1-based. */
  readonly indice: number;
  readonly total: number;
  readonly anterior: ReferenciaOferente | null;
  readonly siguiente: ReferenciaOferente | null;
}

/* ── Concordancia CIIU ────────────────────────────────────────────────────── */

/** Actividad del proveedor frente a la segmentación de la solicitud. */
export interface ActividadProveedorDetalle {
  readonly codigo: string;
  readonly descripcion: string;
  readonly clase: string;
  /** true si el código está dentro de la segmentación de la solicitud. */
  readonly coincide: boolean;
}

/* ── Proyección completa ──────────────────────────────────────────────────── */

/** Todo lo que pinta la pantalla de S-10 para un oferente. */
export interface DetalleProveedorOferta {
  readonly oferente: OferenteTablero;
  /** `null` cuando el invitado no presentó oferta. */
  readonly oferta: OfertaComparada | null;
  readonly documentos: readonly DocumentoOfertaRadicado[];
  readonly historial: readonly EventoOferta[];
  readonly navegacion: NavegacionOferentes;
  readonly actividades: readonly ActividadProveedorDetalle[];
  readonly nucleoSnies: string;
  readonly requiereIdoneidad: boolean;
  readonly seleccionado: boolean;
  /** Nombre del proveedor preseleccionado distinto del actual; `null` si no hay otro. */
  readonly preseleccionadoNombre: string | null;
  readonly versionAnterior: string | null;
  readonly versionVigente: string;
  readonly fechaLimiteOferta: string | null;
  readonly fechaLimiteOfertaIso: string | null;
}

/* ── Construcción ─────────────────────────────────────────────────────────── */

/** Pesos simulados de los documentos, estables por posición. */
const PESOS_DOCUMENTO: readonly number[] = [
  2.4 * 1024 * 1024,
  840 * 1024,
  1.2 * 1024 * 1024,
  3.1 * 1024 * 1024,
  640 * 1024,
];

/**
 * Construye la proyección de S-10.
 *
 * `oferta` llega de `construirComparativo` para reutilizar ranking, totales y
 * diferencia frente al CDP; `null` si el oferente no respondió.
 */
export function construirDetalleProveedorOferta(
  solicitud: SolicitudDetalle,
  oferente: OferenteTablero,
  oferentes: readonly OferenteTablero[],
  indice: number,
  oferta: OfertaComparada | null,
  seleccionadoId: string | null,
): DetalleProveedorOferta {
  const respuesta = oferente.respuesta;
  const adenda = oferente.invitacion.adendaPublicada;
  const limite = oferta
    ? fechaLimiteOferta(
        respuesta?.fechaEnvioIso,
        oferta.oferta.validezDias,
      )
    : null;
  const preseleccionado =
    seleccionadoId && seleccionadoId !== oferente.proveedor.id
      ? oferentes.find(
          (item) => item.proveedor.id === seleccionadoId,
        )?.proveedor.nombre ?? null
      : null;

  return {
    oferente,
    oferta,
    documentos: oferta ? crearDocumentosOferta(solicitud, oferente, oferta) : [],
    historial: respuesta ? crearHistorialOferta(oferente, oferta) : [],
    navegacion: crearNavegacionOferentes(oferentes, indice),
    actividades: crearActividadesProveedor(solicitud, oferente.proveedor),
    nucleoSnies: etiquetaNucleoSnies(
      solicitud.proveedores?.segmentacion.nucleoSnies ?? "",
    ) || "No aplica",
    requiereIdoneidad: !!solicitud.proveedores?.requiereIdoneidad,
    seleccionado: oferente.proveedor.id === seleccionadoId,
    preseleccionadoNombre: preseleccionado,
    versionAnterior: adenda?.versionAnterior ?? null,
    versionVigente: respuesta?.version ?? adenda?.versionVigente ?? "",
    fechaLimiteOferta: limite?.texto ?? null,
    fechaLimiteOfertaIso: limite?.iso ?? null,
  };
}

/** Documentos radicados: la matriz de S-03 más el anexo técnico de la oferta. */
export function crearDocumentosOferta(
  solicitud: SolicitudDetalle,
  oferente: OferenteTablero,
  oferta: OfertaComparada,
): readonly DocumentoOfertaRadicado[] {
  const requeridos = solicitud.documentos?.requeridos ?? [];
  const principal = requeridos.find((documento) => documento.fijo) ?? requeridos[0];
  const respuesta = oferente.respuesta;
  const fecha = respuesta?.fechaEnvio ?? oferta.fechaEnvio;
  const indice = indiceProveedor(oferente.proveedor);
  const version = respuesta?.version ?? oferta.version;

  const documentos = requeridos.map((documento, posicion) => {
    const nombreArchivo = nombreArchivoDocumento(
      documento,
      oferente.proveedor,
      indice,
      version,
    );
    const pesoBytes = PESOS_DOCUMENTO[posicion % PESOS_DOCUMENTO.length];
    return {
      id: documento.id,
      requisitoId: documento.id,
      nombre: documento.nombre,
      nombreArchivo,
      clasificacion: documento.clasificacion,
      etiquetaClasificacion: etiquetaClasificacion(documento.clasificacion),
      formato: etiquetaFormato(nombreArchivo),
      icono: iconoPorFormato(nombreArchivo),
      estado: "cargado" as const,
      fechaRadicacion: fecha,
      pesoBytes,
      peso: formatoTamano(pesoBytes),
      descripcion: documento.instruccion,
      principal: documento.id === principal?.id,
      formatoValido: esFormatoSoporteOferta(nombreArchivo),
    };
  });

  const anexo = oferta.oferta.anexoTecnico;
  if (!anexo) {
    return documentos;
  }

  const pesoAnexo = PESOS_DOCUMENTO[(documentos.length + 1) % PESOS_DOCUMENTO.length];
  return [
    ...documentos,
    {
      id: "anexo-tecnico",
      requisitoId: null,
      nombre: "Anexo técnico y ficha de la oferta",
      nombreArchivo: anexo,
      clasificacion: "complementario",
      etiquetaClasificacion: etiquetaClasificacion("complementario"),
      formato: etiquetaFormato(anexo),
      icono: iconoPorFormato(anexo),
      estado: "cargado",
      fechaRadicacion: fecha,
      pesoBytes: pesoAnexo,
      peso: formatoTamano(pesoAnexo),
      descripcion: "Anexo técnico radicado junto con la cotización.",
      principal: false,
      formatoValido: esFormatoSoporteOferta(anexo),
    },
  ];
}

/** Nombre determinista del archivo de un requisito. */
function nombreArchivoDocumento(
  documento: DocumentoOferente,
  proveedor: ProveedorObjetivo,
  indice: number,
  version: string,
): string {
  const slug = slugProveedor(proveedor.nombre);
  const nit = proveedor.nit.replace(/[^a-zA-Z0-9]/g, "");
  switch (documento.id) {
    case "doc-cotizacion-propia":
      return `Cotizacion_${slug}_${version}.pdf`;
    case "doc-rut":
      return `RUT_${nit}.pdf`;
    case "doc-certificacion-bancaria":
      return `Certificacion_Bancaria_${nit}.pdf`;
    case "doc-catalogo-tecnico":
      return `Catalogo_Tecnico_${slug}.${indice % 2 === 0 ? "docx" : "xlsx"}`;
    default:
      return `${slug}_${documento.id}.pdf`;
  }
}

/** Slug estable para nombres de archivo. */
function slugProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(s\.a\.s\.?|sas|ltda\.?|s\.a\.?|sa|e\.s\.p\.?)\b/gi, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36) || "proveedor";
}

/** Historial de la oferta, del evento más reciente al más antiguo. */
export function crearHistorialOferta(
  oferente: OferenteTablero,
  oferta: OfertaComparada | null,
): readonly EventoOferta[] {
  const respuesta = oferente.respuesta;
  if (!respuesta) {
    return [];
  }

  const identidad = identidadProveedor(oferente.proveedor);
  const eventos: EventoOferta[] = [
    {
      id: `${oferente.id}-radicacion`,
      titulo: "Oferta radicada en la plataforma",
      detalleHtml: `<p>Respuesta radicada con el radicado <strong>${respuesta.radicado}</strong> y la versión <strong>${respuesta.version}</strong>.</p><p>La respuesta es única e inmutable (RN-35/RN-42).</p>`,
      fecha: respuesta.fechaEnvio,
      fechaIso: respuesta.fechaEnvioIso,
      icono: "upload_file",
      tono: "primario",
      etiqueta: "Radicación",
      resultado: "Radicada",
      autor: identidad.representante,
      rol: "Proveedor",
      evidencia: {
        icono: "fingerprint",
        texto: `Radicado ${respuesta.radicado}`,
      },
    },
  ];

  const adenda = oferente.invitacion.adendaPublicada;
  if (adenda && respuesta.modificadaEl) {
    eventos.push({
      id: `${oferente.id}-adenda`,
      titulo: "Adenda radicada",
      detalleHtml: `<p>Se radicó la versión <strong>${adenda.versionVigente}</strong> en reemplazo de <strong>${adenda.versionAnterior}</strong>.</p><p>El ajuste conserva la oferta formal y queda sujeto a la verificación documental.</p>`,
      fecha: respuesta.modificadaEl,
      fechaIso: respuesta.modificadaElIso ?? "",
      icono: "history_edu",
      tono: "destacado",
      etiqueta: "Adenda",
      resultado: "Versión vigente",
      autor: identidad.representante,
      rol: "Proveedor",
      evidencia: {
        icono: "description",
        texto: adenda.anexoId,
      },
    });
  }

  return eventos.sort((a, b) => b.fechaIso.localeCompare(a.fechaIso));
}

/** Posición y vecinos del oferente dentro del tablero. */
export function crearNavegacionOferentes(
  oferentes: readonly OferenteTablero[],
  indice: number,
): NavegacionOferentes {
  const referencia = (oferente: OferenteTablero): ReferenciaOferente => ({
    id: oferente.proveedor.id,
    nombre: oferente.proveedor.nombre,
  });

  return {
    indice: indice + 1,
    total: oferentes.length,
    anterior: indice > 0 ? referencia(oferentes[indice - 1]) : null,
    siguiente:
      indice < oferentes.length - 1
        ? referencia(oferentes[indice + 1])
        : null,
  };
}

/** Actividades CIIU del proveedor con su concordancia con el objeto. */
export function crearActividadesProveedor(
  solicitud: SolicitudDetalle,
  proveedor: ProveedorObjetivo,
): readonly ActividadProveedorDetalle[] {
  const codigosObjeto = new Set(
    solicitud.proveedores?.segmentacion.actividades.map(
      (actividad) => actividad.codigo,
    ) ?? [],
  );

  return proveedor.actividades.map((codigo) => {
    const catalogo = ACTIVIDADES_CIIU.find(
      (actividad) => actividad.codigo === codigo,
    );
    return {
      codigo,
      descripcion:
        catalogo?.descripcion ??
        "Actividad económica registrada en el banco de proveedores UD.",
      clase: catalogo?.clase ?? "Por definir",
      coincide: codigosObjeto.has(codigo),
    };
  });
}

/** Fecha de vencimiento declarada de la oferta. */
export function fechaLimiteOferta(
  fechaEnvioIso: string | undefined,
  dias: number,
): { texto: string; iso: string } | null {
  if (!fechaEnvioIso) {
    return null;
  }

  const fecha = new Date(fechaEnvioIso);
  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  fecha.setDate(fecha.getDate() + dias);
  const iso = fecha.toISOString().slice(0, 10);
  const texto = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(fecha);

  return { texto, iso };
}
