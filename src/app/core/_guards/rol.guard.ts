import { inject } from "@angular/core";
import { CanActivateFn, CanMatchFn, Router } from "@angular/router";
import { ROL_PROVEEDOR, ROLES_SOLICITANTE, Rol } from "../constants/roles.const";
import { RolService } from "../services/rol.service";

/** Protege las áreas lazy según el rol activo elegido por el Root. */
export const rolGuard: CanMatchFn = async (route) => {
  const roles = route.data?.["roles"] as readonly Rol[] | undefined;
  const servicio = inject(RolService);
  await servicio.cargarRoles();
  const rolActivo = servicio.getRolActivo();
  return !!rolActivo && !!roles?.includes(rolActivo);
};

/** Envía la entrada de Cotizaciones al área correspondiente al rol activo. */
export const entradaCotizacionesGuard: CanActivateFn = async (_route, state) => {
  const servicio = inject(RolService);
  const router = inject(Router);
  await servicio.cargarRoles();

  const rolActivo = servicio.getRolActivo();
  if (!rolActivo) {
    return false;
  }

  const destino =
    rolActivo === ROL_PROVEEDOR
      ? ["cotizaciones", "mis-solicitudes"]
      : ROLES_SOLICITANTE.includes(rolActivo)
        ? ["cotizaciones", "solicitudes"]
        : null;
  return destino
    ? router.createUrlTree(destino, { queryParams: state.root.queryParams })
    : false;
};
