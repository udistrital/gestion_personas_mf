import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
import type { SolicitudDetalle } from "../models/solicitud.model";
import { cierreSolicitudVencido } from "../models/solicitud.model";
import {
  FiltroOferentes,
  OferenteTablero,
  ProveedorElegibleReporte,
  ResultadoTableroOferentes,
  SeleccionOferenteEvento,
  coincideParticipacion,
  conteosOferentes,
  crearOferentes,
  reporteProveedoresElegibles,
} from "../models/oferente.model";
import {
  ResultadoComparativo,
  construirComparativo,
  resultadoComparativoVacio,
} from "../models/comparativo.model";
import { identidadProveedor } from "../models/proveedores.model";
import { SolicitudesService } from "./solicitudes.service";

/**
 * Capa de datos del tablero de oferentes (S-07) y del comparador (S-09).
 *
 * Recibe la solicitud ya resuelta por `solicitudResolver` (no repite la
 * petición del detalle) y devuelve la página, los contadores globales, el
 * comparativo y las ubicaciones para los filtros. Es el único punto de enlace
 * con el backend cuando exista `OferentesServiceHttp`.
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

  /** Comparativo de las ofertas radicadas (S-09). */
  abstract obtenerComparativo(
    solicitud: SolicitudDetalle,
    oferenteIds?: readonly string[],
  ): Observable<ResultadoComparativo>;

  /**
   * Fija o retira la oferta preseleccionada.
   *
   * La selección es una recomendación (RN-33/RN-34); no cambia el estado de la
   * solicitud y se registra en la bitácora.
   */
  abstract seleccionarOferente(
    solicitud: SolicitudDetalle,
    proveedorId: string | null,
    oferenteIds?: readonly string[],
  ): Observable<ResultadoComparativo>;
}

/**
 * Implementación simulada.
 *
 * Trucos de desarrollo (query params, sin tocar código):
 * - `?mockOferentes=error` → falla la consulta del tablero.
 * - `?mockOferentes=vacio` → devuelve 0 oferentes (estado vacío).
 * - `?mockReporte=error` → falla la generación del reporte RN-19.
 * - `?mockComparador=error` → falla la consulta del comparador.
 * - `?mockComparador=vacio` → deja el comparador sin ofertas.
 * - `?mockComparador=una` → deja una sola oferta para el estado incompleto.
 * - `?mockRetardo=3000` → retardo en ms.
 */
@Injectable()
export class OferentesServiceMock extends OferentesService {
  /**
   * Selección vigente por solicitud.
   *
   * `null` significa "sin preselección"; la ausencia de la clave indica que
   * todavía no se tocó y se usa la semilla de S-07.
   */
  private readonly seleccionados = new Map<string, string | null>();

  constructor(private readonly solicitudes: SolicitudesService) {
    super();
  }

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

    const todos = this.aplicarSeleccion(
      crearOferentes(solicitud, cierreSolicitudVencido(solicitud.cierre)),
      solicitud.id,
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

  obtenerComparativo(
    solicitud: SolicitudDetalle,
    oferenteIds?: readonly string[],
  ): Observable<ResultadoComparativo> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockComparador") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar el comparativo de las ofertas. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    const todos = this.aplicarSeleccion(
      crearOferentes(solicitud, cierreSolicitudVencido(solicitud.cierre)),
      solicitud.id,
    );
    const seleccion = oferenteIds?.length
      ? todos.filter(
          (oferente) =>
            !oferente.respuesta ||
            oferenteIds.includes(oferente.proveedor.id),
        )
      : todos;

    if (params.get("mockComparador") === "vacio") {
      return of(
        resultadoComparativoVacio(solicitud.presupuesto?.valorCdp ?? 0),
      ).pipe(delay(retardo));
    }

    const conjunto =
      params.get("mockComparador") === "una"
        ? limitarAUnaOferta(seleccion, todos)
        : seleccion;

    return of(
      construirComparativo(
        solicitud,
        conjunto,
        this.seleccionadoDe(solicitud.id, todos),
      ),
    ).pipe(delay(retardo));
  }

  seleccionarOferente(
    solicitud: SolicitudDetalle,
    proveedorId: string | null,
    oferenteIds?: readonly string[],
  ): Observable<ResultadoComparativo> {
    const retardo = Number(
      new URLSearchParams(window.location.search).get("mockRetardo"),
    ) || 700;
    const todos = this.aplicarSeleccion(
      crearOferentes(solicitud, cierreSolicitudVencido(solicitud.cierre)),
      solicitud.id,
    );
    const objetivo = proveedorId
      ? todos.find(
          (oferente) =>
            oferente.proveedor.id === proveedorId && !!oferente.respuesta,
        )
      : null;

    if (proveedorId && !objetivo) {
      return throwError(
        () =>
          new Error(
            "La oferta seleccionada ya no está disponible para preselección.",
          ),
      ).pipe(delay(retardo));
    }

    const valorCdp = solicitud.presupuesto?.valorCdp ?? 0;
    if (
      objetivo &&
      valorCdp > 0 &&
      (objetivo.respuesta?.total ?? 0) > valorCdp
    ) {
      return throwError(
        () =>
          new Error(
            "La oferta supera el techo presupuestal y no puede preseleccionarse (RN-40).",
          ),
      ).pipe(delay(retardo));
    }

    const seleccion: SeleccionOferenteEvento = {
      proveedorId: objetivo?.proveedor.id ?? null,
      proveedorNombre: objetivo?.proveedor.nombre ?? "",
      valor: objetivo?.respuesta?.total ?? 0,
      rol: "Jefe de dependencia u ordenador del gasto",
    };
    this.seleccionados.set(solicitud.id, seleccion.proveedorId);
    this.solicitudes.registrarSeleccionOferente(solicitud.id, seleccion);

    return this.obtenerComparativo(solicitud, oferenteIds);
  }

  /** Aplica la preselección vigente a las filas del tablero y del comparador. */
  private aplicarSeleccion(
    oferentes: readonly OferenteTablero[],
    solicitudId: string,
  ): readonly OferenteTablero[] {
    const seleccionado = this.seleccionadoDe(solicitudId, oferentes);
    return oferentes.map((oferente) => ({
      ...oferente,
      seleccionado: oferente.proveedor.id === seleccionado,
    }));
  }

  /** Preselección vigente: la de sesión o la semilla de S-07. */
  private seleccionadoDe(
    solicitudId: string,
    oferentes: readonly OferenteTablero[],
  ): string | null {
    if (this.seleccionados.has(solicitudId)) {
      return this.seleccionados.get(solicitudId) ?? null;
    }
    const semilla =
      oferentes.find((oferente) => oferente.seleccionado)?.proveedor.id ??
      null;
    this.seleccionados.set(solicitudId, semilla);
    return semilla;
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

/** Atajo de desarrollo: deja la primera oferta y conserva los no respondientes. */
function limitarAUnaOferta(
  seleccion: readonly OferenteTablero[],
  todos: readonly OferenteTablero[],
): readonly OferenteTablero[] {
  const primera = seleccion.find((oferente) => !!oferente.respuesta);
  if (!primera) {
    return seleccion;
  }
  return todos.filter(
    (oferente) =>
      !oferente.respuesta ||
      oferente.proveedor.id === primera.proveedor.id,
  );
}
