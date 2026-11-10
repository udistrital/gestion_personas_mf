import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
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
  eventosVigentes,
  resumenSubsanacion,
} from "../models/subsanacion.model";
import { SolicitudesService } from "./solicitudes.service";

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
  constructor(private readonly solicitudes: SolicitudesService) {
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
