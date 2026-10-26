import { Injectable } from "@angular/core";
import { Observable, of, throwError, delay } from "rxjs";
import { MATRIZ_ACCIONES_POR_ESTADO } from "src/app/core/constants/estados-solicitud.const";
import {
  AutorObservacion,
  NuevaObservacion,
  Observacion,
  RespuestaObservacionEntrada,
} from "../models/observacion.model";
import { Solicitud } from "../models/solicitud.model";

export type ContextoForoSolicitud = Pick<
  Solicitud,
  "id" | "estado" | "fechaLimiteObservaciones"
>;

/**
 * Contrato único de datos del foro; la implementación HTTP sustituirá al mock.
 * Pendiente: la propuesta no define si las respuestas alimentan la bitácora S-03.
 */
export abstract class ObservacionesService {
  abstract listarObservaciones(
    solicitudId: string,
  ): Observable<readonly Observacion[]>;

  abstract formularObservacion(
    solicitud: ContextoForoSolicitud,
    contenido: NuevaObservacion,
    autor: AutorObservacion,
  ): Observable<Observacion>;

  abstract responderObservacion(
    solicitud: ContextoForoSolicitud,
    entrada: RespuestaObservacionEntrada,
  ): Observable<Observacion>;
}

const AUTOR_EMPRESA: AutorObservacion = {
  nombre: "Sistemas & Soluciones Tecnológicas de Colombia S.A.S.",
  tipo: "persona-juridica",
  identificacion: "NIT: 901.482.304-8",
};

const AUTOR_EMPRESA_RED: AutorObservacion = {
  nombre: "Redes y Comunicaciones Bogotá Ltda.",
  tipo: "persona-juridica",
  identificacion: "NIT: 830.112.980-1",
};

const AUTOR_PERSONA: AutorObservacion = {
  nombre: "Álvaro Peña Salamanca",
  tipo: "persona-natural",
  identificacion: "C.C. 80.234.567 de Bogotá",
};

const OBSERVACIONES_INICIALES: readonly Observacion[] = [
  {
    id: "OBS-084",
    solicitudId: "SOL-2026-0044",
    radicado: "OBS-084",
    autor: AUTOR_EMPRESA,
    fechaIso: "2026-10-09T11:24:00-05:00",
    fecha: "09/10/2026 11:24 COT",
    contenidoHtml:
      "<p>Respecto al <strong>ítem 04 (Cableado Estructurado)</strong>, solicitamos aclarar si los 40 puntos deben incluir certificación categoría 6A blindada F/UTP o si se admite cableado U/UTP.</p><p>También sugerimos ampliar el plazo de entrega a 45 días hábiles.</p>",
    respuesta: {
      contenidoHtml:
        "<p>La dependencia técnica aclara que se mantiene la exigencia de categoría 6A F/UTP blindada. El plazo de entrega será de 40 días hábiles.</p>",
      autor: "Raúl Quimbaya",
      rol: "Ordenador del Gasto",
      fechaIso: "2026-10-09T16:15:00-05:00",
      fecha: "09/10/2026 16:15 COT",
      visibilidad: "publica",
    },
  },
  {
    id: "OBS-079",
    solicitudId: "SOL-2026-0044",
    radicado: "OBS-079",
    autor: AUTOR_EMPRESA_RED,
    fechaIso: "2026-10-08T15:40:00-05:00",
    fecha: "08/10/2026 15:40 COT",
    contenidoHtml:
      "<p>Solicitamos confirmar si la póliza de seriedad debe constituirse por el 10% del presupuesto oficial o del valor cotizado por cada proponente.</p>",
    respuesta: {
      contenidoHtml:
        "<p>La garantía de seriedad debe amparar el 10% del valor total de la oferta radicada con IVA incluido por cada proponente.</p>",
      autor: "Ricardo Gómez Morales",
      rol: "Ordenador del Gasto",
      fechaIso: "2026-10-08T17:15:00-05:00",
      fecha: "08/10/2026 17:15 COT",
      visibilidad: "publica",
    },
  },
  {
    id: "OBS-089",
    solicitudId: "SOL-2026-0044",
    radicado: "OBS-089",
    autor: AUTOR_PERSONA,
    fechaIso: "2026-10-10T09:12:00-05:00",
    fecha: "10/10/2026 09:12 COT",
    contenidoHtml:
      "<p>Consulta técnica sobre el soporte 24x7 del ítem 02. ¿Se requiere partner con certificación nivel Titanium o se admite nivel Gold?</p>",
  },
  {
    id: "OBS-028-01",
    solicitudId: "SOL-2026-0028",
    radicado: "OBS-028-01",
    autor: AUTOR_EMPRESA_RED,
    fechaIso: "2026-10-10T10:00:00-05:00",
    fecha: "10/10/2026 10:00 COT",
    contenidoHtml:
      "<p>Solicitamos aclarar el alcance de la póliza requerida para la ejecución del servicio de auditoría contable.</p>",
  },
  {
    id: "OBS-0005-01",
    solicitudId: "SOL-2026-0005",
    radicado: "OBS-0005-01",
    autor: AUTOR_EMPRESA,
    fechaIso: "2026-01-23T10:30:00-05:00",
    fecha: "23/01/2026 10:30 COT",
    contenidoHtml:
      "<p>Solicitamos precisar el alcance del licenciamiento incluido en la convocatoria.</p>",
  },
];

