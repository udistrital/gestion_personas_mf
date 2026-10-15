import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';

interface TipoLugar {
  Id: number;
  CodigoAbreviacion: string;
  Nombre?: string;
  Activo?: boolean;
}

interface Lugar {
  Id: number;
  Nombre: string;
  Activo?: boolean;
  TipoLugarId: TipoLugar;
}

interface ReferenciaLugar {
  Id: number;
  Nombre: string;
  Activo?: boolean;
  TipoLugarId: TipoLugar;
}

interface RelacionLugares {
  Id: number;
  Activo: boolean;
  LugarPadre: ReferenciaLugar;
  LugarHijo: ReferenciaLugar;
}

export interface OpcionLugar {
  id: number;
  nombre: string;
}

export interface CatalogosUbicacionesPersonaJuridica {
  pais: OpcionLugar;
  departamentos: OpcionLugar[];
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaUbicacionesService {
  private readonly ubicacionesUrl = environment.UBICACIONES_SERVICE.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  obtenerDepartamentos(): Observable<CatalogosUbicacionesPersonaJuridica> {
    const params = new HttpParams()
      .set('query', 'TipoLugarId.CodigoAbreviacion:P')
      .set('limit', '200');

    return this.http.get<unknown>(`${this.ubicacionesUrl}/lugar`, { params }).pipe(
      map(respuesta => this.validarLugares(respuesta, '/lugar')),
      map(lugares => {
        const colombia = lugares.find(
          lugar =>
            lugar.Activo !== false
            && lugar.TipoLugarId.CodigoAbreviacion === 'P'
            && lugar.Nombre.toLowerCase() === 'colombia',
        );
        if (!colombia) {
          throw new Error('No se encontró el lugar activo Colombia en GET /lugar.');
        }
        return colombia;
      }),
      switchMap(colombia =>
        this.obtenerRelaciones(colombia.Nombre, 100).pipe(
          map(relaciones => ({
            pais: this.aOpcion(colombia),
            departamentos: relaciones
              .filter(
                relacion =>
                  relacion.Activo
                  && relacion.LugarPadre.Activo !== false
                  && relacion.LugarPadre.Id === colombia.Id
                  && relacion.LugarPadre.TipoLugarId.CodigoAbreviacion === 'P'
                  && relacion.LugarHijo.Activo !== false
                  && relacion.LugarHijo.TipoLugarId.CodigoAbreviacion === 'D',
              )
              .map(relacion => this.aOpcion(relacion.LugarHijo)),
          })),
        ),
      ),
    );
  }

  obtenerCiudades(departamento: OpcionLugar): Observable<OpcionLugar[]> {
    return this.obtenerRelaciones(departamento.nombre, 200).pipe(
      map(relaciones =>
        relaciones
          .filter(
            relacion =>
              relacion.Activo
              && relacion.LugarPadre.Activo !== false
              && relacion.LugarPadre.Id === departamento.id
              && relacion.LugarPadre.TipoLugarId.CodigoAbreviacion === 'D'
              && relacion.LugarHijo.Activo !== false
              && relacion.LugarHijo.TipoLugarId.CodigoAbreviacion === 'C',
          )
          .map(relacion => this.aOpcion(relacion.LugarHijo)),
      ),
    );
  }

  private obtenerRelaciones(nombrePadre: string, limite: number): Observable<RelacionLugares[]> {
    const params = new HttpParams()
      .set('query', `LugarPadreId.Nombre:${nombrePadre}`)
      .set('limit', String(limite));

    return this.http
      .get<unknown>(`${this.ubicacionesUrl}/relacion_lugares`, { params })
      .pipe(map(respuesta => this.validarRelaciones(respuesta)));
  }

  private validarLugares(respuesta: unknown, recurso: string): Lugar[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${recurso} no es un arreglo directo.`);
    }
    return respuesta.map((registro, indice) => {
      const lugar = this.objetoRequerido(registro, `${recurso}[${indice}]`);
      return {
        Id: this.idRequerido(lugar['Id'], `${recurso}[${indice}].Id`),
        Nombre: this.nombreRequerido(lugar['Nombre'], `${recurso}[${indice}].Nombre`),
        Activo: this.booleanoOpcional(lugar['Activo'], `${recurso}[${indice}].Activo`),
        TipoLugarId: this.tipoLugarRequerido(
          lugar['TipoLugarId'],
          `${recurso}[${indice}].TipoLugarId`,
        ),
      };
    });
  }

  private validarRelaciones(respuesta: unknown): RelacionLugares[] {
    if (!Array.isArray(respuesta)) {
      throw new Error('La respuesta de /relacion_lugares no es un arreglo directo.');
    }
    return respuesta.map((registro, indice) => {
      const relacion = this.objetoRequerido(registro, `/relacion_lugares[${indice}]`);
      const padre = this.obtenerReferenciaRelacion(
        relacion,
        'LugarPadreId',
        'LugarPadre',
        `/relacion_lugares[${indice}]`,
      );
      const hijo = this.obtenerReferenciaRelacion(
        relacion,
        'LugarHijoId',
        'LugarHijo',
        `/relacion_lugares[${indice}]`,
      );

      return {
        Id: this.idRequerido(relacion['Id'], `/relacion_lugares[${indice}].Id`),
        Activo: this.booleanoRequerido(
          relacion['Activo'],
          `/relacion_lugares[${indice}].Activo`,
        ),
        LugarPadre: this.validarReferenciaLugar(
          padre,
          `/relacion_lugares[${indice}].LugarPadre`,
        ),
        LugarHijo: this.validarReferenciaLugar(
          hijo,
          `/relacion_lugares[${indice}].LugarHijo`,
        ),
      };
    });
  }

  private obtenerReferenciaRelacion(
    relacion: Record<string, unknown>,
    idKey: 'LugarPadreId' | 'LugarHijoId',
    expandedKey: 'LugarPadre' | 'LugarHijo',
    campo: string,
  ): unknown {
    const referenciaId = relacion[idKey];
    if (this.esObjeto(referenciaId)) {
      return referenciaId;
    }
    const referenciaExpandida = relacion[expandedKey];
    if (this.esObjeto(referenciaExpandida)) {
      return referenciaExpandida;
    }
    if (Object.prototype.hasOwnProperty.call(relacion, idKey)) {
      return relacion[idKey];
    }
    if (Object.prototype.hasOwnProperty.call(relacion, expandedKey)) {
      return relacion[expandedKey];
    }
    throw new Error(
      `La respuesta de ${campo} no contiene "${idKey}" ni "${expandedKey}".`,
    );
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return Boolean(valor && typeof valor === 'object' && !Array.isArray(valor));
  }

  private validarReferenciaLugar(valor: unknown, campo: string): ReferenciaLugar {
    const lugar = this.objetoRequerido(valor, campo);
    return {
      Id: this.idRequerido(lugar['Id'], `${campo}.Id`),
      Nombre: this.nombreRequerido(lugar['Nombre'], `${campo}.Nombre`),
      Activo: this.booleanoOpcional(lugar['Activo'], `${campo}.Activo`),
      TipoLugarId: this.tipoLugarRequerido(lugar['TipoLugarId'], `${campo}.TipoLugarId`),
    };
  }

  private tipoLugarRequerido(valor: unknown, campo: string): TipoLugar {
    const tipo = this.objetoRequerido(valor, campo);
    const codigo = tipo['CodigoAbreviacion'];
    if (typeof codigo !== 'string' || codigo.length === 0) {
      throw new Error(`La respuesta de Ubicaciones contiene un "${campo}.CodigoAbreviacion" inválido.`);
    }
    return {
      Id: this.idRequerido(tipo['Id'], `${campo}.Id`),
      CodigoAbreviacion: codigo,
      Activo: this.booleanoOpcional(tipo['Activo'], `${campo}.Activo`),
    };
  }

  private aOpcion(lugar: ReferenciaLugar | Lugar): OpcionLugar {
    return { id: lugar.Id, nombre: lugar.Nombre };
  }

  private objetoRequerido(valor: unknown, campo: string): Record<string, unknown> {
    if (!this.esObjeto(valor)) {
      throw new Error(`La respuesta contiene "${campo}" que no es un objeto.`);
    }
    return valor;
  }

  private idRequerido(valor: unknown, campo: string): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      throw new Error(`La respuesta contiene "${campo}" que no es un ID entero.`);
    }
    return valor;
  }

  private nombreRequerido(valor: unknown, campo: string): string {
    if (typeof valor !== 'string' || valor.length === 0) {
      throw new Error(`La respuesta contiene "${campo}" que no es un nombre válido.`);
    }
    return valor;
  }

  private booleanoRequerido(valor: unknown, campo: string): boolean {
    if (typeof valor !== 'boolean') {
      throw new Error(`La respuesta contiene "${campo}" que no es booleano.`);
    }
    return valor;
  }

  private booleanoOpcional(valor: unknown, campo: string): boolean | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== 'boolean') {
      throw new Error(`La respuesta contiene "${campo}" que no es booleano.`);
    }
    return valor;
  }
}
