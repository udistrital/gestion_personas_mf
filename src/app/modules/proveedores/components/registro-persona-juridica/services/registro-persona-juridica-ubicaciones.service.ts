import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { descartarRegistrosVacios, obtenerTodasLasPaginas } from './registro-persona-juridica-paginacion';

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
  CodigoTipoLugar: string;
}

interface TipoRelacionLugar {
  Id: number;
  CodigoAbreviacion: string;
  Activo?: boolean;
}

interface RelacionLugares {
  Id: number;
  Activo: boolean;
  LugarPadreId: ReferenciaLugar;
  LugarHijoId: ReferenciaLugar;
  TipoRelacionLugarId: TipoRelacionLugar;
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
  private readonly lugaresPorTipo = new Map<string, Observable<Lugar[]>>();
  private readonly relacionesPorPadre = new Map<number, Observable<RelacionLugares[]>>();

  constructor(private readonly http: HttpClient) {}

  obtenerDepartamentos(): Observable<CatalogosUbicacionesPersonaJuridica> {
    return this.obtenerLugaresPorTipo('P').pipe(
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
        this.obtenerRelacionesDePadre(colombia.Id).pipe(
          map(relaciones => ({
            pais: this.aOpcion(colombia),
            departamentos: this.hijosDe(relaciones, colombia.Id, 'D'),
          })),
        ),
      ),
    );
  }

  obtenerCiudades(departamento: OpcionLugar): Observable<OpcionLugar[]> {
    return this.obtenerRelacionesDePadre(departamento.id).pipe(
      map(relaciones => this.hijosDe(relaciones, departamento.id, 'C')),
    );
  }

  private hijosDe(
    relaciones: RelacionLugares[],
    idPadre: number,
    codigoTipoHijo: string,
  ): OpcionLugar[] {
    const hijos = new Map<number, OpcionLugar>();
    for (const relacion of relaciones) {
      const padre = relacion.LugarPadreId;
      const hijo = relacion.LugarHijoId;
      if (
        relacion.Activo
        && relacion.TipoRelacionLugarId.CodigoAbreviacion === 'CON'
        && padre.Activo !== false
        && padre.Id === idPadre
        && hijo.Activo !== false
        && hijo.CodigoTipoLugar === codigoTipoHijo
      ) {
        hijos.set(hijo.Id, { id: hijo.Id, nombre: hijo.Nombre });
      }
    }
    return [...hijos.values()];
  }

  obtenerProcedencias(): Observable<OpcionLugar[]> {
    return this.obtenerOpcionesPorTipo('C');
  }

  obtenerTiposVia(): Observable<OpcionLugar[]> {
    return this.obtenerOpcionesPorTipo('DIRECCIONES');
  }

  obtenerTiposInterior(): Observable<OpcionLugar[]> {
    return this.obtenerOpcionesPorTipo('INTERIORES');
  }

  private obtenerOpcionesPorTipo(codigoTipoLugar: string): Observable<OpcionLugar[]> {
    return this.obtenerLugaresPorTipo(codigoTipoLugar).pipe(
      map(lugares =>
        lugares
          .filter(
            lugar =>
              lugar.Activo !== false && lugar.TipoLugarId.CodigoAbreviacion === codigoTipoLugar,
          )
          .map(lugar => this.aOpcion(lugar)),
      ),
    );
  }

  private obtenerLugaresPorTipo(codigoTipoLugar: string): Observable<Lugar[]> {
    const existente = this.lugaresPorTipo.get(codigoTipoLugar);
    if (existente) {
      return existente;
    }
    const query = `TipoLugarId.CodigoAbreviacion:${codigoTipoLugar}`;
    const solicitud = obtenerTodasLasPaginas<Lugar>(
      (limit, offset) => {
        const params = new HttpParams()
          .set('query', query)
          .set('limit', String(limit))
          .set('offset', String(offset));
        return this.http
          .get<unknown>(`${this.ubicacionesUrl}/lugar`, { params })
          .pipe(map(respuesta => this.validarLugares(respuesta, '/lugar')));
      },
      lugar => lugar.Id,
      '/lugar',
    ).pipe(
      catchError(error => {
        this.lugaresPorTipo.delete(codigoTipoLugar);
        console.error(`No fue posible cargar /lugar (query "${query}").`, error);
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.lugaresPorTipo.set(codigoTipoLugar, solicitud);
    return solicitud;
  }

  private obtenerRelacionesDePadre(idPadre: number): Observable<RelacionLugares[]> {
    const existente = this.relacionesPorPadre.get(idPadre);
    if (existente) {
      return existente;
    }
    const query = `LugarPadreId.Id:${idPadre}`;
    const solicitud = obtenerTodasLasPaginas<RelacionLugares>(
      (limit, offset) => {
        const params = new HttpParams()
          .set('query', query)
          .set('limit', String(limit))
          .set('offset', String(offset));
        return this.http
          .get<unknown>(`${this.ubicacionesUrl}/relacion_lugares`, { params })
          .pipe(map(respuesta => this.validarRelaciones(respuesta)));
      },
      relacion => relacion.Id,
      '/relacion_lugares',
    ).pipe(
      catchError(error => {
        this.relacionesPorPadre.delete(idPadre);
        console.error(`No fue posible cargar /relacion_lugares (query "${query}").`, error);
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.relacionesPorPadre.set(idPadre, solicitud);
    return solicitud;
  }

  private validarLugares(respuesta: unknown, recurso: string): Lugar[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${recurso} no es un arreglo directo.`);
    }
    return descartarRegistrosVacios(respuesta).map((registro, indice) => {
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
    return descartarRegistrosVacios(respuesta).map((registro, indice) => {
      const relacion = this.objetoRequerido(registro, `/relacion_lugares[${indice}]`);
      return {
        Id: this.idRequerido(relacion['Id'], `/relacion_lugares[${indice}].Id`),
        Activo: this.booleanoRequerido(
          relacion['Activo'],
          `/relacion_lugares[${indice}].Activo`,
        ),
        LugarPadreId: this.validarReferenciaLugar(
          relacion['LugarPadreId'],
          `/relacion_lugares[${indice}].LugarPadreId`,
        ),
        LugarHijoId: this.validarReferenciaLugar(
          relacion['LugarHijoId'],
          `/relacion_lugares[${indice}].LugarHijoId`,
        ),
        TipoRelacionLugarId: this.validarTipoRelacionLugar(
          relacion['TipoRelacionLugarId'],
          `/relacion_lugares[${indice}].TipoRelacionLugarId`,
        ),
      };
    });
  }

  private esObjeto(valor: unknown): valor is Record<string, unknown> {
    return Boolean(valor && typeof valor === 'object' && !Array.isArray(valor));
  }

  private validarReferenciaLugar(valor: unknown, campo: string): ReferenciaLugar {
    const lugar = this.objetoRequerido(valor, campo);
    const tipoLugar = this.objetoRequerido(lugar['TipoLugarId'], `${campo}.TipoLugarId`);
    return {
      Id: this.idRequerido(lugar['Id'], `${campo}.Id`),
      Nombre: this.nombreRequerido(lugar['Nombre'], `${campo}.Nombre`),
      Activo: this.booleanoOpcional(lugar['Activo'], `${campo}.Activo`),
      CodigoTipoLugar: this.nombreRequerido(
        tipoLugar['CodigoAbreviacion'],
        `${campo}.TipoLugarId.CodigoAbreviacion`,
      ),
    };
  }

  private validarTipoRelacionLugar(valor: unknown, campo: string): TipoRelacionLugar {
    const tipo = this.objetoRequerido(valor, campo);
    return {
      Id: this.idRequerido(tipo['Id'], `${campo}.Id`),
      CodigoAbreviacion: this.nombreRequerido(
        tipo['CodigoAbreviacion'],
        `${campo}.CodigoAbreviacion`,
      ),
      Activo: this.booleanoOpcional(tipo['Activo'], `${campo}.Activo`),
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

  private aOpcion(lugar: Lugar): OpcionLugar {
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
