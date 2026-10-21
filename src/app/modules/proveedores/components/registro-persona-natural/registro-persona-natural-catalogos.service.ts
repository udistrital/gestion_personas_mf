import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, shareReplay, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  descartarRegistrosVacios,
  obtenerTodasLasPaginas,
} from '../registro-persona-juridica/services/registro-persona-juridica-paginacion';

type Registro = Record<string, unknown>;

export interface OpcionNatural {
  id: number;
  nombre: string;
  codigo?: string;
}

export const PREGUNTAS_BOOLEANAS_PERSONA_NATURAL = {
  grupo: 'Grupo_9',
  codigos: {
    esMigrante: 'MIGRANTE',
    victimaConflictoArmado: 'VICTIMA_CONFLICTO',
    tieneHijos: 'HIJOS',
    esCabezaFamilia: 'CABEZA_FAMILIA',
    esPep: 'PERSONA_PEP',
    personasACargo: 'PERSONAS_A_CARGO',
    declaranteRenta: 'DECLARANTE_RENTA',
    medicinaPrepagada: 'MED_PREPAGADA',
    cuentaAfc: 'CUENTA_AFC',
    responsableIva: 'RESPONSABLE_IVA',
    resideFiscalmenteColombia: 'RESIDE_FIS_COL',
    aportesPensionVoluntaria: 'PENSION_VOL',
  },
} as const;

export const CAMPOS_COMPLEMENTARIOS_PERSONA_NATURAL = {
  grupo: 'Grupo_9',
  codigos: {
    numeroHijos: 'NUMERO_HIJOS',
  },
} as const;

export interface CatalogosPersonaNaturalPaso1 {
  tiposDocumento: OpcionNatural[];
  paises: OpcionNatural[];
  genero: OpcionNatural[];
  perfilRolPrincipal: OpcionNatural[];
  grupoEtnico: OpcionNatural[];
  seReconoceComo: OpcionNatural[];
  orientacionSexual: OpcionNatural[];
  estadoCivil: OpcionNatural[];
  discapacidad: OpcionNatural[];
  tiposVia: OpcionNatural[];
  tiposInterior: OpcionNatural[];
}

export type CatalogosUbicacionesPaso1 = Pick<
  CatalogosPersonaNaturalPaso1,
  'paises' | 'tiposVia' | 'tiposInterior'
>;
export type CatalogosTercerosPaso1 = Omit<CatalogosPersonaNaturalPaso1, keyof CatalogosUbicacionesPaso1>;

