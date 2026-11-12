import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { catchError, defer, map, Observable, switchMap, throwError } from "rxjs";
import { environment } from "src/environments/environment";
import {
  ActualizarProveedorJuridicoMidPayload,
  ActualizarProveedorNaturalMidPayload,
  ConsultaProveedorMidRequest,
  ErrorMaterializacionMid,
  NuevoProveedorJuridicoMidPayload,
  NuevoProveedorNaturalMidPayload,
  ProveedorJuridicoMidRequest,
  ProveedorMidMaterializado,
  ProveedorNaturalMidRequest,
  RespuestaMid,
} from "./gestion-personas-mid.models";

export class GestionPersonasMidConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GestionPersonasMidConfigurationError";
  }
}

export class GestionPersonasMidProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GestionPersonasMidProtocolError";
  }
}

export class GestionPersonasMidCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GestionPersonasMidCatalogError";
  }
}

export interface ResultadoEnvioMid {
  tipo: "success" | "partial" | "rejected" | "indeterminate" | "error";
  mensaje: string;
  detalle: string;
  proveedorId?: number;
  terceroId?: number;
}

type OperacionMid = "registro" | "consulta" | "actualizacion";

function nombreOperacion(operacion: OperacionMid): string {
  switch (operacion) {
    case "consulta":
      return "la consulta";
    case "actualizacion":
      return "la actualización";
    default:
      return "el registro";
  }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function enteroOpcional(
  datos: Record<string, unknown>,
  campo: string,
): number | undefined {
  const valor = datos[campo];
  if (valor === undefined) {
    return undefined;
  }
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
    throw new GestionPersonasMidProtocolError(
      `La respuesta del MID contiene un ${campo} inválido.`,
    );
  }
  return valor;
}

function interpretarRespuestaMid(valor: unknown): RespuestaMid {
  if (!esRegistro(valor)) {
    throw new GestionPersonasMidProtocolError(
      "El MID devolvió una respuesta que no corresponde al envelope documentado.",
    );
  }
  if (
    typeof valor["Success"] !== "boolean"
    || typeof valor["Status"] !== "string"
    || typeof valor["Message"] !== "string"
  ) {
    throw new GestionPersonasMidProtocolError(
      "La respuesta del MID no contiene Success, Status y Message con los tipos documentados.",
    );
  }

  let data: ProveedorMidMaterializado | null = null;
  const valorData = valor["Data"];
  if (valorData !== null) {
    if (!esRegistro(valorData)) {
      throw new GestionPersonasMidProtocolError(
        "La respuesta del MID contiene un Data que no es un objeto.",
      );
    }
    const id = enteroOpcional(valorData, "Id");
    const terceroId = enteroOpcional(valorData, "TerceroId");
    const tipoRegistroId = enteroOpcional(valorData, "TipoRegistroId");
    data = {};
    for (const campo of Object.keys(valorData)) {
      data[campo] = valorData[campo];
    }
    if (id !== undefined) {
      data.Id = id;
    }
    if (terceroId !== undefined) {
      data.TerceroId = terceroId;
    }
    if (tipoRegistroId !== undefined) {
      data.TipoRegistroId = tipoRegistroId;
    }
  }

  let errores: ErrorMaterializacionMid[] | undefined;
  const valorMetaData = valor["MetaData"];
  if (valorMetaData !== undefined) {
    if (!esRegistro(valorMetaData)) {
      throw new GestionPersonasMidProtocolError(
        "La respuesta del MID contiene MetaData con una estructura inválida.",
      );
    }
    const valorErrores = valorMetaData["Errors"];
    if (valorErrores !== undefined) {
      if (!Array.isArray(valorErrores)) {
        throw new GestionPersonasMidProtocolError(
          "La respuesta del MID contiene MetaData.Errors con una estructura inválida.",
        );
      }
      errores = valorErrores.map((error) => {
        if (!esRegistro(error)) {
          throw new GestionPersonasMidProtocolError(
            "La respuesta del MID contiene un error de materialización inválido.",
          );
        }
        const entrada: {
          path?: string;
          service?: string;
          message?: string;
          kind?: string;
        } = {};
        for (const campo of ["path", "service", "message", "kind"] as const) {
          const contenido = error[campo];
          if (contenido !== undefined) {
            if (typeof contenido !== "string") {
              throw new GestionPersonasMidProtocolError(
                `La respuesta del MID contiene ${campo} con un tipo inválido.`,
              );
            }
            entrada[campo] = contenido;
          }
        }
        return entrada;
      });
    }
  }

  const respuesta: RespuestaMid = {
    Success: valor["Success"],
    Status: valor["Status"],
    Message: valor["Message"],
    Data: data,
  };
  if (errores !== undefined) {
    respuesta.MetaData = { Errors: errores };
  }
  return respuesta;
}

