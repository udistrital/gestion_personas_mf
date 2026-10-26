export interface TerceroMidPayload {
  Id?: number;
  NombreCompleto?: string;
  TipoContribuyenteId: number;
  PrimerNombre?: string;
  SegundoNombre?: string;
  PrimerApellido?: string;
  SegundoApellido?: string;
  FechaNacimiento?: string;
  DatosIdentificacion?: DatosIdentificacionMidPayload[];
}

export interface DatosIdentificacionMidPayload {
  Numero: string;
  TipoDocumentoId: number;
  CiudadExpedicion?: number;
  FechaExpedicion?: string;
  DigitoVerificacion?: string;
}

export interface ProveedorNaturalMidPayload {
  PerfilDeclarado?: number;
  ExperienciaLaboralMeses?: number;
  ExperienciaProfesionalMeses?: number;
}

export interface ProveedorJuridicoMidPayload {
  NombreComercial?: string;
  MatriculaMercantil?: number;
  FechaConstitucion?: string;
  FechaRenovacion?: string;
  ReportaBeneficiosFinales?: boolean;
  CotizaBolsa?: boolean;
  RequiereRevisorFiscal?: boolean;
}

export interface ContactoMidPayload {
  Id?: number;
  NombreContacto?: string;
  TipoCanal?: string;
  Finalidad?: string;
  ValorEspecifico?: string;
  EsPrincipal?: boolean;
  Extension?: string;
}

export interface CuentaBancariaMidPayload {
  Id?: number;
  EntidadBancariaId?: number;
  TipoCuentaId?: number;
  NumeroCuenta?: string;
  NombreTitular?: string;
  CiudadAperturaId?: number;
  EsPrincipal?: boolean;
}

export interface ProveedorMidRespuesta {
  Id?: number;
  TerceroId?: number;
  TipoRegistroId?: number;
  Activo?: boolean;
  Tercero?: TerceroMidRespuesta;
  ProveedorNatural?: ProveedorNaturalMidRespuesta;
  ProveedorJuridico?: ProveedorJuridicoMidRespuesta;
  Contacto?: ContactoMidRespuesta[];
  CuentaBancaria?: CuentaBancariaMidRespuesta[];
}

export interface TerceroMidRespuesta {
  Id?: number;
  NombreCompleto?: string;
  TipoContribuyenteId?: number;
  DatosIdentificacion?: DatosIdentificacionMidRespuesta[];
  TipoContribuyente?: CatalogoMidRespuesta;
}

export interface DatosIdentificacionMidRespuesta {
  Id?: number;
  Numero?: string;
  TipoDocumentoId?: number;
  CiudadExpedicion?: number;
}

export interface ProveedorNaturalMidRespuesta {
  Id?: number;
  PerfilDeclarado?: number;
  ExperienciaLaboralMeses?: number;
  ExperienciaProfesionalMeses?: number;
  Perfil?: CatalogoMidRespuesta;
}

export interface ProveedorJuridicoMidRespuesta {
  Id?: number;
  NombreComercial?: string;
  MatriculaMercantil?: number;
  FechaConstitucion?: string;
}

export interface ContactoMidRespuesta {
  Id?: number;
  NombreContacto?: string;
  Finalidad?: string;
  TipoCanal?: string;
  ValorEspecifico?: string;
  EsPrincipal?: boolean;
}

export interface CuentaBancariaMidRespuesta {
  Id?: number;
  EntidadBancariaId?: number;
  TipoCuentaId?: number;
  NumeroCuenta?: string;
  NombreTitular?: string;
  CiudadAperturaId?: number;
  EsPrincipal?: boolean;
}

export interface CatalogoMidRespuesta {
  Id?: number;
  Nombre?: string;
}

export interface ErrorRelacionMid {
  path?: string;
  service?: string;
  message?: string;
  kind?: string;
}

export interface ProveedorMidMetaData {
  Errors?: ErrorRelacionMid[];
  Length?: number;
}

export interface RespuestaProveedorMid {
  Success: boolean;
  Status: string;
  Message: string;
  Data: ProveedorMidRespuesta;
  MetaData?: ProveedorMidMetaData;
}

export interface RespuestaEscrituraProveedorMid {
  Success: boolean;
  Status: string;
  Message: string;
  Data?: ProveedorMidRespuesta | null;
  MetaData?: ProveedorMidMetaData;
}

export interface ProveedorMidPayload {
  TipoRegistroId: number;
  Tercero: TerceroMidPayload;
  ProveedorNatural?: ProveedorNaturalMidPayload;
  ProveedorJuridico?: ProveedorJuridicoMidPayload;
  Contacto?: ContactoMidPayload[];
  CuentaBancaria?: CuentaBancariaMidPayload[];
  DescripcionPortafolio?: string;
}

export type ProveedorMidPatchPayload = ProveedorMidPayload;
