/**
 * Proyección de lectura de «Mi cotización» (P-06).
 *
 * Compone el detalle autorizado de la invitación (P-02) con la respuesta
 * radicada por el proveedor (P-04/P-05) para que la pantalla no calcule nada.
 * No duplica el modelo de la respuesta ni el versionado: los reutiliza y solo
 * añade los datos de presentación que la vista necesita (filas liquidadas,
 * documentos con su clasificación, historial y fechas legibles).
 */

import type { EstadoActualizacionRespuesta } from "src/app/core/constants/estados-solicitud.const";
import type {
  EtiquetaLineaTiempo,
  EventoLineaTiempo,
} from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import type {
  DocumentoOfertaRadicado,
  DocumentoOferente,
} from "./documentos.model";
import {
  etiquetaClasificacion,
  etiquetaFormato,
  iconoPorFormato,
} from "./documentos.model";
import type { DetalleInvitacionProveedor } from "./invitacion-proveedor.model";
import type { ItemSolicitud } from "./items.model";
import { formatoTamano } from "./items.model";
import { formatoCop } from "./necesidad.model";
import { formatoFechaHoraOferente } from "./oferente.model";
import type {
  DocumentoRespuestaProveedor,
  FilaOfertaRespuesta,
  RespuestaProveedor,
  TotalesRespuestaProveedor,
} from "./respuesta-proveedor.model";
import {
  construirFilasOferta,
  esFormatoSoporteOferta,
} from "./respuesta-proveedor.model";
import { solicitudCerrada } from "./solicitud.model";

/** Documento del soporte principal de la cotización. */
const REQUISITO_SOPORTE = "soporte-cotizacion";

/** Una versión radicada, lista para el selector informativo de la vista. */
export interface VersionMiCotizacion {
  readonly version: string;
  readonly revision: number;
  readonly radicado: string;
  readonly fechaIso: string;
  readonly fecha: string;
  readonly versionSolicitud: string;
  readonly total: number;
  readonly totalTexto: string;
  readonly usuario: string;
  /** true para la versión que hoy consulta el proveedor. */
  readonly vigente: boolean;
}

/** Todo lo que pinta P-06 para una respuesta radicada. */
export interface MiCotizacion {
  readonly solicitudId: string;
  readonly titulo: string;
  readonly dependencia: string;
  readonly versionSolicitud: string;
  readonly cierre: string | null;
  readonly cerrada: boolean;
  readonly respuesta: RespuestaProveedor;
  readonly filas: readonly FilaOfertaRespuesta[];
  readonly totales: TotalesRespuestaProveedor;
  readonly documentos: readonly DocumentoOfertaRadicado[];
  readonly documentosRadicados: number;
  readonly versiones: readonly VersionMiCotizacion[];
  readonly eventos: readonly EventoLineaTiempo[];
  readonly versionVigente: string;
  readonly radicado: string;
  readonly hash: string;
  readonly fechaRadicacionIso: string;
  readonly fechaRadicacion: string;
  readonly fechaVencimiento: string;
  readonly fechaVencimientoIso: string;
  readonly diasVigencia: number | null;
  readonly estadoActualizacion: EstadoActualizacionRespuesta;
  readonly excedePresupuesto: boolean;
}

/** Construye la proyección de P-06. */
export function construirMiCotizacion(
  detalle: DetalleInvitacionProveedor,
  respuesta: RespuestaProveedor,
  estadoActualizacion: EstadoActualizacionRespuesta,
): MiCotizacion {
  const solicitud = detalle.solicitud;
  const items = itemsDeLaRespuesta(detalle, respuesta);
  const filas = construirFilasOferta(
    items,
    respuesta.items,
    respuesta.descuentoPorcentaje,
  );
  const totales = sumarFilas(filas);
  const fechaRadicacionIso =
    respuesta.fechaActualizacion ??
    respuesta.fechaRadicacion ??
    new Date().toISOString();
  const versiones = versionesDeLaRespuesta(respuesta).map((version) =>
    version.vigente
      ? {
          ...version,
          total: totales.total,
          totalTexto: formatoCop(totales.total),
        }
      : version,
  );
  const presupuesto = solicitud.presupuesto?.valorCdp ?? null;
  const documentos = documentosDeLaRespuesta(detalle, respuesta);

  return {
    solicitudId: solicitud.id,
    titulo: solicitud.titulo,
    dependencia: solicitud.dependencia,
    versionSolicitud: solicitud.version,
    cierre: solicitud.cierre,
    cerrada: solicitudCerrada(solicitud),
    respuesta,
    filas,
    totales,
    documentos,
    documentosRadicados: documentos.filter(
      (documento) => documento.estado !== "pendiente",
    ).length,
    versiones,
    eventos: eventosDeLaRespuesta(
      detalle,
      respuesta,
      versiones,
      totales.total,
    ),
    versionVigente: respuesta.version,
    radicado: respuesta.radicado ?? "Por definir",
    hash: respuesta.hash ?? "",
    fechaRadicacionIso,
    fechaRadicacion: formatoFechaHoraOferente(fechaRadicacionIso),
    fechaVencimiento: fechaLarga(respuesta.fechaVencimiento),
    fechaVencimientoIso: respuesta.fechaVencimiento,
    diasVigencia: diasDeVigencia(solicitud.cierre, respuesta.fechaVencimiento),
    estadoActualizacion,
    excedePresupuesto:
      presupuesto !== null && presupuesto > 0 && totales.total > presupuesto,
  };
}

