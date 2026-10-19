import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
import {
  AcuerdoMarco,
  CaracteristicasSolicitud,
  CriterioNecesidad,
  ErrorCruceSicapital,
  InformacionPresupuestal,
  InformacionSolicitud,
  NecesidadOpcion,
  ResultadoCruce,
  ResponsableSolicitud,
} from "../models/necesidad.model";

/** Criterios para listar las necesidades disponibles de una unidad/vigencia. */
export interface CriterioListadoNecesidades {
  readonly unidadEjecutora: string;
  readonly vigencia: string;
}

/**
 * Vigencias consultables en SICAPITAL para nuevas radicaciones
 * (el mockup solo ofrece la vigencia actual y el cierre fiscal 2025).
 */
export const VIGENCIAS_NECESIDAD: readonly { valor: string; etiqueta: string }[] =
  [
    { valor: "2026", etiqueta: "2026 (Predeterminada)" },
    { valor: "2025", etiqueta: "2025 (Cierre fiscal)" },
  ];

/**
 * Capa de datos de SICAPITAL.
 *
 * Los componentes solo conocen esta clase abstracta; el enlace con la
 * implementación simulada se hace en UN solo punto (provider de
 * `SolicitanteModule`). Cuando exista el WS real se reemplaza por
 * `SicapitalServiceHttp` y no se toca ninguna pantalla.
 */
export abstract class SicapitalService {
  /**
   * Necesidades aprobadas para la unidad y la vigencia indicadas
   * (selector "Número de la necesidad").
   */
  abstract listarNecesidades(
    criterios: CriterioListadoNecesidades,
  ): Observable<readonly NecesidadOpcion[]>;

  /**
   * Cruce de la necesidad con la disponibilidad presupuestal:
   * alimenta las tarjetas 2 y 3 (y el acuerdo marco, si lo hay).
   */
  abstract cruzar(
    criterios: CriterioNecesidad,
  ): Observable<ResultadoCruce>;
}

/** Ficha completa de una necesidad dentro del mock. */
interface RegistroSic {
  readonly opcion: NecesidadOpcion;
  readonly presupuesto: InformacionPresupuestal;
  readonly solicitud: InformacionSolicitud;
  /** Radicador precargado por SICAPITAL (tarjeta 1 del paso 2). */
  readonly responsable: ResponsableSolicitud;
  /** Condiciones precargadas por SICAPITAL (tarjeta 3 del paso 2). */
  readonly caracteristicas: CaracteristicasSolicitud;
  readonly acuerdoMarco?: AcuerdoMarco;
}

const DISPONIBILIDAD_412 = {
  vigencia: 2026,
  solicitudNecesidad: "NEC-2026-00412",
  numeroDisponibilidad: "CDP-2026-00892",
  valor: 45_000_000,
  dependencia: "Rectoría - División de TI",
  rubro: "2.3.1.01.02",
  rubroNombre: "Adquisición de Bienes TIC",
  estado: "Vigente / Aprobado",
};

/** Radicadores por unidad ejecutora (mock del cruce del paso 1). */
const RESPONSABLES: Readonly<Record<string, ResponsableSolicitud>> = {
  "1": {
    nombres: "Andrés Felipe",
    apellidos: "Rincón Bayona",
    identificacion: "C.C. 1.018.452.981",
    unidadEjecutora: "1 - Rectoría",
    ordenadorGasto: "ORD-0042 - Dr. Ricardo Gómez Morales (Rector)",
  },
  "2": {
    nombres: "Claudia Marcela",
    apellidos: "Pardo Cifuentes",
    identificacion: "C.C. 52.884.117",
    unidadEjecutora: "2 - Facultad Tecnológica",
    ordenadorGasto: "ORD-0061 - Ing. Gloria Esperanza Useche (Decana)",
  },
  "3": {
    nombres: "Julián Esteban",
    apellidos: "Ospina Rojas",
    identificacion: "C.C. 79.554.302",
    unidadEjecutora: "3 - Facultad de Ingeniería",
    ordenadorGasto: "ORD-0058 - Ing. Jaime Alberto Rodríguez (Decano)",
  },
};

