import { Injectable } from "@angular/core";
import { Observable, delay, of, tap, throwError } from "rxjs";
import type {
  BaseRespuestaProveedor,
  RespuestaProveedor,
} from "../models/respuesta-proveedor.model";
import type { DetalleInvitacionProveedor } from "../models/invitacion-proveedor.model";
import { SolicitudesService } from "./solicitudes.service";

export abstract class RespuestaProveedorService {
  abstract obtenerBase(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseRespuestaProveedor>;
  abstract guardarBorrador(
    respuesta: RespuestaProveedor,
  ): Observable<void>;
  abstract eliminarBorrador(
    solicitudId: string,
    proveedorId: string,
  ): Observable<void>;
  abstract enviar(respuesta: RespuestaProveedor): Observable<RespuestaProveedor>;
}

@Injectable()
export class RespuestaProveedorServiceMock extends RespuestaProveedorService {
  private readonly respuestas = new Map<string, RespuestaProveedor>();

  constructor(private readonly solicitudes: SolicitudesService) {
    super();
  }

  obtenerBase(
    detalle: DetalleInvitacionProveedor,
    proveedorId: string,
  ): Observable<BaseRespuestaProveedor> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockRespuestaCarga") === "error") {
      return throwError(
        () => new Error("No fue posible cargar los datos de la respuesta."),
      ).pipe(delay(this.retardo()));
    }
    const respuesta = this.respuestas.get(this.clave(detalle.solicitud.id, proveedorId)) ?? null;
    return of({
      items: detalle.solicitud.items,
      documentos: detalle.solicitud.documentos?.requeridos ?? [],
      respuesta,
    }).pipe(delay(this.retardo()));
  }

  guardarBorrador(respuesta: RespuestaProveedor): Observable<void> {
    if (this.forzarError()) {
      return throwError(() => new Error("No fue posible guardar el borrador."));
    }
    this.respuestas.set(
      this.clave(respuesta.solicitudId, respuesta.proveedorId),
      { ...respuesta, estado: "borrador", archivos: [] },
    );
    return of(void 0).pipe(delay(this.retardo()));
  }

  eliminarBorrador(
    solicitudId: string,
    proveedorId: string,
  ): Observable<void> {
    this.respuestas.delete(this.clave(solicitudId, proveedorId));
    return of(void 0).pipe(delay(this.retardo()));
  }

  enviar(respuesta: RespuestaProveedor): Observable<RespuestaProveedor> {
    if (this.forzarError()) {
      return throwError(() => new Error("No fue posible enviar la respuesta."));
    }
    const enviada: RespuestaProveedor = {
      ...respuesta,
      estado: "enviada",
      fechaRadicacion: new Date().toISOString(),
      radicado: `COT-${Date.now()}`,
    };
    return of(enviada).pipe(
      delay(this.retardo()),
      tap((registrada) => {
        this.respuestas.set(
          this.clave(registrada.solicitudId, registrada.proveedorId),
          { ...registrada, archivos: [] },
        );
        this.solicitudes.registrarRespuestaProveedor(
          registrada.solicitudId,
          registrada.fechaRadicacion ?? new Date().toISOString(),
        );
      }),
    );
  }

  private clave(solicitudId: string, proveedorId: string): string {
    return `${solicitudId}:${proveedorId}`;
  }

  private retardo(): number {
    return Number(new URLSearchParams(window.location.search).get("mockRetardo")) || 700;
  }

  private forzarError(): boolean {
    return new URLSearchParams(window.location.search).get("mockRespuesta") === "error";
  }
}