@Injectable()
export class ObservacionesServiceMock extends ObservacionesService {
  private observaciones = [...OBSERVACIONES_INICIALES];

  listarObservaciones(solicitudId: string): Observable<readonly Observacion[]> {
    const fallo = this.errorConfigurado();
    if (fallo) {
      return this.error(fallo);
    }
    return of(
      this.observaciones
        .filter((observacion) => observacion.solicitudId === solicitudId)
        .sort((a, b) => Date.parse(b.fechaIso) - Date.parse(a.fechaIso)),
    ).pipe(delay(this.retardo()));
  }

  formularObservacion(
    solicitud: ContextoForoSolicitud,
    contenido: NuevaObservacion,
    autor: AutorObservacion,
  ): Observable<Observacion> {
    const fallo = this.errorConfigurado();
    if (fallo) {
      return this.error(fallo);
    }

    if (!MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado].includes("foro")) {
      return this.error("El foro no está habilitado para esta solicitud.");
    }
    if (
      !solicitud.fechaLimiteObservaciones ||
      Date.parse(solicitud.fechaLimiteObservaciones) <= Date.now()
    ) {
      return this.error("El plazo para formular observaciones ya venció.");
    }

    const ahora = new Date();
    const numero = this.observaciones.length + 1;
    const observacion: Observacion = {
      id: `OBS-${solicitud.id}-${numero}`,
      solicitudId: solicitud.id,
      radicado: `OBS-${String(numero).padStart(3, "0")}`,
      autor,
      fechaIso: ahora.toISOString(),
      fecha: fechaCorta(ahora),
      contenidoHtml: contenido.contenidoHtml,
    };
    this.observaciones = [...this.observaciones, observacion];
    return of(observacion).pipe(delay(this.retardo()));
  }

  responderObservacion(
    solicitud: ContextoForoSolicitud,
    entrada: RespuestaObservacionEntrada,
  ): Observable<Observacion> {
    const fallo = this.errorConfigurado();
    if (fallo) {
      return this.error(fallo);
    }
    if (!MATRIZ_ACCIONES_POR_ESTADO[solicitud.estado].includes("foro")) {
      return this.error("El foro no está habilitado para esta solicitud.");
    }
    const observacion = this.observaciones.find(
      (actual) =>
        actual.id === entrada.observacionId &&
        actual.solicitudId === solicitud.id,
    );
    if (!observacion) {
      return this.error("La observación ya no está disponible.");
    }
    if (!entrada.editar && observacion.respuesta) {
      return this.error("La observación ya tiene una respuesta registrada.");
    }
    if (entrada.editar && !observacion.respuesta) {
      return this.error("No existe una respuesta para editar.");
    }
    if (
      entrada.editar &&
      (!solicitud.fechaLimiteObservaciones ||
        Date.parse(solicitud.fechaLimiteObservaciones) <= Date.now())
    ) {
      return this.error("El plazo para editar respuestas ya venció.");
    }

    const ahora = new Date();
    const actualizado: Observacion = {
      ...observacion,
      respuesta: {
        contenidoHtml: entrada.contenidoHtml,
        // Provisional: el mock no expone la identidad real de la sesión.
        autor: "Usuario autenticado",
        rol: "Solicitante",
        fechaIso: ahora.toISOString(),
        fecha: fechaCorta(ahora),
        visibilidad: "publica",
      },
    };
    this.observaciones = this.observaciones.map((actual) =>
      actual.id === actualizado.id ? actualizado : actual,
    );
    return of(actualizado).pipe(delay(this.retardo()));
  }

  private errorConfigurado(): string | null {
    const params = new URLSearchParams(window.location.search);
    // `?mockForo=error` permite revisar estados de error de carga y envío.
    return params.get("mockForo") === "error"
      ? "No fue posible completar la operación del foro. Intente nuevamente."
      : null;
  }

  private retardo(): number {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("mockRetardo")) || 500;
  }

  private error(mensaje: string): Observable<never> {
    return throwError(() => new Error(mensaje)).pipe(delay(this.retardo()));
  }
}

function fechaCorta(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(fecha);
  return `${partes} COT`;
}