export interface CatalogosPersonaNaturalPaso2 {
  eps: OpcionNatural[];
  afp: OpcionNatural[];
  ccf: OpcionNatural[];
  entidadesBancarias: OpcionNatural[];
  tiposCuenta: OpcionNatural[];
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaNaturalCatalogosService {
  private readonly tercerosUrl = environment.TERCEROS_SERVICE.replace(/\/+$/, '');
  private readonly parametrosUrl = environment.PARAMETROS_SERVICE.replace(/\/+$/, '');
  private readonly ubicacionesUrl = environment.UBICACIONES_SERVICE.replace(/\/+$/, '');
  private readonly solicitudes = new Map<string, Observable<Registro[]>>();

  constructor(private readonly http: HttpClient) {}

  // Cada origen se carga por separado para que un fallo de Terceros no oculte lo que sí respondió Ubicaciones.
  obtenerCatalogosUbicacionesPaso1(): Observable<CatalogosUbicacionesPaso1> {
    return forkJoin({
      paises: this.lugares('P'),
      tiposVia: this.lugares('DIRECCIONES'),
      tiposInterior: this.lugares('INTERIORES'),
    });
  }

  obtenerCatalogosTercerosPaso1(): Observable<CatalogosTercerosPaso1> {
    return forkJoin({
      tiposDocumento: this.opciones(`${this.tercerosUrl}/tipo_documento`, undefined, false),
      genero: this.complementaria('Grupo_6'),
      perfilRolPrincipal: this.complementaria('Grupo_5'),
      grupoEtnico: this.complementaria('Grupo_3'),
      seReconoceComo: this.complementaria('IDENTIDAD_GENERO'),
      orientacionSexual: this.complementaria('ORIENTACION_SEXUAL'),
      estadoCivil: this.complementaria('Grupo_2'),
      discapacidad: this.complementaria('Grupo_1'),
    });
  }

  obtenerCatalogosPaso2(): Observable<CatalogosPersonaNaturalPaso2> {
    return forkJoin({
      eps: this.parametro('EPS'),
      afp: this.parametro('EFP'),
      ccf: this.parametro('CCF'),
      entidadesBancarias: this.parametro('EB'),
      tiposCuenta: this.parametro('TCB'),
    });
  }

  // Departamentos de un país o ciudades de un departamento, según la relación padre-hijo de Ubicaciones.
  obtenerHijos(idPadre: number, codigoTipoHijo: 'D' | 'C'): Observable<OpcionNatural[]> {
    return this.consultar(
      `${this.ubicacionesUrl}/relacion_lugares`,
      `LugarPadreId.Id:${idPadre}`,
      false,
    ).pipe(
      map(relaciones => {
        const hijos = new Map<number, OpcionNatural>();
        for (const relacion of relaciones) {
          const padre = this.objeto(relacion['LugarPadreId']);
          const hijo = this.objeto(relacion['LugarHijoId']);
          const tipoHijo = this.objeto(hijo?.['TipoLugarId']);
          const tipoRelacion = this.objeto(relacion['TipoRelacionLugarId']);
          if (
            relacion['Activo'] !== false
            && tipoRelacion?.['CodigoAbreviacion'] === 'CON'
            && padre?.['Id'] === idPadre
            && hijo
            && hijo['Activo'] !== false
            && tipoHijo?.['CodigoAbreviacion'] === codigoTipoHijo
            && typeof hijo['Id'] === 'number'
            && typeof hijo['Nombre'] === 'string'
            && hijo['Nombre'].length > 0
          ) {
            hijos.set(hijo['Id'], { id: hijo['Id'], nombre: hijo['Nombre'] });
          }
        }
        return [...hijos.values()];
      }),
    );
  }

  private complementaria(codigoGrupo: string): Observable<OpcionNatural[]> {
    return this.opciones(
      `${this.tercerosUrl}/info_complementaria`,
      `GrupoInfoComplementariaId.CodigoAbreviacion:${codigoGrupo}`,
      false,
    );
  }

  private parametro(codigoTipo: string): Observable<OpcionNatural[]> {
    return this.opciones(
      `${this.parametrosUrl}/parametro`,
      `TipoParametroId.CodigoAbreviacion:${codigoTipo}`,
      true,
    );
  }

  private lugares(codigoTipoLugar: string): Observable<OpcionNatural[]> {
    return this.consultar(
      `${this.ubicacionesUrl}/lugar`,
      `TipoLugarId.CodigoAbreviacion:${codigoTipoLugar}`,
      false,
    ).pipe(
      map(lugares =>
        lugares
          .filter(
            lugar =>
              lugar['Activo'] !== false
              && this.objeto(lugar['TipoLugarId'])?.['CodigoAbreviacion'] === codigoTipoLugar,
          )
          .map(lugar => ({ id: lugar['Id'] as number, nombre: this.nombre(lugar) })),
      ),
    );
  }

  private opciones(
    url: string,
    query: string | undefined,
    envueltaEnData: boolean,
  ): Observable<OpcionNatural[]> {
    return this.consultar(url, query, envueltaEnData).pipe(
      map(registros => {
        const opciones = registros
          .filter(registro => registro['Activo'] !== false)
          .map(registro => ({
            id: registro['Id'] as number,
            nombre: this.nombre(registro),
            codigo:
              typeof registro['CodigoAbreviacion'] === 'string'
                ? registro['CodigoAbreviacion']
                : undefined,
            orden: registro['NumeroOrden'],
          }));
        const ordenadas = opciones.every(opcion => typeof opcion.orden === 'number')
          ? [...opciones].sort((a, b) => Number(a.orden) - Number(b.orden))
          : opciones;
        return ordenadas.map(({ id, nombre, codigo }) => ({ id, nombre, codigo }));
      }),
    );
  }

  private consultar(
    url: string,
    query: string | undefined,
    envueltaEnData: boolean,
  ): Observable<Registro[]> {
    const clave = `${url}|${query ?? ''}`;
    const existente = this.solicitudes.get(clave);
    if (existente) {
      return existente;
    }

    const solicitud = obtenerTodasLasPaginas<Registro>(
      (limit, offset) => {
        let params = new HttpParams().set('limit', String(limit)).set('offset', String(offset));
        if (query) {
          params = params.set('query', query);
        }
        return this.http
          .get<unknown>(url, { params })
          .pipe(map(respuesta => this.extraerRegistros(respuesta, url, envueltaEnData)));
      },
      registro => registro['Id'] as number,
      url,
    ).pipe(
      catchError(error => {
        this.solicitudes.delete(clave);
        console.error(`No fue posible cargar ${url} (query "${query ?? ''}").`, error);
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.solicitudes.set(clave, solicitud);
    return solicitud;
  }

  private extraerRegistros(respuesta: unknown, url: string, envueltaEnData: boolean): Registro[] {
    let registros: unknown = respuesta;
    if (envueltaEnData) {
      const cuerpo = this.objeto(respuesta);
      if (!cuerpo) {
        throw new Error(`La respuesta de ${url} no contiene un objeto con Data.`);
      }
      registros = cuerpo['Data'];
    }
    if (!Array.isArray(registros)) {
      throw new Error(`La respuesta de ${url} no contiene un arreglo de registros.`);
    }
    return descartarRegistrosVacios(registros).map(registro => {
      const objeto = this.objeto(registro);
      if (!objeto || typeof objeto['Id'] !== 'number' || !Number.isInteger(objeto['Id'])) {
        throw new Error(`La respuesta de ${url} contiene un registro sin Id entero.`);
      }
      return objeto;
    });
  }

  private nombre(registro: Registro): string {
    const nombre = registro['Nombre'] ?? registro['Descripcion'];
    if (typeof nombre !== 'string' || nombre.length === 0) {
      throw new Error(`El registro con Id ${String(registro['Id'])} no contiene Nombre.`);
    }
    return nombre;
  }

  private objeto(valor: unknown): Registro | null {
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Registro) : null;
  }
}
