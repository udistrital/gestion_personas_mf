import { inject } from "@angular/core";
import { ResolveFn } from "@angular/router";
import { catchError, map, of } from "rxjs";
import { DetalleInvitacionProveedor } from "../../../models/invitacion-proveedor.model";
import { SolicitudesService } from "../../../services/solicitudes.service";

export type ResultadoResolverDetalleProveedor =
  | { readonly estado: "ok"; readonly detalle: DetalleInvitacionProveedor }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "error"; readonly mensaje: string };

export const detalleProveedorResolver: ResolveFn<
  ResultadoResolverDetalleProveedor
> = (ruta) => {
  const servicio = inject(SolicitudesService);
  const id = ruta.paramMap.get("id") ?? "";

  return servicio.obtenerDetalleProveedor(id).pipe(
    map((detalle) =>
      detalle
        ? ({ estado: "ok", detalle } as const)
        : ({ estado: "no-encontrada" } as const),
    ),
    catchError((error: Error) =>
      of({ estado: "error", mensaje: error.message } as const),
    ),
  );
};
