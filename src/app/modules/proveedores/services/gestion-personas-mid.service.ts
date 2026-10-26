import {
  HttpClient,
  HttpParams,
  HttpResponse,
} from "@angular/common/http";
import { Inject, Injectable, InjectionToken } from "@angular/core";
import { defer, Observable } from "rxjs";
import { environment } from "src/environments/environment";
import {
  ProveedorMidPatchPayload,
  ProveedorMidPayload,
  RespuestaEscrituraProveedorMid,
  RespuestaProveedorMid,
} from "../models/gestion-personas-mid.model";

export const GESTION_PERSONAS_MID_BASE_URL = new InjectionToken<string>(
  "GESTION_PERSONAS_MID_BASE_URL",
  {
    providedIn: "root",
    factory: () => environment.GESTION_PERSONAS_MID_SERVICE,
  },
);

export const CAMPOS_PROVEEDOR_NATURAL_MID_PARA_EDICION = [
  "Id",
  "TipoRegistroId",
  "Tercero.Id",
  "Tercero.TipoContribuyenteId",
  "Tercero.DatosIdentificacion.Numero",
  "Tercero.DatosIdentificacion.TipoDocumentoId",
  "Tercero.DatosIdentificacion.CiudadExpedicion",
  "ProveedorNatural.ExperienciaLaboralMeses",
  "ProveedorNatural.ExperienciaProfesionalMeses",
];

export const CAMPOS_PROVEEDOR_JURIDICO_MID_PARA_EDICION = [
  "Id",
  "TipoRegistroId",
  "Tercero.Id",
  "Tercero.NombreCompleto",
  "Tercero.TipoContribuyenteId",
  "Tercero.DatosIdentificacion.Numero",
  "ProveedorJuridico.NombreComercial",
  "ProveedorJuridico.MatriculaMercantil",
  "ProveedorJuridico.FechaConstitucion",
  "CuentaBancaria.Id",
  "CuentaBancaria.EntidadBancariaId",
  "CuentaBancaria.TipoCuentaId",
  "CuentaBancaria.NumeroCuenta",
  "CuentaBancaria.NombreTitular",
  "CuentaBancaria.CiudadAperturaId",
  "CuentaBancaria.EsPrincipal",
];

@Injectable({ providedIn: "root" })
export class GestionPersonasMidService {
  constructor(
    private readonly http: HttpClient,
    @Inject(GESTION_PERSONAS_MID_BASE_URL)
    private readonly baseUrl: string,
  ) {}

  crear(
    payload: ProveedorMidPayload,
  ): Observable<HttpResponse<RespuestaEscrituraProveedorMid>> {
    return defer(() => {
      this.validarPayloadCreacion(payload);
      return this.http.post<RespuestaEscrituraProveedorMid>(
        this.endpoint(),
        payload,
        { observe: "response" },
      );
    });
  }

  consultar(
    id: number | null | undefined,
    fields: string[] = [],
  ): Observable<HttpResponse<RespuestaProveedorMid>> {
    return defer(() => {
      this.validarIdConsulta(id);
      let params = new HttpParams().set("id", id);
      if (fields.length > 0) {
        params = params.set("fields", fields.join(","));
      }
      return this.http.get<RespuestaProveedorMid>(this.endpoint(), {
        params,
        observe: "response",
      });
    });
  }

  actualizar(
    payload: ProveedorMidPatchPayload,
  ): Observable<HttpResponse<RespuestaEscrituraProveedorMid>> {
    return defer(() => {
      this.validarPayloadCreacion(payload);
      this.validarIdTerceroActualizacion(payload.Tercero.Id);
      return this.http.patch<RespuestaEscrituraProveedorMid>(
        this.endpoint(),
        payload,
        { observe: "response" },
      );
    });
  }

  private endpoint(): string {
    const baseUrl = this.baseUrl.trim();
    if (baseUrl.length === 0) {
      throw new Error(
        "Falta configurar la URL base de Gestión de Personas MID para este entorno.",
      );
    }
    return `${baseUrl.replace(/\/+$/, "")}/v1/proveedor`;
  }

  private validarIdConsulta(id: number | null | undefined): asserts id is number {
    if (!Number.isSafeInteger(id) || id === null || id === undefined || id <= 0) {
      throw new Error("El ID del proveedor debe ser un entero positivo.");
    }
  }

  private validarIdTerceroActualizacion(id: number | undefined): asserts id is number {
    if (!Number.isSafeInteger(id) || id === undefined || id <= 0) {
      throw new Error(
        "La actualización requiere el ID del tercero consultado, distinto del ID del proveedor.",
      );
    }
  }

  private validarPayloadCreacion(payload: ProveedorMidPayload): void {
    if (
      !payload
      || typeof payload !== "object"
      || Array.isArray(payload)
      || !Number.isSafeInteger(payload.TipoRegistroId)
      || payload.TipoRegistroId <= 0
    ) {
      throw new Error(
        "TipoRegistroId debe ser un identificador numérico positivo válido para el entorno.",
      );
    }
    if (
      !payload.Tercero
      || typeof payload.Tercero !== "object"
      || Array.isArray(payload.Tercero)
      || !Number.isSafeInteger(payload.Tercero.TipoContribuyenteId)
      || payload.Tercero.TipoContribuyenteId <= 0
    ) {
      throw new Error("El contrato del MID requiere el objeto Tercero.");
    }
    if (
      Boolean(payload.ProveedorNatural)
      === Boolean(payload.ProveedorJuridico)
    ) {
      throw new Error(
        "El payload debe contener exactamente una rama: natural o jurídica.",
      );
    }
  }
}
