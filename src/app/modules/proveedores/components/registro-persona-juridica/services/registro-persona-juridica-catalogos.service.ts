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

interface RegistroCatalogo {
  Id?: number;
  Nombre?: string;
  Descripcion?: string;
  CodigoAbreviacion?: string;
  Activo?: boolean;
  GrupoInfoComplementariaId?: GrupoInfoComplementaria;
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
  tipoOrganizacion: OpcionCatalogo[];
  tamanoEmpresa: OpcionCatalogo[];
  tipoCapital: OpcionCatalogo[];
  camaraComercio?: OpcionCatalogo[];
  responsabilidadFiscal?: OpcionCatalogo[];
  actividadEconomica?: OpcionCatalogo[];
  cargo?: OpcionCatalogo[];
  tipoDeclaracion?: OpcionCatalogo[];
}

@Injectable({ providedIn: 'root' })
export class RegistroPersonaJuridicaCatalogosService {
  private readonly tercerosUrl = environment.TERCEROS_SERVICE.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  obtenerCatalogos(): Observable<CatalogosPersonaJuridica> {
    return forkJoin({
      gruposInfoComplementaria: this.obtenerRegistros(
        `${this.tercerosUrl}/grupo_info_complementaria`,
      ),
      infoComplementaria: this.obtenerRegistros(`${this.tercerosUrl}/info_complementaria`),
    }).pipe(
      map(({ gruposInfoComplementaria, infoComplementaria }) => {
        const catalogos: CatalogosPersonaJuridica = {
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
        };
        return catalogos;
      }),
    );
  }

  private obtenerRegistros(url: string): Observable<RegistroCatalogoConId[]> {
    return this.http
      .get<unknown>(url)
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
      GrupoInfoComplementariaId: this.grupoInfoComplementariaOpcional(
        cuerpo['GrupoInfoComplementariaId'],
        url,
      ),
    };
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
      registros.filter(registro =>
        idsGrupos.has(registro.GrupoInfoComplementariaId?.Id ?? -1),
      ),
    );
  }

  private aOpciones(registros: RegistroCatalogoConId[]): OpcionCatalogo[] {
    const activos = registros.filter(registro => registro.Activo !== false);

    return activos
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
