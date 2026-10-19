import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import {
  catchError,
  forkJoin,
  map,
  Observable,
  shareReplay,
  throwError,
} from "rxjs";
import { environment } from "src/environments/environment";
import {
  obtenerTodasLasPaginas,
  descartarRegistrosVacios,
} from "./registro-persona-juridica-paginacion";

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

type TipoRegistro = "areaTipo" | "tipoParametro" | "parametro";

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
  tipoDocumento: OpcionCatalogo[];
  actividadEconomicaCiiu: OpcionCatalogo[];
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
  tipoVia: OpcionCatalogo[];
  tipoInterior: OpcionCatalogo[];
}

// Procedencia, vía e interior se obtienen de Ubicaciones; este servicio cubre Terceros y Parámetros.
export type CatalogosTercerosParametros = Omit<
  CatalogosPersonaJuridica,
  "procedencia" | "tipoVia" | "tipoInterior"
>;

interface OpcionesParametro {
  codigoArea?: string;
  soloRaiz?: boolean;
  exigirCodigo?: boolean;
}

@Injectable({ providedIn: "root" })
export class RegistroPersonaJuridicaCatalogosService {
  private readonly tercerosUrl = environment.TERCEROS_SERVICE.replace(
    /\/+$/,
    "",
  );
  private readonly parametrosUrl = environment.PARAMETROS_SERVICE.replace(
    /\/+$/,
    "",
  );
  private readonly solicitudesPaginadas = new Map<
    string,
    Observable<RegistroCatalogo[]>
  >();

  constructor(private readonly http: HttpClient) {}

  obtenerCatalogos(): Observable<CatalogosTercerosParametros> {
    // area_tipo y tipo_parametro se consultan una sola vez por carga y código.
    const memo = new Map<string, Observable<RegistroCatalogo[]>>();
    const memorizar = (
      clave: string,
      crear: () => Observable<RegistroCatalogo[]>,
    ) => {
      let solicitud = memo.get(clave);
      if (!solicitud) {
        solicitud = crear().pipe(shareReplay(1));
        memo.set(clave, solicitud);
      }
      return solicitud;
    };
    const complementaria = (codigoGrupo: string) =>
      this.obtenerInfoComplementaria(codigoGrupo).pipe(
        map((registros) => this.aOpciones(registros)),
      );
    const parametro = (codigoTipo: string, opciones: OpcionesParametro = {}) =>
      this.obtenerParametrosPorTipo(codigoTipo, opciones, memorizar);

    return forkJoin({
      tipoOrganizacion: complementaria("TIPO_ORG"),
      tamanoEmpresa: complementaria("TAMAÑO_EMPRESA"),
      tipoCapital: complementaria("TIPO_CAPITAL"),
      cargo: complementaria("Grupo_5"),
      camaraComercio: parametro("CAM_COM"),
      beneficiariosFinalesRub: parametro("BENEFICIARIOS_FINALES_RUB"),
      cotizaBvc: parametro("COTIZA_BVC"),
      obligacionRevisorFiscal: parametro("OBLIGACIÓN_REVISOR_FISCAL"),
      granContribuyenteDian: parametro("CONTRIBUYENTE_DIAN"),
      autorretenedorRenta: parametro("AUTORRETENEDOR_RENTA"),
      exencionIcaBogota: parametro("APLICA_EXENCIÓN_ICA_BOGOTÁ"),
      entidadesBancarias: parametro("EB"),
      tiposCuentaBancaria: parametro("TCB"),
      obligadoFacturar: parametro("OBLIGACIÓN_FACTURA_ELECTRÓNICA"),
      monedaExtranjera: parametro("OPERACIONES_MONEDA_EXTRANJERA"),
      rupVigente: parametro("RUP_VIGENTE"),
      actividadEconomicaCiiu: parametro("CIIU", { exigirCodigo: true }),
      // Catálogos que usa el formulario y que no figuran en PERSONA_JURIDICA_CONSUMO.md.
      responsabilidadFiscal: parametro("RESP_FIS", { codigoArea: "IT" }),
      tipoDocumento: parametro("TIP_DOC", {
        codigoArea: "IT",
        exigirCodigo: true,
      }),
      tipoDeclaracion: parametro("TIP_DEC", { codigoArea: "IT" }),
    });
  }

