import { inject } from "@angular/core";
import { ResolveFn } from "@angular/router";
import { catchError, map, of } from "rxjs";
import { SolicitudDetalle } from "../models/solicitud.model";
import { SolicitudesService } from "../services/solicitudes.service";

/**
 * Resultado de resolver la solicitud de `:id`.
 *
 * Distingue los tres desenlaces que la página del detalle debe saber pintar:
 * carga correcta, solicitud inexistente y error de la petición.
 */
export type ResultadoResolverSolicitud =
  | { readonly estado: "ok"; readonly solicitud: SolicitudDetalle }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "error"; readonly mensaje: string };

/**
 * Carga la solicitud de `:id` una sola vez para todo el árbol del detalle.
 *
 * Cuelga de la ruta padre `solicitudes/:id`, así que todas las pestañas leen la
 * misma instancia resuelta sin repetir la petición. Nunca interrumpe la
 * navegación: traduce la ausencia y el fallo a un resultado que la página
 * pinta como estado vacío o de error.
 */
export const solicitudResolver: ResolveFn<ResultadoResolverSolicitud> = (
  ruta,
) => {
  const servicio = inject(SolicitudesService);
  const id = ruta.paramMap.get("id") ?? "";

  return servicio.obtenerPorId(id).pipe(
    map((solicitud) =>
      solicitud
        ? ({ estado: "ok", solicitud } as const)
        : ({ estado: "no-encontrada" } as const),
    ),
    catchError((error: Error) =>
      of({ estado: "error", mensaje: error.message } as const),
    ),
  );
};