/** Condiciones técnicas precargadas por SICAPITAL (tarjeta 3 del paso 2). */
const CARACTERISTICAS_412: CaracteristicasSolicitud = {
  objetivo:
    "Adquisición, instalación, configuración y puesta en marcha de infraestructura de cómputo y servidores para la modernización de los centros de cómputo de la Universidad Distrital Francisco José de Caldas.",
  requisitos:
    "Los equipos ofertados deben ser de última generación, con soporte técnico especializado mínimo de 36 meses y certificaciones vigentes del fabricante.",
  observaciones:
    "Las condiciones ambientales de los centros de cómputo se ajustan al Estándar TIER II. Se requiere garantía de repuestos por al menos 5 años.",
  plazoEjecucion: "Entrega e instalación en un plazo máximo de 60 días calendario.",
};

const CARACTERISTICAS_388: CaracteristicasSolicitud = {
  objetivo:
    "Mantenimiento preventivo y correctivo de los laboratorios de ensayo, prueba y calibración de la sede Aduanilla de Paiba.",
  requisitos:
    "El proveedor debe acreditar personal calificado y trazabilidad metrológica certificada por un organismo acreditado.",
  observaciones:
    "Los trabajos se ejecutan sin interrumpir la jornada académica; la programación se acuerda con la coordinación de laboratorios.",
  plazoEjecucion: "Ejecución por vigencias trimestrales durante 120 días calendario.",
};

const CARACTERISTICAS_105: CaracteristicasSolicitud = {
  objetivo:
    "Renovación del licenciamiento anual de la plataforma de simulación y análisis para la red campus.",
  requisitos:
    "El licenciamiento debe cubrir a estudiantes y docentes en modalidad concurrente y ofrecer actualizaciones durante la vigencia.",
  observaciones:
    "Se requiere integración con el directorio institucional mediante protocolo SAML 2.0.",
  plazoEjecucion: "Activación de licencias dentro de los 15 días calendario siguientes a la firma.",
};

const CARACTERISTICAS_977: CaracteristicasSolicitud = {
  objetivo:
    "Suministro y montaje de mobiliario institucional para las salas de estudio y aulas de la sede central.",
  requisitos:
    "Los muebles deben cumplir la normativa de ergonomía y resistencia para mobiliario educativo.",
  observaciones:
    "El mobiliario se entrega y monta por lotes según la programación de la División Administrativa.",
  plazoEjecucion: "Suministro y montaje en un plazo máximo de 30 días calendario.",
};

