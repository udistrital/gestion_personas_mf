import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface RegistroCatalogo {
  Id?: number;
  Nombre?: string;
  Descripcion?: string;
  CodigoAbreviacion?: string;
  Activo?: boolean;
  NumeroOrden?: number;
  ParametroPadreId?: number;
  TipoParametroId?: number;
  GrupoInfoComplementariaId?: number;
}

type RegistroCatalogoConId = RegistroCatalogo & { Id: number };

export interface OpcionCatalogo {
  id: number;
  nombre: string;
  codigo?: string;
  descripcion?: string;
}

export interface CatalogosPersonaJuridica {
  procedencia: OpcionCatalogo[];
  camaraComercio: OpcionCatalogo[];
  tipoOrganizacion: OpcionCatalogo[];
  tamanoEmpresa: OpcionCatalogo[];
  tipoCapital: OpcionCatalogo[];
  responsabilidadFiscal: OpcionCatalogo[];
  actividadEconomica: OpcionCatalogo[];
  cargo: OpcionCatalogo[];
  tipoDeclaracion: OpcionCatalogo[];
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaCatalogosService {
  private readonly parametrosUrl = environment.PARAMETROS_SERVICE.replace(/\/+$/, '');
  private readonly tercerosUrl = environment.TERCEROS_SERVICE.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  obtenerCatalogos(): Observable<CatalogosPersonaJuridica> {
    return forkJoin({
      parametros: this.obtenerRegistros(
        `${this.parametrosUrl}/parametro`,
        this.crearHeaders(environment.PARAMETROS_API_KEY_HEADER, environment.PARAMETROS_API_KEY),
      ),
      tiposParametro: this.obtenerRegistros(
        `${this.parametrosUrl}/tipo_parametro`,
        this.crearHeaders(environment.PARAMETROS_API_KEY_HEADER, environment.PARAMETROS_API_KEY),
      ),
      gruposInfoComplementaria: this.obtenerRegistros(
        `${this.tercerosUrl}/grupo_info_complementaria`,
        this.crearHeaders(environment.TERCEROS_API_KEY_HEADER, environment.TERCEROS_API_KEY),
      ),
      infoComplementaria: this.obtenerRegistros(
        `${this.tercerosUrl}/info_complementaria`,
        this.crearHeaders(environment.TERCEROS_API_KEY_HEADER, environment.TERCEROS_API_KEY),
      ),
    }).pipe(
      map(({ tiposParametro, parametros, gruposInfoComplementaria, infoComplementaria }) => {
        const catalogos: CatalogosPersonaJuridica = {
          procedencia: this.obtenerOpcionesComplementarias(
            gruposInfoComplementaria,
            infoComplementaria,
            ['procedencia'],
          ),
          camaraComercio: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['camara comercio', 'camara de comercio'],
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
          responsabilidadFiscal: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['responsabilidad fiscal'],
          ),
          actividadEconomica: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['actividad economica'],
          ),
          cargo: this.obtenerOpcionesParametro(tiposParametro, parametros, ['cargo']),
          tipoDeclaracion: this.obtenerOpcionesParametro(
            tiposParametro,
            parametros,
            ['tipo declaracion'],
          ),
        };
        this.validarCatalogosNoVacios(catalogos);
        return catalogos;
      }),
    );
  }

  private obtenerRegistros(url: string, headers: HttpHeaders): Observable<RegistroCatalogoConId[]> {
    return this.http
      .get<unknown>(url, { headers })
      .pipe(map(respuesta => this.validarListaRegistros(respuesta, url)));
  }

  private validarListaRegistros(respuesta: unknown, url: string): RegistroCatalogoConId[] {
    if (!Array.isArray(respuesta)) {
      throw new Error(`La respuesta de ${url} no es un arreglo directo de registros.`);
    }

    return respuesta.map(registro => this.validarRegistro(registro, url));
  }

  private validarRegistro(registro: unknown, url: string): RegistroCatalogoConId {
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
      NumeroOrden: this.numeroOpcional(cuerpo['NumeroOrden'], url, 'NumeroOrden'),
      ParametroPadreId: this.numeroOpcional(cuerpo['ParametroPadreId'], url, 'ParametroPadreId'),
      TipoParametroId: this.numeroOpcional(cuerpo['TipoParametroId'], url, 'TipoParametroId'),
      GrupoInfoComplementariaId: this.numeroOpcional(
        cuerpo['GrupoInfoComplementariaId'],
        url,
        'GrupoInfoComplementariaId',
      ),
    };
  }

  private numeroRequerido(valor: unknown, url: string, campo: string): number {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      throw new Error(`La respuesta de ${url} contiene un "${campo}" que no es un entero.`);
    }
    return valor;
  }

  private numeroOpcional(valor: unknown, url: string, campo: string): number | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    return this.numeroRequerido(valor, url, campo);
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

  private obtenerOpcionesParametro(
    tiposParametro: RegistroCatalogoConId[],
    parametros: RegistroCatalogoConId[],
    aliases: string[],
  ): OpcionCatalogo[] {
    const idsTipos = new Set(
      tiposParametro
        .filter(tipo => this.coincideCategoria(tipo, aliases))
        .map(tipo => tipo.Id),
    );

    return this.aOpciones(parametros.filter(parametro => idsTipos.has(parametro.TipoParametroId ?? -1)));
  }

  private obtenerOpcionesComplementarias(
    grupos: RegistroCatalogoConId[],
    registros: RegistroCatalogoConId[],
    aliases: string[],
  ): OpcionCatalogo[] {
    const idsGrupos = new Set(
      grupos
        .filter(grupo => this.coincideCategoria(grupo, aliases))
        .map(grupo => grupo.Id),
    );

    return this.aOpciones(
      registros.filter(registro => idsGrupos.has(registro.GrupoInfoComplementariaId ?? -1)),
    );
  }

  private aOpciones(registros: RegistroCatalogoConId[]): OpcionCatalogo[] {
    const activos = registros.filter(registro => registro.Activo !== false);

    return activos
      .sort((a, b) => (a.NumeroOrden ?? 0) - (b.NumeroOrden ?? 0))
      .map(registro => ({
        id: registro.Id,
        nombre: this.nombreRequerido(registro.Nombre),
        codigo: registro.CodigoAbreviacion,
        descripcion: registro.Descripcion,
      }));
  }

  private nombreRequerido(nombre: string | undefined): string {
    if (typeof nombre !== 'string' || nombre.length === 0) {
      throw new Error('La respuesta contiene una opción activa sin Nombre descriptivo.');
    }
    return nombre;
  }

  private validarCatalogosNoVacios(catalogos: CatalogosPersonaJuridica): void {
    for (const [nombre, opciones] of Object.entries(catalogos)) {
      if (opciones.length === 0) {
        throw new Error(`La API no devolvió opciones para el catálogo obligatorio "${nombre}".`);
      }
    }
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

  private crearHeaders(nombreHeader: string, apiKey: string): HttpHeaders {
    return nombreHeader && apiKey ? new HttpHeaders().set(nombreHeader, apiKey) : new HttpHeaders();
  }
}
