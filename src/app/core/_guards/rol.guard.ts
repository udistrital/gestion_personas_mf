import { inject } from "@angular/core";
import { CanActivateFn, CanMatchFn, Router } from "@angular/router";
import { ROL_PROVEEDOR, ROLES_SOLICITANTE, Rol } from "../constants/roles.const";
import { RolService } from "../services/rol.service";

/**
 * Protege las áreas lazy según los roles del usuario.
 *
 * Se compara la lista de roles de la ruta contra **todos** los roles que el
 * usuario tiene, no contra un `rolActivo` único: un usuario con varios roles
 * entra a cualquier área autorizada aunque el Root no haya elegido uno.
 */
export const rolGuard: CanMatchFn = async (route) => {
  const roles = route.data?.["roles"] as readonly Rol[] | undefined;
  if (!roles?.length) {
    return false;
  }

  const servicio = inject(RolService);
  await servicio.cargarRoles();
  return servicio.tieneAlgunRol(roles);
};

/**
 * Envía la entrada de Cotizaciones al área correspondiente.
 *
 * Primero respeta el área del rol que pidió el Root, si el usuario realmente
 * lo tiene. Sin esa preferencia (por ejemplo, varios roles y el selector de
 * Core no comunica ninguno) se entra al área solicitante, que es el flujo
 * base; la otra área sigue accesible porque `rolGuard` la valida por roles.
 */
export const entradaCotizacionesGuard: CanActivateFn = async (_route, state) => {
  const servicio = inject(RolService);
  const router = inject(Router);
  await servicio.cargarRoles();

  const preferido = servicio.getRolActivo();
  const puedeSolicitante = servicio.tieneAlgunRol(ROLES_SOLICITANTE);
  const puedeProveedor = servicio.tieneRol(ROL_PROVEEDOR);

  const destino =
    preferido === ROL_PROVEEDOR && puedeProveedor
      ? ["cotizaciones", "bandeja-solicitudes"]
      : preferido &&
          ROLES_SOLICITANTE.includes(preferido) &&
          puedeSolicitante
        ? ["cotizaciones", "solicitudes"]
        : puedeSolicitante
          ? ["cotizaciones", "solicitudes"]
          : puedeProveedor
            ? ["cotizaciones", "bandeja-solicitudes"]
            : null;

  return destino
    ? router.createUrlTree(destino, { queryParams: state.root.queryParams })
    : false;
};