const DATOS_SICAPITAL: readonly RegistroSic[] = [
  {
    opcion: {
      valor: "NEC-2026-00412",
      titulo: "Adquisición Servidores y TIC",
      etiqueta: "NEC-2026-00412 (Adquisición Servidores y TIC)",
      unidadEjecutora: "1",
      vigencia: 2026,
    },
    presupuesto: {
      disponibilidades: [DISPONIBILIDAD_412],
      valorCdp: 45_000_000,
    },
    solicitud: {
      titulo:
        "Adquisición, instalación y puesta en funcionamiento de infraestructura de cómputo y servidores para la División de Recursos Tecnológicos.",
      vigencia: 2026,
      objeto:
        "La adquisición, instalación y puesta en funcionamiento de servidores, equipos de cómputo y equipos de red para atender la operación de la División de Recursos Tecnológicos.",
      justificacion:
        "Los servidores actuales superan su vida útil comprometiendo la continuidad de los servicios institucionales; se requiere renovar la infraestructura antes del cierre de la vigencia.",
      sede: "Edificio Sabio Caldas",
      plazo: "45 Días Calendario",
      controlPresupuestal: "100% Amparado",
    },
    responsable: RESPONSABLES["1"],
    caracteristicas: CARACTERISTICAS_412,
    acuerdoMarco: {
      numero: "ACU-2026-CS-014",
      vigencia: 2026,
      valorCdp: 45_000_000,
      tipoProceso: "Adquisición centralizada de bienes y servicios",
      explicacion:
        "El presente acuerdo marco institucional establece los lineamientos obligatorios de contratación, especificaciones técnicas mínimas y topes presupuestales autorizados por el Consejo Superior Universitario para la vigencia 2026. Esta solicitud se enmarca dentro de las directrices fijadas para compras de tecnología.",
    },
  },
  {
    opcion: {
      valor: "NEC-2026-00388",
      titulo: "Mantenimiento Laboratorios IDEXUD",
      etiqueta: "NEC-2026-00388 (Mantenimiento Laboratorios IDEXUD)",
      unidadEjecutora: "2",
      vigencia: 2026,
    },
    presupuesto: {
      disponibilidades: [
        {
          vigencia: 2026,
          solicitudNecesidad: "NEC-2026-00388",
          numeroDisponibilidad: "CDP-2026-00741",
          valor: 18_200_000,
          dependencia: "IDEXUD - División de Laboratorios",
          rubro: "2.3.1.03.01",
          rubroNombre: "Mantenimiento de laboratorios",
          estado: "Vigente / Aprobado",
        },
      ],
      valorCdp: 18_200_000,
    },
    solicitud: {
      titulo:
        "Mantenimiento preventivo y correctivo de los laboratorios de ensayo y prueba de la sede Aduanilla de Paiba.",
      vigencia: 2026,
      objeto:
        "Prestar el servicio de mantenimiento preventivo y correctivo de la infraestructura y los equipos de los laboratorios de la Facultad Tecnológica.",
      justificacion:
        "El contrato de mantenimiento vigente vence en la presente vigencia y los equipos requieren calibración certificada para seguir operando con estándares de calidad.",
      sede: "Sede Aduanilla de Paiba",
      plazo: "120 Días Calendario",
      controlPresupuestal: "100% Amparado",
    },
    responsable: RESPONSABLES["2"],
    caracteristicas: CARACTERISTICAS_388,
  },
  {
    opcion: {
      valor: "NEC-2026-00105",
      titulo: "Licenciamiento Académico Campus",
      etiqueta: "NEC-2026-00105 (Licenciamiento Académico Campus)",
      unidadEjecutora: "3",
      vigencia: 2026,
    },
    presupuesto: {
      disponibilidades: [
        {
          vigencia: 2026,
          solicitudNecesidad: "NEC-2026-00105",
          numeroDisponibilidad: "CDP-2026-00612",
          valor: 9_450_000,
          dependencia: "Facultad de Ingeniería",
          rubro: "3.1.01.02.004",
          rubroNombre: "Licenciamiento de software académico",
          estado: "Vigente / Aprobado",
        },
      ],
      valorCdp: 9_450_000,
    },
    solicitud: {
      titulo:
        "Renovación del licenciamiento anual de la plataforma de simulación y análisis para la red campus.",
      vigencia: 2026,
      objeto:
        "La renovación de licencias de software académico para los estudiantes y docentes de las carreras de ingeniería.",
      justificacion:
        "Las licencias vencen al término del semestre y su no renovación impide dictar las asignaturas prácticas del plan de estudios.",
      sede: "Edificio Sabio Caldas",
      plazo: "30 Días Calendario",
      controlPresupuestal: "100% Amparado",
    },
    responsable: RESPONSABLES["3"],
    caracteristicas: CARACTERISTICAS_105,
  },
  {
    opcion: {
      valor: "NEC-2025-00977",
      titulo: "Suministro de mobiliario 2025",
      etiqueta: "NEC-2025-00977 (Suministro de mobiliario 2025)",
      unidadEjecutora: "1",
      vigencia: 2025,
    },
    presupuesto: {
      disponibilidades: [
        {
          vigencia: 2025,
          solicitudNecesidad: "NEC-2025-00977",
          numeroDisponibilidad: "CDP-2025-01188",
          valor: 12_800_000,
          dependencia: "Rectoría - División Administrativa",
          rubro: "2.3.1.06.01",
          rubroNombre: "Suministro de mobiliario",
          estado: "Vigente / Aprobado",
        },
      ],
      valorCdp: 12_800_000,
    },
    solicitud: {
      titulo:
        "Suministro de mobiliario para las salas de estudio y aulas de la sede central.",
      vigencia: 2025,
      objeto:
        "El suministro y montaje de mobiliario institucional para las salas de estudio de la sede central.",
      justificacion:
        "El mobiliario existente presenta deterioro que afecta la dotación de los espacios de estudio de los estudiantes.",
      sede: "Edificio Sabio Caldas",
      plazo: "30 Días Calendario",
      controlPresupuestal: "Cierre fiscal 2025",
    },
    responsable: RESPONSABLES["1"],
    caracteristicas: CARACTERISTICAS_977,
  },
];

