import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface GrupoInfoComplementaria {
  Id: number;
  Nombre?: string;
  Descripcion?: string;
  CodigoAbreviacion?: string;
  Activo?: boolean;
}

interface ReferenciaParametro {
  Id: number;
  Nombre?: string;
}

interface RegistroCatalogo {
  Id: number;
  Nombre?: string;
  Descripcion?: string;
  CodigoAbreviacion?: string;
  Activo?: boolean;
  GrupoInfoComplementariaId?: GrupoInfoComplementaria | null;
  TipoParametroId?: ReferenciaParametro | null;
  ParametroPadreId?: ReferenciaParametro | number | null;
}

interface RespuestaParametros {
  Data?: unknown;
}

export interface OpcionCatalogo {
  id: number;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  parametroPadreId?: number | null;
}

export interface CatalogosPersonaJuridica {
  procedencia: OpcionCatalogo[];
  tipoOrganizacion: OpcionCatalogo[];
  tamanoEmpresa: OpcionCatalogo[];
  tipoCapital: OpcionCatalogo[];
  camaraComercio: OpcionCatalogo[];
  responsabilidadFiscal: OpcionCatalogo[];
  moneda: OpcionCatalogo[];
  tipoDocumento: OpcionCatalogo[];
  actividadEconomica: OpcionCatalogo[];
  tipoRepresentacion: OpcionCatalogo[];
  tipoDeclaracion: OpcionCatalogo[];
  cargo: OpcionCatalogo[];
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaCatalogosService {
  private readonly tercerosUrl = environment.TERCEROS_SERVICE.replace(/\/+$/, '');
  private readonly parametrosUrl = environment.PARAMETROS_SERVICE.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  obtenerCatalogos(): Observable<CatalogosPersonaJuridica> {
    return forkJoin({
      gruposInfoComplementaria: this.obtenerRegistros(
        `${this.tercerosUrl}/grupo_info_complementaria`,
      ),
      infoComplementaria: this.obtenerRegistros(`${this.tercerosUrl}/info_complementaria`),
      tiposParametro: this.obtenerRegistrosParametro(`${this.parametrosUrl}/tipo_parametro`),
      parametros: this.obtenerRegistrosParametro(`${this.parametrosUrl}/parametro`),
    }).pipe(
      map(({ gruposInfoComplementaria, infoComplementaria, tiposParametro, parametros }) => ({
          procedencia: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            ['procedencia'],
          ),
          tipoOrganizacion: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            ['tipo organizacion'],
          ),
          tamanoEmpresa: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            ['tamano empresa'],
          ),
          tipoCapital: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            ['tipo capital'],
          ),
          camaraComercio: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['camara_comercio', 'camara de comercio'],
          ),
          responsabilidadFiscal: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['responsabilidad_fiscal'],
          ),
          moneda: this.obtenerOpcionesParametro(tiposParametro, parametros, ['moneda']),
          tipoDocumento: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['tipo_documento'],
          ),
          actividadEconomica: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['actividad_economica'],
          ),
          tipoRepresentacion: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['tipo_representacion'],
          ),
          tipoDeclaracion: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['tipo_declaracion'],
          ),
          cargo: this.obtenerOpcionesParametro(tiposParametro, parametros, ['cargo']),
        })),
    );
  }

  private obtenerRegistros(url: string): Observable<RegistroCatalogo[]> {
    return this.http
      .get<unknown>(url)
      .pipe(map(respuesta => this.validarListaRegistros(respuesta, url, false)));
  }

  private obtenerRegistrosParametro(url: string): Observable<RegistroCatalogo[]> {
    return this.http
      .get<unknown>(url)
      .pipe(map(respuesta => this.validarListaRegistros(respuesta, url, true)));
  }

  private validarListaRegistros(
    respuesta: unknown,
    url: string,
    envueltaEnData: boolean,
  ): RegistroCatalogo[] {
    let registros: unknown = respuesta;
    if (envueltaEnData) {
      if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
        throw new Error(`La respuesta de ${url} no contiene un objeto con Data.`);
      }
      registros = (respuesta as RespuestaParametros).Data;
    }
    if (!Array.isArray(registros)) {
      throw new Error(
        `La respuesta de ${url} ${envueltaEnData ? 'no contiene Data como arreglo' : 'no es un arreglo directo de registros'}.`,
      );
    }

    return registros.map(registro => this.validarRegistro(registro, url, envueltaEnData));
  }

  private validarRegistro(
    registro: unknown,
    url: string,
    esParametro: boolean,
  ): RegistroCatalogo {
    if (!registro || typeof registro !== 'object') {
      throw new Error(`La respuesta de ${url} contiene un registro que no es un objeto.`);
    }

    const cuerpo = registro as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(cuerpo['Id'], url, 'Id'),
      Nombre: this.textoOpcional(cuerpo['Nombre'], url, 'Nombre'),
      Descripcion: this.textoOpcional(cuerpo['Descripcion'], url, 'Descripcion'),
      CodigoAbreviacion: this.textoOpcional(cuerpo['CodigoAbreviacion'], url, 'CodigoAbreviacion'),
      Activo: this.booleanoOpcional(cuerpo['Activo'], url, 'Activo'),
      ...(esParametro
        ? {
            TipoParametroId: this.referenciaParametroOpcional(
              cuerpo['TipoParametroId'],
              url,
              'TipoParametroId',
            ),
            ParametroPadreId: this.parametroPadreOpcional(cuerpo['ParametroPadreId'], url),
          }
        : {
            GrupoInfoComplementariaId: this.grupoInfoComplementariaOpcional(
              cuerpo['GrupoInfoComplementariaId'],
              url,
            ),
          }),
    };
  }

  private referenciaParametroOpcional(
    valor: unknown,
    url: string,
    campo: string,
  ): ReferenciaParametro | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      throw new Error(`La respuesta de ${url} contiene un "${campo}" que no es un objeto.`);
    }

    const referencia = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(referencia['Id'], url, `${campo}.Id`),
      Nombre: this.textoOpcional(referencia['Nombre'], url, `${campo}.Nombre`),
    };
  }

  private parametroPadreOpcional(
    valor: unknown,
    url: string,
  ): ReferenciaParametro | number | null | undefined {
    if (valor === undefined || valor === null || typeof valor === 'number') {
      if (typeof valor === 'number' && !Number.isInteger(valor)) {
        throw new Error(`La respuesta de ${url} contiene un "ParametroPadreId" que no es un entero.`);
      }
      return valor;
    }
    return this.referenciaParametroOpcional(valor, url, 'ParametroPadreId');
  }

  private grupoInfoComplementariaOpcional(
    valor: unknown,
    url: string,
  ): GrupoInfoComplementaria | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "GrupoInfoComplementariaId" que no es un objeto.`,
      );
    }

    const grupo = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(grupo['Id'], url, 'GrupoInfoComplementariaId.Id'),
      Nombre: this.textoOpcional(grupo['Nombre'], url, 'GrupoInfoComplementariaId.Nombre'),
      Descripcion: this.textoOpcional(
        grupo['Descripcion'],
        url,
        'GrupoInfoComplementariaId.Descripcion',
      ),
      CodigoAbreviacion: this.textoOpcional(
        grupo['CodigoAbreviacion'],
        url,
        'GrupoInfoComplementariaId.CodigoAbreviacion',
      ),
      Activo: this.booleanoOpcional(grupo['Activo'], url, 'GrupoInfoComplementariaId.Activo'),
    };
  }

  private numeroRequerido(valor: unknown, url: string, campo: string): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      throw new Error(`La respuesta de ${url} contiene un "${campo}" que no es un entero.`);
    }
    return valor;
  }

  private textoOpcional(valor: unknown, url: string, campo: string): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== 'string') {
      throw new Error(`La respuesta de ${url} contiene un "${campo}" que no es texto.`);
    }
    return valor;
  }

  private booleanoOpcional(valor: unknown, url: string, campo: string): boolean | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== 'boolean') {
      throw new Error(`La respuesta de ${url} contiene un "${campo}" que no es booleano.`);
    }
    return valor;
  }

  private obtenerOpcionesComplementarias(
    grupos: RegistroCatalogo[],
    registros: RegistroCatalogo[],
    aliases: string[],
  ): OpcionCatalogo[] {
    const idsGrupos = new Set(
      grupos
        .filter(
          grupo => grupo.Activo !== false && this.coincideCategoria(grupo, aliases),
        )
        .map(grupo => grupo.Id),
    );

    return this.aOpciones(
      registros.filter(registro =>
        idsGrupos.has(registro.GrupoInfoComplementariaId?.Id ?? -1),
      ),
    );
  }

  private obtenerOpcionesParametro(
    tiposParametro: RegistroCatalogo[],
    parametros: RegistroCatalogo[],
    aliases: string[],
  ): OpcionCatalogo[] {
    const idsTipos = new Set(
      tiposParametro
        .filter(tipo => tipo.Activo !== false && this.coincideCategoria(tipo, aliases))
        .map(tipo => tipo.Id),
    );

    return this.aOpciones(
      parametros.filter(parametro =>
        parametro.TipoParametroId
        && idsTipos.has(parametro.TipoParametroId.Id),
      ),
      true,
    );
  }

  private aOpciones(registros: RegistroCatalogo[], incluirJerarquia = false): OpcionCatalogo[] {
    const activos = registros.filter(registro => registro.Activo !== false);

    return activos
      .map(registro => ({
        id: registro.Id,
        nombre: this.nombreRequerido(registro.Nombre),
        codigo: registro.CodigoAbreviacion,
        descripcion: registro.Descripcion,
        ...(incluirJerarquia
          ? {
              parametroPadreId:
                typeof registro.ParametroPadreId === 'number'
                  ? registro.ParametroPadreId
                  : registro.ParametroPadreId?.Id ?? null,
            }
          : {}),
      }));
  }

  private nombreRequerido(nombre: string | undefined): string {
    if (typeof nombre !== 'string' || nombre.length === 0) {
      throw new Error('La respuesta contiene una opción activa sin Nombre descriptivo.');
    }
    return nombre;
  }

  private coincideCategoria(registro: RegistroCatalogo, aliases: string[]): boolean {
    const nombre = this.normalizar(registro.Nombre ?? '');
    return aliases.some(alias => nombre === this.normalizar(alias));
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .trim();
  }
}