  private obtenerInfoComplementaria(
    codigoGrupo: string,
  ): Observable<RegistroCatalogo[]> {
    return this.obtenerPaginado(
      `${this.tercerosUrl}/info_complementaria`,
      `GrupoInfoComplementariaId.CodigoAbreviacion:${codigoGrupo}`,
      false,
    );
  }

  private obtenerParametrosPorTipo(
    codigoTipo: string,
    opciones: OpcionesParametro,
    memorizar: (
      clave: string,
      crear: () => Observable<RegistroCatalogo[]>,
    ) => Observable<RegistroCatalogo[]>,
  ): Observable<OpcionCatalogo[]> {
    const parametros$ = this.obtenerPaginado(
      `${this.parametrosUrl}/parametro`,
      `TipoParametroId.CodigoAbreviacion:${codigoTipo}`,
      true,
      "parametro",
    );

    const aOpcionesFinales = (registros: RegistroCatalogo[]) => {
      const filtrados = opciones.soloRaiz
        ? registros.filter(
            (registro) =>
              registro.ParametroPadreId === null ||
              registro.ParametroPadreId === undefined,
          )
        : registros;
      const resultado = this.aOpciones(filtrados, true);
      if (opciones.exigirCodigo) {
        for (const opcion of resultado) {
          if (typeof opcion.codigo !== "string" || opcion.codigo.length === 0) {
            throw new Error(
              `El parámetro con Id ${opcion.id} del tipo "${codigoTipo}" no contiene CodigoAbreviacion.`,
            );
          }
        }
      }
      return resultado;
    };

    if (!opciones.codigoArea) {
      return parametros$.pipe(map(aOpcionesFinales));
    }

    const codigoArea = opciones.codigoArea;
    const areas$ = memorizar(`area:${codigoArea}`, () =>
      this.obtenerPaginado(
        `${this.parametrosUrl}/area_tipo`,
        `CodigoAbreviacion:${codigoArea}`,
        true,
        "areaTipo",
      ),
    );
    const tipos$ = memorizar(`tipo:${codigoTipo}`, () =>
      this.obtenerPaginado(
        `${this.parametrosUrl}/tipo_parametro`,
        `CodigoAbreviacion:${codigoTipo}`,
        true,
        "tipoParametro",
      ),
    );

    return forkJoin({
      areas: areas$,
      tipos: tipos$,
      parametros: parametros$,
    }).pipe(
      map(({ areas, tipos, parametros }) => {
        const idsAreas = new Set(
          areas
            .filter(
              (area) =>
                area.Activo !== false && area.CodigoAbreviacion === codigoArea,
            )
            .map((area) => area.Id),
        );
        const tiposPorCodigo = tipos.filter(
          (tipo) =>
            tipo.Activo !== false && tipo.CodigoAbreviacion === codigoTipo,
        );
        for (const tipo of tiposPorCodigo) {
          if (!tipo.AreaTipoId) {
            console.error(
              `Se omitió el tipo de parámetro "${codigoTipo}" (Id ${tipo.Id}) porque no contiene AreaTipoId.`,
            );
          }
        }
        const idsTipos = new Set(
          tiposPorCodigo
            .filter(
              (tipo) => tipo.AreaTipoId && idsAreas.has(tipo.AreaTipoId.Id),
            )
            .map((tipo) => tipo.Id),
        );
        return aOpcionesFinales(
          parametros.filter(
            (parametro) =>
              parametro.TipoParametroId &&
              idsTipos.has(parametro.TipoParametroId.Id),
          ),
        );
      }),
    );
  }

