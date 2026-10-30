import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { defer, map, Observable } from "rxjs";
import { environment } from "src/environments/environment";
import {
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

export interface ResultadoEnvioMid {
  tipo: "success" | "partial" | "rejected" | "indeterminate" | "error";
  mensaje: string;
  detalle: string;
  proveedorId?: number;
  terceroId?: number;
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
      tipo: "indeterminate",
      mensaje: "El MID devolvió un estado de éxito no documentado.",
      detalle: `Status recibido: ${respuesta.Status}. No vuelva a enviar el registro hasta verificarlo.`,
      proveedorId,
      terceroId,
    };
  }

  if (respuesta.Status === "200" && proveedorId === undefined) {
    return {
      tipo: "indeterminate",
      mensaje: "El MID respondió éxito, pero no devolvió el Id del proveedor.",
      detalle: `${respuesta.Message} No vuelva a enviar el registro hasta verificarlo. ${detalle}`,
      terceroId,
    };
  }

  if (respuesta.Status === "206" || avisos.length > 0) {
    return {
      tipo: "partial",
      mensaje: respuesta.Message,
      detalle: [
        "Registro materializado parcialmente; revise los avisos antes de continuar.",
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
    detalle: detalle || "El MID confirmó el registro.",
    proveedorId,
    terceroId,
  };
}

export function resumirErrorMid(error: unknown): ResultadoEnvioMid {
  if (error instanceof GestionPersonasMidConfigurationError) {
    return {
      tipo: "error",
      mensaje: "El cableado con el MID está pendiente de configuración.",
      detalle: error.message,
    };
  }
  if (error instanceof GestionPersonasMidProtocolError) {
    return {
      tipo: "indeterminate",
      mensaje: "No se pudo validar la respuesta del MID.",
      detalle: `${error.message} No vuelva a enviar el registro hasta verificarlo.`,
    };
  }
  if (error instanceof HttpErrorResponse) {
    const mensaje = mensajeDeEnvelope(error.error);
    if (error.status === 0 || error.status >= 500) {
      return {
        tipo: "indeterminate",
        mensaje: mensaje ?? "No se pudo confirmar el resultado del registro.",
        detalle: `HTTP ${error.status || "sin respuesta"}. El MID puede haber materializado datos; no repita el POST sin verificar el estado.`,
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
    return {
      tipo: "error",
      mensaje: mensaje ?? "No se pudo completar el registro en el MID.",
      detalle: `HTTP ${error.status || "sin respuesta"}.`,
    };
  }
  return {
    tipo: "error",
    mensaje: "No se pudo completar el registro en el MID.",
    detalle: error instanceof Error ? error.message : "Error no identificado.",
  };
}

@Injectable({ providedIn: "root" })
export class GestionPersonasMidService {
  constructor(private readonly http: HttpClient) {}

  registrarPersonaNatural(
    payload: NuevoProveedorNaturalMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      const tipoRegistroId = this.resolverTipoRegistroId("P_NATURAL");
      const request: ProveedorNaturalMidRequest = {
        ...payload,
        TipoRegistroId: tipoRegistroId,
      };
      return this.http
        .post<unknown>(`${baseUrl}/proveedor`, request)
        .pipe(map(interpretarRespuestaMid));
    });
  }

  registrarPersonaJuridica(
    payload: NuevoProveedorJuridicoMidPayload,
  ): Observable<RespuestaMid> {
    return defer(() => {
      const baseUrl = this.urlBaseConfigurada();
      const tipoRegistroId = this.resolverTipoRegistroId("P_JURIDICA");
      const request: ProveedorJuridicoMidRequest = {
        ...payload,
        TipoRegistroId: tipoRegistroId,
      };
      return this.http
        .post<unknown>(`${baseUrl}/proveedor`, request)
        .pipe(map(interpretarRespuestaMid));
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
  ): number {
    return codigo === "P_NATURAL" ? 1 : 2;
  }
}
