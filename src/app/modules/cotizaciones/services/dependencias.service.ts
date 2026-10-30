import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { catchError, map, Observable, throwError } from "rxjs";
import {
  DependenciaOikos,
  OpcionDependencia,
} from "../models/dependencia.model";
import { environment } from "src/environments/environment";

@Injectable({ providedIn: "root" })
export class DependenciasService {
  private readonly url = `${environment.OIKOS_SERVICE.replace(/\/+$/, "")}/dependencia`;

  constructor(private readonly http: HttpClient) {}

  obtenerDependencias(): Observable<OpcionDependencia[]> {
    return this.http.get<unknown>(this.url).pipe(
      map((respuesta) =>
        this.validarRespuesta(respuesta)
          .filter((dependencia) => dependencia.Activo)
          .map((dependencia) => ({
            valor: String(dependencia.Id),
            etiqueta: dependencia.Nombre,
          })),
      ),
      catchError((error: unknown) => {
        console.error(`No fue posible cargar ${this.url}.`, error);
        return throwError(() => error);
      }),
    );
  }

  private validarRespuesta(respuesta: unknown): DependenciaOikos[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${this.url} no es un arreglo.`);
    }

    return respuesta.map((registro: unknown) => {
      if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
        throw new Error(`La respuesta de ${this.url} contiene un registro inválido.`);
      }

      const dependencia = registro as Record<string, unknown>;
      const id = dependencia["Id"];
      const nombre = dependencia["Nombre"];
      const activo = dependencia["Activo"];
      if (
        typeof id !== "number" ||
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
