export interface DatosIdentificacionMid {
  Numero: string;
  TipoDocumentoId?: number;
  DigitoVerificacion?: string;
  CiudadExpedicion?: number;
  FechaExpedicion?: string;
}

export interface TerceroMid {
  NombreCompleto?: string;
  PrimerNombre?: string;
  SegundoNombre?: string;
  PrimerApellido?: string;
  SegundoApellido?: string;
  FechaNacimiento?: string;
  TipoContribuyenteId?: number;
  DatosIdentificacion?: DatosIdentificacionMid[];
}

export interface ContactoMid {
  NombreContacto?: string;
  Finalidad?: string;
  TipoCanal?: string;
  ValorEspecifico?: string;
  Extension?: string;
  EsPrincipal?: boolean;
}

export interface CuentaBancariaMid {
  EntidadBancariaId?: number;
  TipoCuentaId?: number;
  NumeroCuenta?: string;
  NombreTitular?: string;
  CiudadAperturaId?: number;
  EsPrincipal?: boolean;
}

export interface ProveedorNaturalMid {
  PerfilDeclarado?: number;
  ExperienciaLaboralMeses?: number;
  ExperienciaProfesionalMeses?: number;
}

export interface ProveedorJuridicoMid {
  NombreComercial?: string;
  MatriculaMercantil?: number;
  FechaConstitucion?: string;
  FechaRenovacion?: string;
  ReportaBeneficiosFinales?: boolean;
  CotizaBolsa?: boolean;
  RequiereRevisorFiscal?: boolean;
}

interface ProveedorMidBase {
  DescripcionPortafolio?: string;
  Tercero: TerceroMid;
  Contacto?: ContactoMid[];
  CuentaBancaria?: CuentaBancariaMid[];
}

export interface ProveedorNaturalMidRequest extends ProveedorMidBase {
  TipoRegistroId: number;
  ProveedorNatural: ProveedorNaturalMid;
}

export interface ProveedorJuridicoMidRequest extends ProveedorMidBase {
  TipoRegistroId: number;
  ProveedorJuridico: ProveedorJuridicoMid;
}

export type NuevoProveedorNaturalMidPayload = Omit<
  ProveedorNaturalMidRequest,
  "TipoRegistroId"
>;

export type NuevoProveedorJuridicoMidPayload = Omit<
  ProveedorJuridicoMidRequest,
  "TipoRegistroId"
>;

export interface ErrorMaterializacionMid {
  path?: string;
  service?: string;
  message?: string;
  kind?: string;
}

export interface ProveedorMidMaterializado {
  [propiedad: string]: unknown;
  Id?: number;
  TerceroId?: number;
  TipoRegistroId?: number;
}

export interface RespuestaMid<TData = ProveedorMidMaterializado> {
  Success: boolean;
  Status: string;
  Message: string;
  Data: TData | null;
  MetaData?: {
    Errors?: ErrorMaterializacionMid[];
  };
}

export interface MapeoPayloadMid<TPayload> {
  payload: TPayload;
  omisiones: string[];
}
