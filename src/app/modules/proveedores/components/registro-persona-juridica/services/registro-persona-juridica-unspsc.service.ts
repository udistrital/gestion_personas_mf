import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface RespuestaUnspsc {
  value?: unknown;
}

export interface OpcionUnspsc {
  id: number;
  parentId: number | null;
  codigo: string;
  titulo: string;
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaUnspscService {
  constructor(private readonly http: HttpClient) {}

  obtenerCatalogo(): Observable<OpcionUnspsc[]> {
    return this.http.get<unknown>(environment.UNGM_UNSPSC_SERVICE).pipe(
      map(respuesta => {
        if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
          throw new Error('La respuesta de UNGM no es un objeto OData.');
        }
        const registros = (respuesta as RespuestaUnspsc).value;
        if (!Array.isArray(registros)) {
          throw new Error('La respuesta de UNGM no contiene "value" como arreglo.');
        }

        return registros.map((registro, indice) => {
          if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
            throw new Error(`El registro UNSPSC en value[${indice}] no es un objeto.`);
          }
          const cuerpo = registro as Record<string, unknown>;
          const id = cuerpo['Id'];
          const parentId = cuerpo['ParentId'];
          const codigo = cuerpo['UNSPSCode'];
          const titulo = cuerpo['Title'];
          if (typeof id !== 'number' || !Number.isInteger(id)) {
            throw new Error(`El registro UNSPSC value[${indice}] tiene un Id inválido.`);
          }
          if (
            parentId !== null
            && (typeof parentId !== 'number' || !Number.isInteger(parentId))
          ) {
            throw new Error(`El registro UNSPSC value[${indice}] tiene un ParentId inválido.`);
          }
          if (typeof codigo !== 'string' || codigo.length === 0) {
            throw new Error(`El registro UNSPSC value[${indice}] tiene un UNSPSCode inválido.`);
          }
          if (typeof titulo !== 'string' || titulo.length === 0) {
            throw new Error(`El registro UNSPSC value[${indice}] tiene un Title inválido.`);
          }

          return { id, parentId, codigo, titulo };
        });
      }),
    );
  }
}