/**
 * Ítems sobre los que se liquidó la oferta.
 *
 * Una respuesta desactualizada se radicó sobre la versión anterior de la
 * solicitud; la fotografía de la adenda conserva esos ítems para que el
 * histórico siga mostrando lo que realmente se ofertó. Si no hay adenda se usa
 * la versión vigente.
 */
export function itemsDeLaRespuesta(
  detalle: DetalleInvitacionProveedor,
  respuesta: RespuestaProveedor,
): readonly ItemSolicitud[] {
  if (respuesta.versionSolicitudRespondida === detalle.solicitud.version) {
    return detalle.solicitud.items;
  }
  return detalle.adenda?.itemsAnteriores ?? detalle.solicitud.items;
}

/** Suma las filas ya liquidadas para que tabla y tarjetas coincidan. */
function sumarFilas(
  filas: readonly FilaOfertaRespuesta[],
): TotalesRespuestaProveedor {
  const subtotal = filas.reduce((total, fila) => total + fila.subtotal, 0);
  const baseGravable = filas.reduce(
    (total, fila) => total + fila.baseGravable,
    0,
  );
  const iva = filas.reduce((total, fila) => total + fila.iva, 0);
  return {
    subtotal,
    descuento: subtotal - baseGravable,
    baseGravable,
    iva,
    total: baseGravable + iva,
  };
}

/** Documentos radicados: soporte principal + matriz de requisitos. */
export function documentosDeLaRespuesta(
  detalle: DetalleInvitacionProveedor,
  respuesta: RespuestaProveedor,
): readonly DocumentoOfertaRadicado[] {
  const requeridos = detalle.solicitud.documentos?.requeridos ?? [];
  const archivos = respuesta.archivos;
  const fecha = formatoFechaHoraOferente(
    respuesta.fechaActualizacion ??
      respuesta.fechaRadicacion ??
      new Date().toISOString(),
  );

  const soporte = archivos.find(
    (archivo) => archivo.requisitoId === REQUISITO_SOPORTE,
  );
  const principal: readonly DocumentoOfertaRadicado[] = soporte
    ? [
        documentoRadicado({
          id: soporte.radicadoId ?? REQUISITO_SOPORTE,
          requisitoId: REQUISITO_SOPORTE,
          nombre: "Soporte detalle de la cotización",
          archivo: soporte,
          clasificacion: "obligatorio",
          descripcion:
            "Desglose económico formal firmado y radicado con la respuesta.",
          principal: true,
          fecha,
        }),
      ]
    : [];

  const requeridosRadicados = requeridos.map((documento) => {
    const archivo = archivos.find(
      (item) => item.requisitoId === documento.id,
    );
    return documentoRadicado({
      id: archivo?.radicadoId ?? documento.id,
      requisitoId: documento.id,
      nombre: documento.nombre,
      archivo,
      clasificacion: documento.clasificacion,
      descripcion: documento.instruccion,
      principal: false,
      fecha,
    });
  });

  return [...principal, ...requeridosRadicados];
}

interface DatosDocumento {
  readonly id: string;
  readonly requisitoId: string;
  readonly nombre: string;
  readonly archivo?: DocumentoRespuestaProveedor;
  readonly clasificacion: DocumentoOferente["clasificacion"];
  readonly descripcion: string;
  readonly principal: boolean;
  readonly fecha: string;
}

function documentoRadicado(datos: DatosDocumento): DocumentoOfertaRadicado {
  const nombreArchivo =
    datos.archivo?.nombre?.trim() ||
    datos.archivo?.archivo?.name?.trim() ||
    "";
  const pesoBytes =
    datos.archivo?.tamanoBytes ??
    datos.archivo?.archivo?.size ??
    0;
  const radicado = !!nombreArchivo;

  return {
    id: datos.id,
    requisitoId: datos.requisitoId,
    nombre: datos.nombre,
    nombreArchivo: radicado ? nombreArchivo : "Sin archivo radicado",
    clasificacion: datos.clasificacion,
    etiquetaClasificacion: etiquetaClasificacion(datos.clasificacion),
    formato: radicado ? etiquetaFormato(nombreArchivo) || "—" : "—",
    icono: radicado ? iconoPorFormato(nombreArchivo) : "file_present",
    estado: radicado ? "cargado" : "pendiente",
    fechaRadicacion: datos.fecha,
    pesoBytes,
    peso: radicado ? formatoTamano(pesoBytes) : "0 B",
    descripcion: datos.descripcion,
    principal: datos.principal,
    formatoValido: radicado && esFormatoSoporteOferta(nombreArchivo),
  };
}

