export type Rol = "PROVEEDOR" | "JEFE_DEPENDENCIA" | "ORDENADOR_DEL_GASTO";

export const ROLES_DISPONIBLES: readonly Rol[] = [
  "PROVEEDOR",
  "JEFE_DEPENDENCIA",
  "ORDENADOR_DEL_GASTO",
];

/** Roles con acceso al área solicitante (S-01 a S-13). */
export const ROLES_SOLICITANTE: readonly Rol[] = [
  "JEFE_DEPENDENCIA",
  "ORDENADOR_DEL_GASTO",
];

export const ROL_PROVEEDOR: Rol = "PROVEEDOR";
export const ROL_JEFE_DEPENDENCIA: Rol = "JEFE_DEPENDENCIA";
export const ROL_ORDENADOR_DEL_GASTO: Rol = "ORDENADOR_DEL_GASTO";