/**
 * Implementación simulada con retardo RxJS.
 *
 * Trucos de desarrollo (query params del navegador, sin tocar código):
 * - `?mockSicapital=error` → el cruce falla siempre con HTTP 504
 * - `?mockSicapital=timeout` → el cruce falla siempre por red/DNS
 * - `?mockAcuerdo=ausente` → la respuesta no incluye acuerdo marco
 * - `?mockRetardo=3000` → retardo de la consulta en ms
 */
@Injectable()
export class SicapitalServiceMock extends SicapitalService {
  listarNecesidades(
    criterios: CriterioListadoNecesidades,
  ): Observable<readonly NecesidadOpcion[]> {
    const opciones = DATOS_SICAPITAL.filter(
      (registro) =>
        registro.opcion.unidadEjecutora === criterios.unidadEjecutora &&
        String(registro.opcion.vigencia) === criterios.vigencia,
    ).map((registro) => registro.opcion);

    return of(opciones).pipe(delay(this.retardo(400)));
  }

  cruzar(criterios: CriterioNecesidad): Observable<ResultadoCruce> {
    const modo = this.parametro("mockSicapital");

    if (modo === "error" || modo === "timeout") {
      return this.falloDeCruce(modo).pipe(delay(this.retardo(900)));
    }

    const registro = DATOS_SICAPITAL.find(
      (dato) =>
        dato.opcion.valor === criterios.numeroNecesidad &&
        dato.opcion.unidadEjecutora === criterios.unidadEjecutora &&
        String(dato.opcion.vigencia) === criterios.vigencia,
    );

    if (!registro) {
      return throwError(
        () =>
          new ErrorCruceSicapital(
            "La necesidad consultada no fue encontrada en SICAPITAL.",
            "ERR-SIC-404",
            404,
            `No existe registro de la necesidad ${criterios.numeroNecesidad} para la vigencia ${criterios.vigencia}.`,
            "http://sicapital.udistrital.edu.co/ws/presupuesto",
            "10.20.0.45",
          ),
      ).pipe(delay(this.retardo(900)));
    }

    const sinAcuerdo = this.parametro("mockAcuerdo") === "ausente";
    const resultado: ResultadoCruce = {
      necesidad: registro.opcion,
      presupuesto: registro.presupuesto,
      solicitud: registro.solicitud,
      responsable: registro.responsable,
      caracteristicas: registro.caracteristicas,
      ...(registro.acuerdoMarco && !sinAcuerdo
        ? { acuerdoMarco: registro.acuerdoMarco }
        : {}),
    };

    return of(resultado).pipe(delay(this.retardo(900)));
  }

  private falloDeCruce(modo: "error" | "timeout"): Observable<ResultadoCruce> {
    const servicio = "http://sicapital.udistrital.edu.co/ws/presupuesto";
    const host = "10.20.0.45";

    if (modo === "timeout") {
      return throwError(
        () =>
          new ErrorCruceSicapital(
            "No fue posible establecer la conexión con SICAPITAL. Verifique la red institucional e intente nuevamente.",
            "ERR-SIC-NET",
            0,
            "No se resolvió el host sicapital.udistrital.edu.co tras 45000ms. Sin ruta hasta " +
              host +
              ".",
            servicio,
            host,
          ),
      );
    }

    return throwError(
      () =>
        new ErrorCruceSicapital(
          "No fue posible cruzar la información de SICAPITAL con el sistema de cotizaciones. Revise la información del ordenador del gasto para continuar.",
          "ERR-SIC-504",
          504,
          "Conexión a base de datos Oracle SICAPITAL no respondió en 45000ms. Pool de conexiones saturado.",
          servicio,
          host,
        ),
    );
  }

  private parametro(nombre: string): string | null {
    return new URLSearchParams(window.location.search).get(nombre);
  }

  private retardo(defecto: number): number {
    return Number(this.parametro("mockRetardo")) || defecto;
  }
}
