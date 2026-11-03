/** Registro de dependencia devuelto por el servicio Oikos. */
export interface DependenciaOikos {
  readonly Id: number;
  readonly Nombre: string;
  readonly Activo: boolean;
}

/** Opción de dependencia utilizada por los formularios del asistente. */
export interface OpcionDependencia {
  readonly valor: number;
  readonly etiqueta: string;
}
