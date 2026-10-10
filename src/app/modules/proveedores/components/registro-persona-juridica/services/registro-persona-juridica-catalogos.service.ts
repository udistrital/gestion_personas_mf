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

interface AreaTipo {
  Id: number;
  Nombre?: string;
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
  AreaTipoId?: AreaTipo | null;
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
  actividadEconomicaCiiu: OpcionCatalogo[];
  actividadEconomicaUnspsc: OpcionCatalogo[];
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
      tiposParametro: this.obtenerRegistrosParametro(
        `${this.parametrosUrl}/tipo_parametro`,
        'tipoParametro',
      ),
      parametros: this.obtenerRegistrosParametro(
        `${this.parametrosUrl}/parametro`,
        'parametro',
      ),
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
            'CAM_COM',
          ),
          responsabilidadFiscal: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'RESP_FIS',
          ),
          moneda: this.obtenerOpcionesParametro(tiposParametro, parametros, ['moneda']),
          tipoDocumento: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'TIP_DOC',
          ),
          actividadEconomicaCiiu: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'CIIU',
          ),
          actividadEconomicaUnspsc: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'UNSPSC',
          ),
          tipoRepresentacion: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'TIP_REP',
          ),
          tipoDeclaracion: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            'TIP_DEC',
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

  private obtenerRegistrosParametro(
    url: string,
    tipoRegistro: 'tipoParametro' | 'parametro',
  ): Observable<RegistroCatalogo[]> {
    return this.http
      .get<unknown>(url)
      .pipe(map(respuesta => this.validarListaRegistros(respuesta, url, true, tipoRegistro)));
  }

  private validarListaRegistros(
    respuesta: unknown,
    url: string,
    envueltaEnData: boolean,
    tipoRegistro?: 'tipoParametro' | 'parametro',
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

    return registros.map(registro =>
      this.validarRegistro(
        registro,
        url,
        tipoRegistro === 'parametro',
        tipoRegistro === 'tipoParametro',
      ),
    );
  }

  private validarRegistro(
    registro: unknown,
    url: string,
    esParametro: boolean,
    esTipoParametro = false,
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
        : esTipoParametro
        ? { AreaTipoId: this.areaTipoOpcional(cuerpo['AreaTipoId'], url) }
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

  private areaTipoOpcional(valor: unknown, url: string): AreaTipo | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }
    if (typeof valor !== 'object' || Array.isArray(valor)) {
      throw new Error(`La respuesta de ${url} contiene un "AreaTipoId" que no es un objeto.`);
    }

    const area = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(area['Id'], url, 'AreaTipoId.Id'),
      Nombre: this.textoOpcional(area['Nombre'], url, 'AreaTipoId.Nombre'),
      CodigoAbreviacion: this.textoOpcional(
        area['CodigoAbreviacion'],
        url,
        'AreaTipoId.CodigoAbreviacion',
      ),
      Activo: this.booleanoOpcional(area['Activo'], url, 'AreaTipoId.Activo'),
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
    codigoTipo: string | string[],
  ): OpcionCatalogo[] {
    if (Array.isArray(codigoTipo)) {
      const idsTipos = this.obtenerIdsTiposPorNombre(tiposParametro, codigoTipo);
      return this.opcionesDeIdsTipo(parametros, idsTipos);
    }

    const idsTipos = this.obtenerIdsTiposPorCodigo(tiposParametro, codigoTipo);
    return this.opcionesDeIdsTipo(parametros, idsTipos);
  }

  private obtenerIdsTiposPorCodigo(
    tiposParametro: RegistroCatalogo[],
    codigoTipo: string,
  ): Set<number> {
    const tipos = tiposParametro.filter(
      tipo => tipo.Activo !== false && tipo.CodigoAbreviacion === codigoTipo,
    );
    for (const tipo of tipos) {
      if (!tipo.AreaTipoId) {
        console.error(
          `Se omitió el tipo de parámetro "${codigoTipo}" (Id ${tipo.Id}) porque no contiene AreaTipoId.`,
        );
      }
    }

    return new Set(
      tipos
        .filter(tipo =>
          tipo.AreaTipoId?.Activo !== false
          && tipo.AreaTipoId?.CodigoAbreviacion === 'IT',
        )
        .map(tipo => tipo.Id),
    );
  }

  private obtenerIdsTiposPorNombre(
    tiposParametro: RegistroCatalogo[],
    aliases: string[],
  ): Set<number> {
    return new Set(
      tiposParametro
        .filter(tipo => tipo.Activo !== false && this.coincideCategoria(tipo, aliases))
        .map(tipo => tipo.Id),
    );
  }

  private opcionesDeIdsTipo(
    parametros: RegistroCatalogo[],
    idsTipos: Set<number>,
  ): OpcionCatalogo[] {
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
