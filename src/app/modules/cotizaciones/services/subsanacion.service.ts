import { Injectable } from "@angular/core";
import { Observable, delay, map, of, switchMap, throwError } from "rxjs";
import { cierreSolicitudVencido } from "../models/solicitud.model";
import type { SolicitudDetalle } from "../models/solicitud.model";
import { crearOferentes } from "../models/oferente.model";
import type {
  HistorialSubsanacion,
  OferenteSubsanacion,
  RegistroSubsanacion,
  Subsanacion,
} from "../models/subsanacion.model";
import {
  crearOferentesSubsanables,
  estadoSubsanacion,
  eventoDocumento,
  eventosVigentes,
  resumenSubsanacion,
} from "../models/subsanacion.model";
import type { DetalleInvitacionProveedor } from "../models/invitacion-proveedor.model";
import type { DocumentoOfertaRadicado } from "../models/documentos.model";
import { extensionDe } from "../models/documentos.model";
import { documentosDeLaRespuesta } from "../models/mi-cotizacion.model";
import { FORMATOS_SOPORTE_OFERTA } from "../models/respuesta-proveedor.model";
import type {
  SubsanacionProveedor,
} from "../models/subsanacion-proveedor.model";
import {
  construirSubsanacionProveedor,
  radicacionSubsanacion,
} from "../models/subsanacion-proveedor.model";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { RespuestaProveedorService } from "./respuesta-proveedor.service";
import { SolicitudesService } from "./solicitudes.service";

/** Tamaño máximo por archivo en P-08, alineado con P-04. */
const TAMANO_MAX_SUBSANACION_MB = 10;

/**
 * Capa de datos de la subsanación documental (S-12).
 *
 * Es el único punto de enlace de las pantallas con el backend. La persistencia
 * simulada vive en `SolicitudesService` para que los eventos de subsanación
 * aparezcan también en la bitácora de S-03; cuando exista HTTP se reemplaza
 * esta clase por `SubsanacionServiceHttp` sin tocar las pantallas.
 */
export abstract class SubsanacionService {
  /** Oferentes con cotización y sus documentos subsanables. */
  abstract obtenerOferentesSubsanables(
    solicitud: SolicitudDetalle,
  ): Observable<readonly OferenteSubsanacion[]>;

  /** Historial del último periodo de subsanación, si existe. */
  abstract obtenerHistorial(
    solicitud: SolicitudDetalle,
  ): Observable<HistorialSubsanacion | null>;

  /** Configura un periodo nuevo. */
  abstract configurar(
    solicitud: SolicitudDetalle,
    datos: RegistroSubsanacion,
  ): Observable<Subsanacion>;

  /** Amplía el plazo con horas fijas o una fecha personalizada. */
  abstract ampliar(
    solicitud: SolicitudDetalle,
    horas: number | null,
    nuevaFecha: string | null,
    motivo: string,
  ): Observable<Subsanacion>;

  /** Cancela el periodo vigente. */
  abstract cancelar(
    solicitud: SolicitudDetalle,
    motivo: string,
  ): Observable<Subsanacion>;

  /* ── Portal del proveedor (P-08) ──────────────────────────────────────── */

  /**
   * Periodo vigente visto por el proveedor de la sesión.
   *
   * Devuelve `null` cuando no hay periodo o cuando el proveedor no fue
   * convocado. La proyección solo contiene su oferente y sus eventos (RN-29).
   */
  abstract obtenerProveedor(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<SubsanacionProveedor | null>;

  /** Adjunta o reemplaza un documento habilitado dentro del periodo. */
  abstract adjuntarDocumento(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
    documentoId: string,
    archivo: File,
  ): Observable<SubsanacionProveedor>;

  /** Radica formalmente la subsanación y bloquea nuevos cambios. */
  abstract radicarSubsanacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
    justificacionHtml: string,
  ): Observable<SubsanacionProveedor>;
}