/** Versiones radicadas, de la vigente a la más antigua. */
export function versionesDeLaRespuesta(
  respuesta: RespuestaProveedor,
): readonly VersionMiCotizacion[] {
  const vigente: VersionMiCotizacion = {
    version: respuesta.version,
    revision: respuesta.revision,
    radicado: respuesta.radicado ?? "Por definir",
    fechaIso:
      respuesta.fechaActualizacion ??
      respuesta.fechaRadicacion ??
      new Date().toISOString(),
    fecha: formatoFechaHoraOferente(
      respuesta.fechaActualizacion ??
        respuesta.fechaRadicacion ??
        new Date().toISOString(),
    ),
    versionSolicitud: respuesta.versionSolicitudRespondida,
    total: respuesta.total,
    totalTexto: formatoCop(respuesta.total),
    usuario: respuesta.usuarioActualizacion ?? respuesta.proveedorId,
    vigente: true,
  };

  const anteriores = [...respuesta.versionesAnteriores]
    .sort((a, b) => b.revision - a.revision)
    .map<VersionMiCotizacion>((version) => ({
      version: version.version,
      revision: version.revision,
      radicado: version.radicado ?? "Por definir",
      fechaIso: version.fecha,
      fecha: formatoFechaHoraOferente(version.fecha),
      versionSolicitud: version.versionSolicitud,
      total: version.total,
      totalTexto: formatoCop(version.total),
      usuario: version.usuario ?? respuesta.proveedorId,
      vigente: false,
    }));

  return [vigente, ...anteriores];
}

/** Historial de envío y modificaciones para `linea-tiempo`. */
export function eventosDeLaRespuesta(
  detalle: DetalleInvitacionProveedor,
  respuesta: RespuestaProveedor,
  versiones: readonly VersionMiCotizacion[],
  totalVigente: number,
): readonly EventoLineaTiempo[] {
  return versiones.map((version) => {
    const etiquetas: EtiquetaLineaTiempo[] = [
      { texto: version.version, tono: "primario" },
      { texto: `Solicitud ${version.versionSolicitud}` },
    ];
    if (version.vigente && version.revision > 1) {
      etiquetas.push({ texto: "Adenda aplicada", tono: "advertencia" });
    }
    const resultado: EtiquetaLineaTiempo = version.vigente
      ? { texto: "Versión vigente", tono: "exito" }
      : { texto: "Reemplazada", tono: "neutro" };

    return {
      id: `${respuesta.id}-${version.version}`,
      titulo: version.vigente
        ? version.revision > 1
          ? "Actualización de la respuesta radicada"
          : "Respuesta radicada en la plataforma"
        : `Versión ${version.version} reemplazada`,
      icono: version.revision > 1 ? "published_with_changes" : "upload_file",
      tono: version.vigente ? "primario" : "neutro",
      fecha: version.fecha,
      fechaIso: version.fechaIso,
      etiquetas,
      resultado,
      detalle: `<p>Total radicado: <strong>${
        version.vigente ? formatoCop(totalVigente) : version.totalTexto
      }</strong>.</p><p>Radicado <strong>${version.radicado}</strong>.</p>${
        version.vigente
          ? "<p>La respuesta es única; solo se actualiza cuando la solicitud cambia mediante adenda.</p>"
          : ""
      }`,
      autor: {
        usuario: version.usuario,
        nombre: detalle.proveedor.representante,
        rol: "Proveedor",
      },
      evidencia: {
        icono: "fingerprint",
        texto: `Radicado ${version.radicado}`,
      },
    } satisfies EventoLineaTiempo;
  });
}

/** Días entre el cierre de la solicitud y el vencimiento de la oferta. */
export function diasDeVigencia(
  cierre: string | null,
  fechaVencimiento: string,
): number | null {
  if (!cierre || !fechaVencimiento) {
    return null;
  }
  const [dia, mes, anio] = cierre.split("/").map(Number);
  const [anioFin, mesFin, diaFin] = fechaVencimiento.split("-").map(Number);
  if (!dia || !mes || !anio || !anioFin || !mesFin || !diaFin) {
    return null;
  }
  const inicio = Date.UTC(anio, mes - 1, dia);
  const fin = Date.UTC(anioFin, mesFin - 1, diaFin);
  return Math.max(0, Math.round((fin - inicio) / 86_400_000));
}

/** Fecha `YYYY-MM-DD` en formato largo ("16 de diciembre de 2026"). */
export function fechaLarga(fecha: string): string {
  if (!fecha) {
    return "Por definir";
  }
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (!anio || !mes || !dia) {
    return fecha;
  }
  const texto = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
