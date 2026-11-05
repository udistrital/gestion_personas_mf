export const environment = {
  production: true,

  AUTENTICACION_MID_SERVICE:
    "https://autenticacion.portaloas.udistrital.edu.co/apioas/autenticacion_mid/v1/",
  GESTION_PERSONAS_MID_SERVICE: "PENDIENTE_CONFIGURAR",
  OIKOS_SERVICE:
    "https://autenticacion.portaloas.udistrital.edu.co/apioas/oikos_crud_api/v2/",
  PARAMETROS_SERVICE:
    "https://autenticacion.portaloas.udistrital.edu.co/apioas/parametros/v1/",
  TERCEROS_SERVICE:
    "https://autenticacion.portaloas.udistrital.edu.co/apioas/terceros_crud/v1/",
  UBICACIONES_SERVICE:
    "https://autenticacion.portaloas.udistrital.edu.co/apioas/ubicaciones_crud/v2/",
  UNGM_UNSPSC_SERVICE: "https://www.ungm.org/API/UNSPSCs",

  /* API pública de días festivos (Nager.Date v3). */
  CALENDARIO_FESTIVOS_URL:
    "https://date.nager.at/api/v3/PublicHolidays",

  /*
   * Roles del módulo tal como los entrega el proveedor de identidad (token
   * del Root). `core/constants/roles.const.ts` los usa como única fuente:
   * si el token empieza a entregar otro literal, se cambia aquí y no en el
   * código.
   */
  ROL: {
    PROVEEDOR: "PROVEEDOR",
    JEFE_DEPENDENCIA: "JEFE_DEPENDENCIA",
    ORDENADOR_DEL_GASTO: "ORDENADOR_DEL_GASTO",
  } as const,
  /* Roles que pueden crear y editar solicitudes de cotización. */
  ROLES_CREACION: {
    SOLICITUD: ["JEFE_DEPENDENCIA", "ORDENADOR_DEL_GASTO"],
  },
};