/**
 * Implementación simulada.
 *
 * Trucos de desarrollo:
 * - `?mockSubsanacion=error` → falla la consulta de oferentes.
 * - `?mockSubsanacion=vacio` → deja la lista de oferentes vacía.
 * - `?mockSubsanacion=error-envio` → falla la configuración.
 * - `?mockSubsanacion=error-ampliar` → falla la ampliación.
 * - `?mockSubsanacion=error-cancelar` → falla la cancelación.
 * - `?mockHistorialSubsanacion=error` → falla el historial.
 * - `?mockRetardo=3000` → retardo en ms.
 */
@Injectable()
export class SubsanacionServiceMock extends SubsanacionService {
  constructor(
    private readonly solicitudes: SolicitudesService,
    private readonly respuestas: RespuestaProveedorService,
  ) {
    super();
  }

  obtenerOferentesSubsanables(
    solicitud: SolicitudDetalle,
  ): Observable<readonly OferenteSubsanacion[]> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockSubsanacion") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar los oferentes subsanables. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    if (params.get("mockSubsanacion") === "vacio") {
      return of([]).pipe(delay(retardo));
    }

    const oferentes = crearOferentes(
      solicitud,
      cierreSolicitudVencido(solicitud.cierre),
    );
    return of(crearOferentesSubsanables(solicitud, oferentes)).pipe(
      delay(retardo),
    );
  }

  obtenerHistorial(
    solicitud: SolicitudDetalle,
  ): Observable<HistorialSubsanacion | null> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 600;

    if (params.get("mockHistorialSubsanacion") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar el historial de subsanación. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    const subsanacion = solicitud.subsanacion ?? null;
    if (!subsanacion) {
      return of(null).pipe(delay(retardo));
    }

    return of({
      subsanacion,
      estado: estadoSubsanacion(subsanacion),
      eventos: eventosVigentes(subsanacion),
      resumen: resumenSubsanacion(subsanacion),
    }).pipe(delay(retardo));
  }

  /* ── Portal del proveedor (P-08) ──────────────────────────────────────── */

  obtenerProveedor(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<SubsanacionProveedor | null> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;
    const modo = params.get("mockSubsanacionProveedor");

    if (modo === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar la subsanación de su empresa. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    if (modo === "sin-periodo") {
      return of(null).pipe(delay(retardo));
    }

    const periodoBase = detalle.solicitud.subsanacion ?? null;
    if (!periodoBase) {
      return of(null).pipe(delay(retardo));
    }
    const periodo =
      modo === "programada" ? programarPeriodo(periodoBase) : periodoBase;
    const requeridos = detalle.solicitud.documentos?.requeridos ?? [];

    return this.documentosActuales(detalle, proveedorId).pipe(
      map((documentos) =>
        construirSubsanacionProveedor(
          periodo,
          proveedorId,
          requeridos,
          documentos,
        ),
      ),
      delay(retardo),
    );
  }

  adjuntarDocumento(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
    documentoId: string,
    archivo: File,
  ): Observable<SubsanacionProveedor> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockSubsanacionProveedor") === "error-adjunto") {
      return throwError(
        () =>
          new Error(
            "No fue posible registrar el documento. El archivo se conserva para reintentar.",
          ),
      ).pipe(delay(retardo));
    }

    const periodo = detalle.solicitud.subsanacion;
    if (!periodo) {
      return throwError(
        () => new Error("No existe un periodo de subsanación vigente."),
      ).pipe(delay(retardo));
    }
    if (estadoSubsanacion(periodo) !== "activa") {
      return throwError(
        () =>
          new Error(
            "El periodo de subsanación no está activo; no se aceptan cambios.",
          ),
      ).pipe(delay(retardo));
    }
    if (radicacionSubsanacion(periodo, proveedorId)) {
      return throwError(
        () =>
          new Error(
            "La subsanación ya fue radicada y no admite nuevos cambios.",
          ),
      ).pipe(delay(retardo));
    }

    const oferente = periodo.oferentes.find(
      (item) => item.proveedorId === proveedorId,
    );
    const documento = oferente?.documentos.find(
      (item) => item.id === documentoId,
    );
    if (!documento || !documento.seleccionado) {
      return throwError(
        () =>
          new Error(
            "El documento no está habilitado para su empresa en este periodo.",
          ),
      ).pipe(delay(retardo));
    }
    if (!documento.subsanable || documento.bloqueadoPorPliego) {
      return throwError(
        () =>
          new Error(
            "El documento está bloqueado por el pliego y no admite subsanación.",
          ),
      ).pipe(delay(retardo));
    }

    const existente = eventoDocumento(periodo, proveedorId, documentoId);
    if (existente && !periodo.permitirReemplazo) {
      return throwError(
        () =>
          new Error("El periodo no permite reemplazar un documento ya cargado."),
      ).pipe(delay(retardo));
    }

    const extension = extensionDe(archivo.name);
    if (!(FORMATOS_SOPORTE_OFERTA as readonly string[]).includes(extension)) {
      return throwError(
        () =>
          new Error(
            "Formato no permitido. Use PDF, XLS, XLSX, DOC o DOCX (RN-41).",
          ),
      ).pipe(delay(retardo));
    }
    if (archivo.size > TAMANO_MAX_SUBSANACION_MB * 1024 * 1024) {
      return throwError(
        () =>
          new Error(
            `El archivo supera el máximo de ${TAMANO_MAX_SUBSANACION_MB} MB por documento.`,
          ),
      ).pipe(delay(retardo));
    }

    const requeridos = detalle.solicitud.documentos?.requeridos ?? [];
    const usuario = usuarioProveedor(detalle);
    const rol = "Representante Legal · Proveedor";

    return this.documentosActuales(detalle, proveedorId).pipe(
      switchMap((documentos) => {
        const proyeccion = construirSubsanacionProveedor(
          periodo,
          proveedorId,
          requeridos,
          documentos,
        );
        if (!proyeccion) {
          return throwError(
            () =>
              new Error(
                "Su empresa no está incluida en el periodo de subsanación.",
              ),
          );
        }
        const vista = proyeccion.documentos.find(
          (item) => item.id === documentoId,
        );
        const anterior = vista?.archivoActual;
        const versionNueva = {
          nombre: archivo.name,
          peso: formatearBytes(archivo.size),
          pesoBytes: archivo.size,
          hash: hashSimulado(
            `${detalle.solicitud.id}|${documentoId}|${archivo.name}|${archivo.size}`,
          ),
        };
        const versionAnterior = anterior
          ? {
              nombre: anterior.nombre,
              peso: anterior.peso,
              hash: "pendiente",
            }
          : undefined;

        return this.respuestas
          .registrarDocumentoSubsanado(detalle, proveedorId, documentoId, {
            nombre: archivo.name,
            tamanoBytes: archivo.size,
          })
          .pipe(
            switchMap(() =>
              this.solicitudes.registrarEventoSubsanacion(
                detalle.solicitud.id,
                {
                  tipo: existente
                    ? "documento-reemplazado"
                    : "documento-cargado",
                  proveedorId,
                  usuario,
                  nombreUsuario: detalle.proveedor.representante,
                  rol,
                  documentoId,
                  documentoNombre: documento.nombre,
                  versionAnterior,
                  versionNueva,
                  hash: `SHA-256: ${versionNueva.hash}`,
                },
              ),
            ),
            map(
              (actualizado) =>
                construirSubsanacionProveedor(
                  actualizado,
                  proveedorId,
                  requeridos,
                  documentos,
                ) ?? proyeccion,
            ),
          );
      }),
      delay(retardo),
    );
  }

  radicarSubsanacion(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
    justificacionHtml: string,
  ): Observable<SubsanacionProveedor> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockSubsanacionProveedor") === "error-envio") {
      return throwError(
        () =>
          new Error(
            "No fue posible radicar la subsanación. Los documentos cargados se conservan para reintentar.",
          ),
      ).pipe(delay(retardo));
    }

    const periodo = detalle.solicitud.subsanacion;
    if (!periodo) {
      return throwError(
        () => new Error("No existe un periodo de subsanación vigente."),
      ).pipe(delay(retardo));
    }
    if (estadoSubsanacion(periodo) !== "activa") {
      return throwError(
        () =>
          new Error(
            "El periodo de subsanación no está activo; no se puede radicar.",
          ),
      ).pipe(delay(retardo));
    }
    if (radicacionSubsanacion(periodo, proveedorId)) {
      return throwError(
        () => new Error("La subsanación ya fue radicada."),
      ).pipe(delay(retardo));
    }

    const requeridos = detalle.solicitud.documentos?.requeridos ?? [];
    const justificacion = textoPlanoDesdeHtml(justificacionHtml).trim();
    const usuario = usuarioProveedor(detalle);

    return this.documentosActuales(detalle, proveedorId).pipe(
      switchMap((documentos) => {
        const proyeccion = construirSubsanacionProveedor(
          periodo,
          proveedorId,
          requeridos,
          documentos,
        );
        if (!proyeccion?.puedeRadicar) {
          return throwError(
            () =>
              new Error(
                "Aún faltan documentos obligatorios por cargar antes de radicar.",
              ),
          );
        }
        return this.solicitudes
          .registrarEventoSubsanacion(detalle.solicitud.id, {
            tipo: "subsanacion-radicada",
            proveedorId,
            usuario,
            nombreUsuario: detalle.proveedor.representante,
            rol: "Representante Legal · Proveedor",
            justificacion: justificacion || undefined,
          })
          .pipe(
            map(
              (actualizado) =>
                construirSubsanacionProveedor(
                  actualizado,
                  proveedorId,
                  requeridos,
                  documentos,
                ) ?? proyeccion,
            ),
          );
      }),
      delay(retardo),
    );
  }

  private documentosActuales(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<readonly DocumentoOfertaRadicado[]> {
    if (!detalle.yaRespondio || !detalle.invitacion.respuestaVigente) {
      return of([]);
    }
    return this.respuestas
      .obtenerMiCotizacion(detalle, proveedorId)
      .pipe(
        map((respuesta) =>
          respuesta ? documentosDeLaRespuesta(detalle, respuesta) : [],
        ),
      );
  }

  configurar(
    solicitud: SolicitudDetalle,
    datos: RegistroSubsanacion,
  ): Observable<Subsanacion> {
    return this.solicitudes.registrarSubsanacion(solicitud.id, datos);
  }

  ampliar(
    solicitud: SolicitudDetalle,
    horas: number | null,
    nuevaFecha: string | null,
    motivo: string,
  ): Observable<Subsanacion> {
    return this.solicitudes.ampliarSubsanacion(
      solicitud.id,
      horas,
      nuevaFecha,
      motivo,
    );
  }

  cancelar(
    solicitud: SolicitudDetalle,
    motivo: string,
  ): Observable<Subsanacion> {
    return this.solicitudes.cancelarSubsanacion(solicitud.id, motivo);
  }
}

/** Clona el periodo con fechas futuras para el estado «programada». */
function programarPeriodo(periodo: Subsanacion): Subsanacion {
  return {
    ...periodo,
    inicio: isoRelativo(2, 8, 0),
    fin: isoRelativo(4, 17, 0),
  };
}

/** Usuario de la sesión del proveedor, derivado de su correo institucional. */
function usuarioProveedor(detalle: DetalleInvitacionProveedor): string {
  return detalle.proveedor.correo.split("@")[0] || "proveedor";
}

/** Fecha ISO relativa con desfase de Colombia. */
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

/** Hash determinista de demostración; el backend emitirá el definitivo. */
function hashSimulado(texto: string): string {
  let hash = 0;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash = (hash * 31 + texto.charCodeAt(indice)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function formatearBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes === 0) {
    return "0 B";
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
