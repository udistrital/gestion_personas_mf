import { Injectable } from "@angular/core";
import { Observable, of, throwError, delay } from "rxjs";
import { EstadoSolicitud } from "src/app/core/constants/estados-solicitud.const";
import {
  FiltroSolicitudes,
  ResultadoListado,
  Solicitud,
  TipoCotizacion,
} from "../models/solicitud.model";

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
}

const DATOS_MOCK: readonly Solicitud[] = [
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
    estado: "abierta",
  },
  {
    id: "SOL-2026-0042",
    vigencia: 2026,
    unidadEjecutora: "1",
    titulo: "Suministro de equipos de cómputo para laboratorios de posgrados",
    apertura: "15/02/2026",
    cierre: "24/02/2026",
    dependencia: "Vicerrectoría Académica",
    tipoCotizacion: "BIEN",
    estado: "abierta",
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
    estado: "publicada",
  },
  {
    id: "SOL-2026-0021",
    vigencia: 2026,
    unidadEjecutora: "2",
    titulo: "Renovación de pólizas institucionales de seguros de bienes muebles",
    apertura: "16/01/2026",
    cierre: "22/01/2026",
    dependencia: "Secretaría General",
    tipoCotizacion: "SERVICIO",
    estado: "cerrada",
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
    estado: "publicada",
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
    estado: "cerrada",
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
    estado: "cerrada",
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
    estado: "cerrada",
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
    estado: "cerrada",
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
    estado: "cerrada",
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
    estado: "cerrada",
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
    estado: "cerrada",
  },
];

const MAPA_TIPOS: Readonly<Record<string, TipoCotizacion>> = {
  bienes: "BIEN",
  servicios: "SERVICIO",
  mixto: "BIEN_Y_SERVICIO",
};

/**
 * Implementación simulada con retardo RxJS.
 *
 * Trucos de desarrollo (query params del navegador, sin tocar código):
 * - `?mock=vacio` → devuelve 0 filas (estado vacío)
 * - `?mock=error` → falla la petición (estado de error)
 * - `?mockRetardo=3000` → retardo en ms (ver el skeleton más tiempo)
 */
@Injectable()
export class SolicitudesServiceMock extends SolicitudesService {
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

    const filtradas = DATOS_MOCK.filter((solicitud) =>
      this.coincide(solicitud, criterios),
    );

    const desde = pagina * porPagina;
    const hasta = desde + porPagina;

    return of({
      solicitudes: filtradas.slice(desde, hasta),
      total: filtradas.length,
    }).pipe(delay(retardo));
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
}