function mensajeDeEnvelope(error: unknown): string | undefined {
  if (!esRegistro(error)) {
    return undefined;
  }
  const message = error["Message"];
  return typeof message === "string" && message.trim()
    ? message.trim()
    : undefined;
}

export function resumirRespuestaMid(
  respuesta: RespuestaMid,
  omisiones: readonly string[],
  operacion: OperacionMid = "registro",
): ResultadoEnvioMid {
  const proveedorId = respuesta.Data?.Id;
  const terceroId = respuesta.Data?.TerceroId;
  const ids = [
    proveedorId !== undefined ? `Id del proveedor: ${proveedorId}.` : "",
    terceroId !== undefined ? `TerceroId: ${terceroId}.` : "",
  ].filter(Boolean);
  const avisos = respuesta.MetaData?.Errors?.map((error) =>
    [error.path, error.service, error.message, error.kind]
      .filter((parte): parte is string => Boolean(parte))
      .join(" · "),
  ) ?? [];
  const detalle = [...ids, ...avisos, ...omisiones].join(" ");

  if (!respuesta.Success) {
    return {
      tipo: "rejected",
      mensaje: respuesta.Message,
      detalle: detalle || `Respuesta del MID: ${respuesta.Status}.`,
    };
  }

  if (respuesta.Status !== "200" && respuesta.Status !== "206") {
    return {
      tipo: operacion === "consulta" ? "error" : "indeterminate",
      mensaje: "El MID devolvió un estado de éxito no documentado.",
      detalle: operacion === "consulta"
        ? `Status recibido: ${respuesta.Status}. La consulta no se considera válida.`
        : `Status recibido: ${respuesta.Status}. Verifique ${nombreOperacion(operacion)} antes de repetir la solicitud.`,
      proveedorId,
      terceroId,
    };
  }

  if (respuesta.Status === "200" && proveedorId === undefined) {
    return {
      tipo: operacion === "consulta" ? "error" : "indeterminate",
      mensaje: "El MID respondió éxito, pero no devolvió el Id del proveedor.",
      detalle: operacion === "consulta"
        ? `${respuesta.Message} La consulta no se puede asociar al proveedor solicitado.`
        : `${respuesta.Message} Verifique ${nombreOperacion(operacion)} antes de repetir la solicitud. ${detalle}`,
      terceroId,
    };
  }

  if (respuesta.Status === "206" || avisos.length > 0) {
    return {
      tipo: "partial",
      mensaje: respuesta.Message,
      detalle: [
        `${operacion === "consulta" ? "Consulta" : operacion === "actualizacion" ? "Actualización" : "Registro"} parcial; revise los avisos antes de continuar.`,
        ...ids,
        ...avisos,
        ...omisiones,
      ].join(" "),
      proveedorId,
      terceroId,
    };
  }

  return {
    tipo: "success",
    mensaje: respuesta.Message,
    detalle: detalle || `El MID confirmó ${nombreOperacion(operacion)}.`,
    proveedorId,
    terceroId,
  };
}

