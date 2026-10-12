import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface TipoLugar {
  Id: number;
  Nombre?: string;
  CodigoAbreviacion?: string;
  Activo?: boolean;
}

interface Lugar {
  Id: number;
  Nombre?: string;
  Activo?: boolean;
  TipoLugarId?: TipoLugar | null;
}

export interface OpcionLugar {
  id: number;
  nombre: string;
}

export interface CatalogosUbicacionesPersonaJuridica {
  departamentos: OpcionLugar[];
  ciudades: OpcionLugar[];
}

type ClasificacionLugar = 'pais' | 'departamento' | 'ciudad';

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaUbicacionesService {
  private readonly ubicacionesUrl = environment.UBICACIONES_SERVICE.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  obtenerCatalogos(): Observable<CatalogosUbicacionesPersonaJuridica> {
    return forkJoin({
      tipos: this.http.get<unknown>(`${this.ubicacionesUrl}/tipo_lugar`),
      lugares: this.http.get<unknown>(`${this.ubicacionesUrl}/lugar`),
    }).pipe(
      map(({ tipos, lugares }) => {
        const tiposLugar = this.validarTipos(tipos);
        const registrosLugar = this.validarLugares(lugares);
        const idsPorClasificacion = new Map<ClasificacionLugar, Set<number>>([
          ['pais', new Set<number>()],
          ['departamento', new Set<number>()],
          ['ciudad', new Set<number>()],
        ]);

        for (const tipo of tiposLugar) {
          if (tipo.Activo === false) {
            continue;
          }
          const clasificacion = this.clasificarTipo(tipo);
          if (clasificacion) {
            idsPorClasificacion.get(clasificacion)?.add(tipo.Id);
          }
        }

        const ciudades: OpcionLugar[] = [];
        const departamentos: OpcionLugar[] = [];
        const idsCiudades = idsPorClasificacion.get('ciudad')!;
        const idsDepartamentos = idsPorClasificacion.get('departamento')!;

        for (const lugar of registrosLugar) {
          if (lugar.Activo === false || !lugar.TipoLugarId) {
            continue;
          }
          const opcion = {
            id: lugar.Id,
            nombre: this.nombreRequerido(lugar.Nombre, 'lugar'),
          };
          if (idsDepartamentos.has(lugar.TipoLugarId.Id)) {
            departamentos.push(opcion);
          } else if (idsCiudades.has(lugar.TipoLugarId.Id)) {
            ciudades.push(opcion);
          }
        }

        return { departamentos, ciudades };
      }),
    );
  }

  private validarTipos(respuesta: unknown): TipoLugar[] {
    return this.validarArreglo<TipoLugar>(respuesta, 'tipo_lugar', (registro, indice) => {
      const cuerpo = this.objetoRequerido(registro, `tipo_lugar[${indice}]`);
      return {
        Id: this.idRequerido(cuerpo['Id'], `tipo_lugar[${indice}].Id`),
        Nombre: this.textoOpcional(cuerpo['Nombre'], `tipo_lugar[${indice}].Nombre`),
        CodigoAbreviacion: this.textoOpcional(
          cuerpo['CodigoAbreviacion'],
          `tipo_lugar[${indice}].CodigoAbreviacion`,
        ),
        Activo: this.booleanoOpcional(cuerpo['Activo'], `tipo_lugar[${indice}].Activo`),
      };
    });
  }

  private validarLugares(respuesta: unknown): Lugar[] {
    return this.validarArreglo<Lugar>(respuesta, 'lugar', (registro, indice) => {
      const cuerpo = this.objetoRequerido(registro, `lugar[${indice}]`);
      return {
        Id: this.idRequerido(cuerpo['Id'], `lugar[${indice}].Id`),
        Nombre: this.textoOpcional(cuerpo['Nombre'], `lugar[${indice}].Nombre`),
        Activo: this.booleanoOpcional(cuerpo['Activo'], `lugar[${indice}].Activo`),
        TipoLugarId: this.referenciaTipoLugarOpcional(
          cuerpo['TipoLugarId'],
          `lugar[${indice}].TipoLugarId`,
        ),
      };
    });
  }

  private validarArreglo<T>(
    respuesta: unknown,
    recurso: string,
    transformar: (registro: unknown, indice: number) => T,
  ): T[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${recurso} no es un arreglo directo.`);
    }
    return respuesta.map(transformar);
  }

  private referenciaTipoLugarOpcional(
    valor: unknown,
    campo: string,
  ): TipoLugar | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }
    const referencia = this.objetoRequerido(valor, campo);
    return {
      Id: this.idRequerido(referencia['Id'], `${campo}.Id`),
      Nombre: this.textoOpcional(referencia['Nombre'], `${campo}.Nombre`),
      CodigoAbreviacion: this.textoOpcional(
        referencia['CodigoAbreviacion'],
        `${campo}.CodigoAbreviacion`,
      ),
      Activo: this.booleanoOpcional(referencia['Activo'], `${campo}.Activo`),
    };
  }

  private clasificarTipo(tipo: TipoLugar): ClasificacionLugar | undefined {
    const codigo = this.normalizar(tipo.CodigoAbreviacion ?? '');
    const nombre = this.normalizar(tipo.Nombre ?? '');
    if (codigo === 'p' || nombre === 'pais') {
      return 'pais';
    }
    if (codigo === 'd' || nombre === 'departamento') {
      return 'departamento';
    }
    if (codigo === 'c' || nombre === 'ciudad') {
      return 'ciudad';
    }
    return undefined;
  }

  private objetoRequerido(valor: unknown, campo: string): Record<string, unknown> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
      throw new Error(`La respuesta contiene "${campo}" que no es un objeto.`);
    }
    return valor as Record<string, unknown>;
  }

  private idRequerido(valor: unknown, campo: string): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      throw new Error(`La respuesta contiene "${campo}" que no es un ID entero.`);
    }
    return valor;
  }

  private textoOpcional(valor: unknown, campo: string): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== 'string') {
      throw new Error(`La respuesta contiene "${campo}" que no es texto.`);
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

  private nombreRequerido(nombre: string | undefined, recurso: string): string {
    if (typeof nombre !== 'string' || nombre.length === 0) {
      throw new Error(`La respuesta contiene un registro activo de ${recurso} sin Nombre.`);
    }
    return nombre;
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
