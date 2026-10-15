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
  NumeroOrden?: number | null;
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
  numeroOrden?: number | null;
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
  tipoRepresentacion: OpcionCatalogo[];
  tipoDeclaracion: OpcionCatalogo[];
  cargo: OpcionCatalogo[];
  entidadesBancarias: OpcionCatalogo[];
  tiposCuentaBancaria: OpcionCatalogo[];
  beneficiariosFinalesRub: OpcionCatalogo[];
  cotizaBvc: OpcionCatalogo[];
  obligacionRevisorFiscal: OpcionCatalogo[];
  granContribuyenteDian: OpcionCatalogo[];
  autorretenedorRenta: OpcionCatalogo[];
  exencionIcaBogota: OpcionCatalogo[];
  rupVigente: OpcionCatalogo[];
  obligadoFacturar: OpcionCatalogo[];
  monedaExtranjera: OpcionCatalogo[];
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
      areasTipo: this.obtenerRegistrosParametro(
        `${this.parametrosUrl}/area_tipo`,
        'areaTipo',
      ),
      tiposParametro: this.obtenerRegistrosParametro(
        `${this.parametrosUrl}/tipo_parametro`,
        'tipoParametro',
      ),
      parametros: this.obtenerRegistrosParametro(
        `${this.parametrosUrl}/parametro`,
        'parametro',
      ),
    }).pipe(
      map(({ gruposInfoComplementaria, infoComplementaria, areasTipo, tiposParametro, parametros }) => ({
          procedencia: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            'PROCEDENCIA',
          ),
          tipoOrganizacion: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            'TIPO_ORG',
          ),
          tamanoEmpresa: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            'TAMAÑO_EMPRESA',
          ),
          tipoCapital: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            'TIPO_CAPITAL',
          ),
          camaraComercio: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'CAM_COM',
          ),
          responsabilidadFiscal: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'RESP_FIS',
          ),
          moneda: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            ['moneda'],
          ),
          tipoDocumento: this.obtenerOpcionesParametroConCodigo(
            areasTipo,
            tiposParametro,
            parametros,
            'TIP_DOC',
          ),
          actividadEconomicaCiiu: this.obtenerOpcionesCiiu(
            areasTipo,
            tiposParametro,
            parametros,
          ),
          tipoRepresentacion: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'TIP_REP',
          ),
          tipoDeclaracion: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'TIP_DEC',
          ),
          cargo: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            ['cargo'],
          ),
          entidadesBancarias: this.obtenerOpcionesParametroPorAreaYTipo(
            areasTipo,
            tiposParametro,
            parametros,
            'EB',
          ),
          tiposCuentaBancaria: this.obtenerOpcionesParametroPorAreaYTipo(
            areasTipo,
            tiposParametro,
            parametros,
            'TCB',
          ),
          beneficiariosFinalesRub: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'BENEFICIARIOS_FINALES_RUB',
          ),
          cotizaBvc: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'COTIZA_BVC',
          ),
          obligacionRevisorFiscal: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'OBLIGACIÓN_REVISOR_FISCAL',
          ),
          granContribuyenteDian: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'CONTRIBUYENTE_DIAN',
          ),
          autorretenedorRenta: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'AUTORRETENEDOR_RENTA',
          ),
          exencionIcaBogota: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'APLICA_EXENCIÓN_ICA_BOGOTÁ',
          ),
          rupVigente: this.obtenerOpcionesParametroConCodigo(
            areasTipo,
            tiposParametro,
            parametros,
            'RUP_VIGENTE',
          ),
          obligadoFacturar: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'OBLIGACIÓN_FACTURA_ELECTRÓNICA',
          ),
          monedaExtranjera: this.obtenerOpcionesParametro(
            areasTipo,
            tiposParametro,
            parametros,
            'OPERACIONES_MONEDA_EXTRANJERA',
          ),
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
    tipoRegistro: 'areaTipo' | 'tipoParametro' | 'parametro',
  ): Observable<RegistroCatalogo[]> {
    return this.http
      .get<unknown>(url)
      .pipe(map(respuesta => this.validarListaRegistros(respuesta, url, true, tipoRegistro)));
  }

  private validarListaRegistros(
    respuesta: unknown,
    url: string,
    envueltaEnData: boolean,
    tipoRegistro?: 'areaTipo' | 'tipoParametro' | 'parametro',
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
        tipoRegistro === 'areaTipo',
        tipoRegistro !== undefined,
      ),
    );
  }

  private validarRegistro(
    registro: unknown,
    url: string,
    esParametro: boolean,
    esTipoParametro: boolean,
    esAreaTipo: boolean,
    validarNumeroOrden: boolean,
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
      ...(validarNumeroOrden
        ? { NumeroOrden: this.numeroOpcional(cuerpo['NumeroOrden'], url, 'NumeroOrden') }
        : {}),
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
        : esAreaTipo
        ? {}
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

  private numeroOpcional(valor: unknown, url: string, campo: string): number | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }
    return this.numeroRequerido(valor, url, campo);
  }

  private obtenerOpcionesComplementarias(
    grupos: RegistroCatalogo[],
    registros: RegistroCatalogo[],
    codigoGrupo: string,
  ): OpcionCatalogo[] {
    const idsGrupos = new Set(
      grupos
        .filter(grupo => grupo.Activo === true && grupo.CodigoAbreviacion === codigoGrupo)
        .map(grupo => grupo.Id),
    );

    return this.aOpciones(
      registros.filter(registro =>
        idsGrupos.has(registro.GrupoInfoComplementariaId?.Id ?? -1),
      ),
    );
  }

  private obtenerOpcionesParametro(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    parametros: RegistroCatalogo[],
    codigoTipo: string | string[],
  ): OpcionCatalogo[] {
    if (Array.isArray(codigoTipo)) {
      const idsTipos = this.obtenerIdsTiposPorNombre(areasTipo, tiposParametro, codigoTipo);
      return this.opcionesDeIdsTipo(parametros, idsTipos);
    }

    const idsTipos = this.obtenerIdsTiposPorCodigo(areasTipo, tiposParametro, codigoTipo);
    return this.opcionesDeIdsTipo(parametros, idsTipos);
  }

  private obtenerOpcionesCiiu(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    parametros: RegistroCatalogo[],
  ): OpcionCatalogo[] {
    return this.obtenerOpcionesParametro(
      areasTipo,
      tiposParametro,
      parametros,
      'CIIU',
    ).map(opcion => {
      if (typeof opcion.codigo !== 'string' || opcion.codigo.length === 0) {
        throw new Error(`La actividad CIIU con Id ${opcion.id} no contiene CodigoAbreviacion.`);
      }
      return opcion;
    });
  }

  private obtenerOpcionesParametroConCodigo(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    parametros: RegistroCatalogo[],
    codigoTipo: string,
  ): OpcionCatalogo[] {
    return this.obtenerOpcionesParametro(
      areasTipo,
      tiposParametro,
      parametros,
      codigoTipo,
    ).map(opcion => {
      if (typeof opcion.codigo !== 'string' || opcion.codigo.length === 0) {
        throw new Error(
          `El parámetro con Id ${opcion.id} del tipo "${codigoTipo}" no contiene CodigoAbreviacion.`,
        );
      }
      return opcion;
    });
  }

  private obtenerIdsTiposPorCodigo(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    codigoTipo: string,
  ): Set<number> {
    const idsAreasTributarias = this.obtenerIdsAreasPorCodigo(areasTipo, 'IT');
    const tiposPorCodigo = tiposParametro.filter(
      tipo => tipo.Activo === true && tipo.CodigoAbreviacion === codigoTipo,
    );
    for (const tipo of tiposPorCodigo) {
      if (!tipo.AreaTipoId) {
        console.error(
          `Se omitió el tipo de parámetro "${codigoTipo}" (Id ${tipo.Id}) porque no contiene AreaTipoId.`,
        );
      }
    }

    return new Set(
      tiposPorCodigo
        .filter(
          tipo => tipo.AreaTipoId && idsAreasTributarias.has(tipo.AreaTipoId.Id),
        )
        .map(tipo => tipo.Id),
    );
  }

  private obtenerIdsTiposPorNombre(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    aliases: string[],
  ): Set<number> {
    const idsAreasTributarias = this.obtenerIdsAreasPorCodigo(areasTipo, 'IT');
    return new Set(
      tiposParametro
        .filter(
          tipo =>
            tipo.Activo === true
            && tipo.AreaTipoId
            && idsAreasTributarias.has(tipo.AreaTipoId.Id)
            && this.coincideCategoria(tipo, aliases),
        )
        .map(tipo => tipo.Id),
    );
  }

  private obtenerIdsAreasPorCodigo(
    areasTipo: RegistroCatalogo[],
    codigoArea: string,
  ): Set<number> {
    return new Set(
      areasTipo
        .filter(area => area.Activo === true && area.CodigoAbreviacion === codigoArea)
        .map(area => area.Id),
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

  private obtenerOpcionesParametroPorAreaYTipo(
    areasTipo: RegistroCatalogo[],
    tiposParametro: RegistroCatalogo[],
    parametros: RegistroCatalogo[],
    codigoTipo: 'EB' | 'TCB',
  ): OpcionCatalogo[] {
    const idsAreasFinancieras = new Set(
      areasTipo
        .filter(area => area.Activo === true && area.CodigoAbreviacion === 'SF')
        .map(area => area.Id),
    );
    const idsTiposParametro = new Set(
      tiposParametro
        .filter(tipo =>
          tipo.Activo === true
          && tipo.CodigoAbreviacion === codigoTipo
          && tipo.AreaTipoId
          && idsAreasFinancieras.has(tipo.AreaTipoId.Id),
        )
        .map(tipo => tipo.Id),
    );

    return this.aOpciones(
      parametros.filter(parametro =>
        parametro.Activo === true
        && (
          parametro.ParametroPadreId === null
          || parametro.ParametroPadreId === undefined
        )
        && parametro.TipoParametroId
        && idsTiposParametro.has(parametro.TipoParametroId.Id),
      ),
    );
  }

  private aOpciones(registros: RegistroCatalogo[], incluirJerarquia = false): OpcionCatalogo[] {
    const activos = registros.filter(registro => registro.Activo === true);

    const opciones = activos
      .map(registro => ({
        id: registro.Id,
        nombre: this.nombreRequerido(registro.Nombre),
        codigo: registro.CodigoAbreviacion,
        descripcion: registro.Descripcion,
        numeroOrden: registro.NumeroOrden,
        ...(incluirJerarquia
          ? {
              parametroPadreId:
                typeof registro.ParametroPadreId === 'number'
                  ? registro.ParametroPadreId
                  : registro.ParametroPadreId?.Id ?? null,
            }
          : {}),
      }));
    return opciones.every(opcion => typeof opcion.numeroOrden === 'number')
      ? opciones.sort((a, b) => Number(a.numeroOrden) - Number(b.numeroOrden))
      : opciones;
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