export function resumirErrorMid(
  error: unknown,
  operacion: OperacionMid = "registro",
): ResultadoEnvioMid {
  if (error instanceof GestionPersonasMidCatalogError) {
    return {
      tipo: "error",
      mensaje: "No se pudo resolver el tipo de registro del proveedor.",
      detalle: error.message,
    };
  }
  if (error instanceof GestionPersonasMidConfigurationError) {
    return {
      tipo: "error",
      mensaje: "El cableado con el MID está pendiente de configuración.",
      detalle: error.message,
    };
  }
  if (error instanceof GestionPersonasMidProtocolError) {
    if (operacion === "consulta") {
      return {
        tipo: "error",
        mensaje: "La respuesta de consulta del MID no es válida.",
        detalle: error.message,
      };
    }
    return {
      tipo: "indeterminate",
      mensaje: `No se pudo validar ${nombreOperacion(operacion)}.`,
      detalle: `${error.message} Verifique el estado antes de repetir la solicitud.`,
    };
  }
  if (error instanceof HttpErrorResponse) {
    const mensaje = mensajeDeEnvelope(error.error);
    if (error.status === 0 || error.status >= 500) {
      if (operacion === "consulta") {
        return {
          tipo: "error",
          mensaje: mensaje ?? "No se pudo completar la consulta del MID.",
          detalle: `HTTP ${error.status || "sin respuesta"}. Puede volver a consultar; no se aplican reintentos automáticos.`,
        };
      }
      return {
        tipo: "indeterminate",
        mensaje: mensaje ?? `No se pudo confirmar ${nombreOperacion(operacion)}.`,
        detalle: `HTTP ${error.status || "sin respuesta"}. El MID puede haber aplicado cambios; consulte el estado antes de repetir la solicitud.`,
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        tipo: "error",
        mensaje: mensaje ?? "El MID rechazó la autenticación o autorización.",
        detalle: `HTTP ${error.status}. Verifique la sesión y los permisos.`,
      };
    }
    if (error.status === 400 || error.status === 405) {
      return {
        tipo: "rejected",
        mensaje: mensaje ?? "El MID rechazó la solicitud.",
        detalle: `HTTP ${error.status}. Revise el contrato y los datos enviados.`,
      };
    }
    if (error.status === 404 && operacion === "actualizacion") {
      return {
        tipo: "indeterminate",
        mensaje: "El MID devolvió un 404 no definido para PATCH.",
        detalle:
          "El contrato no permite inferir si el upsert materializó datos. Consulte el proveedor antes de repetir la actualización.",
      };
    }
    if (error.status === 404 && operacion === "consulta") {
      return {
        tipo: "rejected",
        mensaje: mensaje ?? "No existe un proveedor con ese identificador.",
        detalle: "Verifique el Id del proveedor e intente nuevamente.",
      };
    }
    return {
      tipo: "error",
      mensaje: mensaje ?? `No se pudo completar ${nombreOperacion(operacion)} en el MID.`,
      detalle: `HTTP ${error.status || "sin respuesta"}.`,
    };
  }
  return {
    tipo: "error",
    mensaje: `No se pudo completar ${nombreOperacion(operacion)} en el MID.`,
    detalle: error instanceof Error ? error.message : "Error no identificado.",
  };
}

@Injectable({ providedIn: "root" })
export class GestionPersonasMidService {
  constructor(private readonly http: HttpClient) {}

