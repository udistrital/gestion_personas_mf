import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
import type { SolicitudDetalle } from "../models/solicitud.model";
import { cierreSolicitudVencido } from "../models/solicitud.model";
import {
  FiltroOferentes,
  OferenteTablero,
  ProveedorElegibleReporte,
  ResultadoTableroOferentes,
  coincideParticipacion,
  conteosOferentes,
  crearOferentes,
  reporteProveedoresElegibles,
} from "../models/oferente.model";
import { identidadProveedor } from "../models/proveedores.model";

/**
 * Capa de datos del tablero de oferentes (S-07).
 *
 * Recibe la solicitud ya resuelta por `solicitudResolver` (no repite la
 * petición del detalle) y devuelve la página, los contadores globales y las
 * ubicaciones para los filtros. Es el único punto de enlace con el backend
 * cuando exista `OferentesServiceHttp`.
 */
export abstract class OferentesService {
  abstract listar(
    solicitud: SolicitudDetalle,
    criterios: Partial<FiltroOferentes>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoTableroOferentes>;

  /** Reporte básico de proveedores que cumplen el perfil (RN-19). */
  abstract obtenerElegibles(
    solicitud: SolicitudDetalle,
  ): Observable<readonly ProveedorElegibleReporte[]>;
}

/**
 * Implementación simulada.
 *
 * Trucos de desarrollo (query params, sin tocar código):
 * - `?mockOferentes=error` → falla la consulta del tablero.
 * - `?mockOferentes=vacio` → devuelve 0 oferentes (estado vacío).
 * - `?mockReporte=error` → falla la generación del reporte RN-19.
 * - `?mockRetardo=3000` → retardo en ms.
 */
@Injectable()
export class OferentesServiceMock extends OferentesService {
  listar(
    solicitud: SolicitudDetalle,
    criterios: Partial<FiltroOferentes>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoTableroOferentes> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockOferentes") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar los oferentes de la solicitud. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    if (params.get("mockOferentes") === "vacio") {
      return of({
        oferentes: [],
        total: 0,
        conteos: {
          cumplen: 0,
          notificados: 0,
          postulados: 0,
          cotizaciones: 0,
          sinOferta: 0,
        },
        ubicaciones: [],
      }).pipe(delay(retardo));
    }

    const todos = crearOferentes(
      solicitud,
      cierreSolicitudVencido(solicitud.cierre),
    );
    const filtrados = ordenar(todos.filter((oferente) =>
      coincideCriterios(oferente, criterios),
    ));
    const desde = pagina * porPagina;

    return of({
      oferentes: filtrados.slice(desde, desde + porPagina),
      total: filtrados.length,
      conteos: conteosOferentes(solicitud, todos),
      ubicaciones: ubicacionesDe(todos),
    }).pipe(delay(retardo));
  }

  obtenerElegibles(
    solicitud: SolicitudDetalle,
  ): Observable<readonly ProveedorElegibleReporte[]> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 600;

    if (params.get("mockReporte") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible generar el reporte de proveedores que cumplen.",
          ),
      ).pipe(delay(retardo));
    }

    return of(reporteProveedoresElegibles(solicitud)).pipe(delay(retardo));
  }
}

/* ── Utilidades del mock ──────────────────────────────────────────────────── */

const ORDEN_GRUPO: Readonly<Record<OferenteTablero["grupo"], number>> = {
  "con-oferta": 0,
  "sin-oferta": 1,
};

function ordenar(
  oferentes: readonly OferenteTablero[],
): readonly OferenteTablero[] {
  return [...oferentes].sort((a, b) => {
    const grupo = ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo];
    if (grupo !== 0) {
      return grupo;
    }
    if (a.seleccionado !== b.seleccionado) {
      return a.seleccionado ? -1 : 1;
    }
    const fecha = b.ultimaAccionIso.localeCompare(a.ultimaAccionIso);
    if (fecha !== 0) {
      return fecha;
    }
    return a.proveedor.nombre.localeCompare(b.proveedor.nombre, "es-CO");
  });
}

function ubicacionesDe(
  oferentes: readonly OferenteTablero[],
): readonly string[] {
  return [
    ...new Set(
      oferentes.map(
        (oferente) => identidadProveedor(oferente.proveedor).departamento,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "es-CO"));
}

function coincideCriterios(
  oferente: OferenteTablero,
  criterios: Partial<FiltroOferentes>,
): boolean {
  if (
    criterios.participacion &&
    !coincideParticipacion(oferente, criterios.participacion)
  ) {
    return false;
  }
  if (criterios.estado && oferente.estado !== criterios.estado) {
    return false;
  }

  const identidad = identidadProveedor(oferente.proveedor);
  if (criterios.tipoPersona && identidad.tipoPersona !== criterios.tipoPersona) {
    return false;
  }
  if (criterios.ubicacion && identidad.departamento !== criterios.ubicacion) {
    return false;
  }

  const termino = normalizar(criterios.busqueda ?? "");
  if (!termino) {
    return true;
  }
  return [
    oferente.proveedor.nombre,
    oferente.proveedor.nit,
    identidad.correo,
    identidad.representante,
    identidad.ubicacion,
  ].some((valor) => normalizar(valor).includes(termino));
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
