import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { catchError, map, Observable, shareReplay, throwError } from "rxjs";
import {
  descartarRegistrosVacios,
  obtenerTodasLasPaginas,
} from "src/app/modules/proveedores/components/registro-persona-juridica/services/registro-persona-juridica-paginacion";
import {
  DependenciaOikos,
  OpcionDependencia,
} from "../models/dependencia.model";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class DependenciasService {
  private readonly url = `${environment.OIKOS_SERVICE.replace(/\/+$/, "")}/dependencia`;
  private dependencias$?: Observable<OpcionDependencia[]>;

  constructor(private readonly http: HttpClient) {}

  obtenerDependencias(): Observable<OpcionDependencia[]> {
    if (this.dependencias$) {
      return this.dependencias$;
    }

    const solicitud = obtenerTodasLasPaginas<DependenciaOikos>(
      (limit, offset) => {
        const params = new HttpParams()
          .set("limit", String(limit))
          .set("offset", String(offset));
        return this.http
          .get<unknown>(this.url, { params })
          .pipe(map((respuesta) => this.validarRespuesta(respuesta)));
      },
      (dependencia) => dependencia.Id,
      "/dependencia",
    ).pipe(
      map((dependencias) =>
        dependencias
          .filter((dependencia) => dependencia.Activo)
          .map((dependencia) => ({
            valor: dependencia.Id,
            etiqueta: dependencia.Nombre,
          })),
      ),
      catchError((error: unknown) => {
        this.dependencias$ = undefined;
        console.error(`No fue posible cargar ${this.url}.`, error);
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.dependencias$ = solicitud;
    return solicitud;
  }

  private validarRespuesta(respuesta: unknown): DependenciaOikos[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${this.url} no es un arreglo.`);
    }

    return descartarRegistrosVacios(respuesta).map((registro: unknown) => {
      if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
        throw new Error(`La respuesta de ${this.url} contiene un registro inválido.`);
      }

      const dependencia = registro as Record<string, unknown>;
      const id = dependencia["Id"];
      const nombre = dependencia["Nombre"];
      const activo = dependencia["Activo"];
      if (
        typeof id !== "number" ||
        !Number.isInteger(id) ||
        typeof nombre !== "string" ||
        typeof activo !== "boolean"
      ) {
        throw new Error(`La respuesta de ${this.url} contiene una dependencia incompleta.`);
      }

      return {
        Id: id,
        Nombre: nombre,
        Activo: activo,
      };
    });
  }
}
