import { environment } from "src/environments/environment";

/**
 * Roles que maneja el módulo.
 *
 * La lista de literales es el contrato de tipos; los valores concretos los
 * entrega `environment.ROL`. Si el proveedor de identidad cambia un literal,
 * se ajusta el environment y este archivo falla en compilación (cada constante
 * está anotada como `Rol`), sin tocar pantallas ni guards.
 */
export type Rol = "PROVEEDOR" | "JEFE_DEPENDENCIA" | "ORDENADOR_DEL_GASTO";

export const ROL_PROVEEDOR: Rol = environment.ROL.PROVEEDOR;
export const ROL_JEFE_DEPENDENCIA: Rol = environment.ROL.JEFE_DEPENDENCIA;
export const ROL_ORDENADOR_DEL_GASTO: Rol = environment.ROL.ORDENADOR_DEL_GASTO;

/** Todos los roles que el módulo reconoce en el token del usuario. */
export const ROLES_DISPONIBLES: readonly Rol[] = [
  ROL_PROVEEDOR,
  ROL_JEFE_DEPENDENCIA,
  ROL_ORDENADOR_DEL_GASTO,
];

/** Roles con acceso al área solicitante (S-01 a S-13). */
export const ROLES_SOLICITANTE: readonly Rol[] = [
  ROL_JEFE_DEPENDENCIA,
  ROL_ORDENADOR_DEL_GASTO,
];

/** Roles que pueden crear y editar solicitudes de cotización. */
export const ROLES_CREACION_SOLICITUD: readonly string[] =
  environment.ROLES_CREACION.SOLICITUD;