  consultarProveedor(id: number): Observable<RespuestaMid> {
    return defer(() => {
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new GestionPersonasMidProtocolError(
          "El Id del proveedor debe ser un entero positivo seguro.",
        );
      }
      const baseUrl = this.urlBaseConfigurada();
      const request: ConsultaProveedorMidRequest = {
        id,
        fields: [
          "Tercero",
          "Tercero.DatosIdentificacion",
          "ProveedorNatural",
          "ProveedorJuridico",
          "CuentaBancaria",
        ],
      };
      return this.http
        .post<unknown>(`${baseUrl}/proveedor/consulta`, request)
        .pipe(map(interpretarRespuestaMid));
    });
  }

  actualizarPersonaNatural(
    payload: ActualizarProveedorNaturalMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      return this.http
        .patch<unknown>(`${baseUrl}/proveedor`, payload)
        .pipe(map(interpretarRespuestaMid));
    });
  }

  actualizarPersonaJuridica(
    payload: ActualizarProveedorJuridicoMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      return this.http
        .patch<unknown>(`${baseUrl}/proveedor`, payload)
        .pipe(map(interpretarRespuestaMid));
    });
  }

  registrarPersonaNatural(
    payload: NuevoProveedorNaturalMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      return this.resolverTipoRegistroId("P_NATURAL").pipe(
        switchMap((tipoRegistroId) => {
          const request: ProveedorNaturalMidRequest = {
            ...payload,
            TipoRegistroId: tipoRegistroId,
          };
          return this.http.post<unknown>(`${baseUrl}/proveedor`, request);
        }),
        map(interpretarRespuestaMid),
      );
    });
  }

  registrarPersonaJuridica(
    payload: NuevoProveedorJuridicoMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      return this.resolverTipoRegistroId("P_JURIDICA").pipe(
        switchMap((tipoRegistroId) => {
          const request: ProveedorJuridicoMidRequest = {
            ...payload,
            TipoRegistroId: tipoRegistroId,
          };
          return this.http.post<unknown>(`${baseUrl}/proveedor`, request);
        }),
        map(interpretarRespuestaMid),
      );
    });
  }

  private urlBaseConfigurada(): string {
    const baseUrl = environment.GESTION_PERSONAS_MID_SERVICE.trim();
    if (
      baseUrl === "PENDIENTE_CONFIGURAR"
      || !/^https:\/\//i.test(baseUrl)
    ) {
      throw new GestionPersonasMidConfigurationError(
        "GESTION_PERSONAS_MID_SERVICE debe configurarse con la URL HTTPS pública confirmada del MID, incluyendo su contexto WSO2 y /v1.",
      );
    }
    return baseUrl.replace(/\/+$/, "");
  }

  private resolverTipoRegistroId(
    codigo: "P_NATURAL" | "P_JURIDICA",
  ): Observable<number> {
    const url = `${environment.TERCEROS_SERVICE.replace(/\/+$/, "")}/tipo_contribuyente`;
    const params = new HttpParams()
      .set("query", `CodigoAbreviacion:${codigo},Activo:true`)
      .set("limit", "2");

    return this.http.get<unknown>(url, { params }).pipe(
      map((respuesta) => {
        if (!Array.isArray(respuesta)) {
          throw new GestionPersonasMidCatalogError(
            "La consulta de tipo_contribuyente no devolvió un arreglo.",
          );
        }
        const coincidencias = respuesta
          .filter(esRegistro)
          .filter(
            (registro) =>
              registro["Activo"] === true
              && registro["CodigoAbreviacion"] === codigo,
          );
        if (coincidencias.length !== 1) {
          throw new GestionPersonasMidCatalogError(
            `Se esperaba un único tipo_contribuyente activo con código ${codigo}; se encontraron ${coincidencias.length}.`,
          );
        }
        const id = coincidencias[0]["Id"];
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
          throw new GestionPersonasMidCatalogError(
            `El tipo_contribuyente ${codigo} no contiene un Id entero positivo.`,
          );
        }
        return id;
      }),
      catchError((error: unknown) => {
        if (error instanceof GestionPersonasMidCatalogError) {
          return throwError(() => error);
        }
        const detalle = error instanceof HttpErrorResponse
          ? `HTTP ${error.status || "sin respuesta"} al consultar Terceros CRUD.`
          : error instanceof Error
            ? error.message
            : "Error no identificado al consultar Terceros CRUD.";
        return throwError(
          () =>
            new GestionPersonasMidCatalogError(
              `No se pudo resolver ${codigo} desde /tipo_contribuyente. ${detalle}`,
            ),
        );
      }),
    );
  }
}