  private obtenerPaginado(
    url: string,
    query: string,
    envueltaEnData: boolean,
    tipoRegistro?: TipoRegistro,
  ): Observable<RegistroCatalogo[]> {
    const clave = `${url}|${query}|${envueltaEnData}|${tipoRegistro ?? ""}`;
    const existente = this.solicitudesPaginadas.get(clave);
    if (existente) {
      return existente;
    }

    const solicitud = obtenerTodasLasPaginas<RegistroCatalogo>(
      (limit, offset) => {
        const params = new HttpParams()
          .set("query", query)
          .set("limit", String(limit))
          .set("offset", String(offset));
        return this.http
          .get<unknown>(url, { params })
          .pipe(
            map((respuesta) =>
              this.validarListaRegistros(
                respuesta,
                url,
                envueltaEnData,
                tipoRegistro,
              ),
            ),
          );
      },
      (registro) => registro.Id,
      url,
    ).pipe(
      catchError((error) => {
        this.solicitudesPaginadas.delete(clave);
        console.error(
          `No fue posible cargar ${url} (query "${query}").`,
          error,
        );
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    this.solicitudesPaginadas.set(clave, solicitud);
    return solicitud;
  }

  private validarListaRegistros(
    respuesta: unknown,
    url: string,
    envueltaEnData: boolean,
    tipoRegistro?: TipoRegistro,
  ): RegistroCatalogo[] {
    let registros: unknown = respuesta;
    if (envueltaEnData) {
      if (
        !respuesta ||
        typeof respuesta !== "object" ||
        Array.isArray(respuesta)
      ) {
        throw new Error(
          `La respuesta de ${url} no contiene un objeto con Data.`,
        );
      }
      registros = (respuesta as RespuestaParametros).Data;
    }
    if (!Array.isArray(registros)) {
      throw new Error(
        `La respuesta de ${url} ${envueltaEnData ? "no contiene Data como arreglo" : "no es un arreglo directo de registros"}.`,
      );
    }

    return descartarRegistrosVacios(registros).map((registro) =>
      this.validarRegistro(
        registro,
        url,
        tipoRegistro === "parametro",
        tipoRegistro === "tipoParametro",
        tipoRegistro === "areaTipo",
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
    if (!registro || typeof registro !== "object") {
      throw new Error(
        `La respuesta de ${url} contiene un registro que no es un objeto.`,
      );
    }

    const cuerpo = registro as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(cuerpo["Id"], url, "Id"),
      Nombre: this.textoOpcional(cuerpo["Nombre"], url, "Nombre"),
      Descripcion: this.textoOpcional(
        cuerpo["Descripcion"],
        url,
        "Descripcion",
      ),
      CodigoAbreviacion: this.textoOpcional(
        cuerpo["CodigoAbreviacion"],
        url,
        "CodigoAbreviacion",
      ),
      ...(validarNumeroOrden
        ? {
            NumeroOrden: this.numeroOpcional(
              cuerpo["NumeroOrden"],
              url,
              "NumeroOrden",
            ),
          }
        : {}),
      Activo: this.booleanoOpcional(cuerpo["Activo"], url, "Activo"),
      ...(esParametro
        ? {
            TipoParametroId: this.referenciaParametroOpcional(
              cuerpo["TipoParametroId"],
              url,
              "TipoParametroId",
            ),
            ParametroPadreId: this.parametroPadreOpcional(
              cuerpo["ParametroPadreId"],
              url,
            ),
          }
        : esTipoParametro
          ? { AreaTipoId: this.areaTipoOpcional(cuerpo["AreaTipoId"], url) }
          : esAreaTipo
            ? {}
            : {
                GrupoInfoComplementariaId: this.grupoInfoComplementariaOpcional(
                  cuerpo["GrupoInfoComplementariaId"],
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
    if (typeof valor !== "object" || Array.isArray(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "${campo}" que no es un objeto.`,
      );
    }

    const referencia = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(referencia["Id"], url, `${campo}.Id`),
      Nombre: this.textoOpcional(referencia["Nombre"], url, `${campo}.Nombre`),
    };
  }

  private areaTipoOpcional(
    valor: unknown,
    url: string,
  ): AreaTipo | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }
    if (typeof valor !== "object" || Array.isArray(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "AreaTipoId" que no es un objeto.`,
      );
    }

    const area = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(area["Id"], url, "AreaTipoId.Id"),
      Nombre: this.textoOpcional(area["Nombre"], url, "AreaTipoId.Nombre"),
      CodigoAbreviacion: this.textoOpcional(
        area["CodigoAbreviacion"],
        url,
        "AreaTipoId.CodigoAbreviacion",
      ),
      Activo: this.booleanoOpcional(area["Activo"], url, "AreaTipoId.Activo"),
    };
  }

  private parametroPadreOpcional(
    valor: unknown,
    url: string,
  ): ReferenciaParametro | number | null | undefined {
    if (valor === undefined || valor === null || typeof valor === "number") {
      if (typeof valor === "number" && !Number.isInteger(valor)) {
        throw new Error(
          `La respuesta de ${url} contiene un "ParametroPadreId" que no es un entero.`,
        );
      }
      return valor;
    }
    return this.referenciaParametroOpcional(valor, url, "ParametroPadreId");
  }

  private grupoInfoComplementariaOpcional(
    valor: unknown,
    url: string,
  ): GrupoInfoComplementaria | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== "object" || Array.isArray(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "GrupoInfoComplementariaId" que no es un objeto.`,
      );
    }

    const grupo = valor as Record<string, unknown>;
    return {
      Id: this.numeroRequerido(
        grupo["Id"],
        url,
        "GrupoInfoComplementariaId.Id",
      ),
      Nombre: this.textoOpcional(
        grupo["Nombre"],
        url,
        "GrupoInfoComplementariaId.Nombre",
      ),
      Descripcion: this.textoOpcional(
        grupo["Descripcion"],
        url,
        "GrupoInfoComplementariaId.Descripcion",
      ),
      CodigoAbreviacion: this.textoOpcional(
        grupo["CodigoAbreviacion"],
        url,
        "GrupoInfoComplementariaId.CodigoAbreviacion",
      ),
      Activo: this.booleanoOpcional(
        grupo["Activo"],
        url,
        "GrupoInfoComplementariaId.Activo",
      ),
    };
  }

  private numeroRequerido(valor: unknown, url: string, campo: string): number {
    if (typeof valor !== "number" || !Number.isInteger(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "${campo}" que no es un entero.`,
      );
    }
    return valor;
  }

  private textoOpcional(
    valor: unknown,
    url: string,
    campo: string,
  ): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== "string") {
      throw new Error(
        `La respuesta de ${url} contiene un "${campo}" que no es texto.`,
      );
    }
    return valor;
  }

  private booleanoOpcional(
    valor: unknown,
    url: string,
    campo: string,
  ): boolean | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    if (typeof valor !== "boolean") {
      throw new Error(
        `La respuesta de ${url} contiene un "${campo}" que no es booleano.`,
      );
    }
    return valor;
  }

  private numeroOpcional(
    valor: unknown,
    url: string,
    campo: string,
  ): number | null | undefined {
    if (valor === undefined || valor === null) {
      return valor;
    }

    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      throw new Error(
        `La respuesta de ${url} contiene un "${campo}" que no es un número finito.`,
      );
    }

    return valor;
  }

  // Se excluyen solo los registros que el servicio marca explícitamente como inactivos.
  private aOpciones(
    registros: RegistroCatalogo[],
    incluirJerarquia = false,
  ): OpcionCatalogo[] {
    const opciones = registros
      .filter((registro) => registro.Activo !== false)
      .map((registro) => ({
        id: registro.Id,
        nombre: this.nombreRequerido(registro.Nombre),
        codigo: registro.CodigoAbreviacion,
        descripcion: registro.Descripcion,
        numeroOrden: registro.NumeroOrden,
        ...(incluirJerarquia
          ? {
              parametroPadreId:
                typeof registro.ParametroPadreId === "number"
                  ? registro.ParametroPadreId
                  : (registro.ParametroPadreId?.Id ?? null),
            }
          : {}),
      }));
    return opciones.every((opcion) => typeof opcion.numeroOrden === "number")
      ? opciones.sort((a, b) => Number(a.numeroOrden) - Number(b.numeroOrden))
      : opciones;
  }

  private nombreRequerido(nombre: string | undefined): string {
    if (typeof nombre !== "string" || nombre.length === 0) {
      throw new Error(
        "La respuesta contiene una opción activa sin Nombre descriptivo.",
      );
    }
    return nombre;
  }
}
