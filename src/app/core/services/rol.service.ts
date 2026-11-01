import { Injectable } from "@angular/core";
import { ImplicitAutenticationService } from "./implicit_autentication.service";
import {
  Rol,
  ROLES_DISPONIBLES,
} from "../constants/roles.const";
import { firstValueFrom } from "rxjs";
import { singleSpaPropsSubject } from "src/single-spa/single-spa-props";

@Injectable({
  providedIn: "root",
})
export class RolService {
  private roles: Rol[] = [];
  private rolActivo: Rol | null = null;
  private cargaRoles?: Promise<void>;
  /** true cuando la carga de roles terminó (con o sin roles). */
  private cargado = false;

  constructor(private readonly autenticationService: ImplicitAutenticationService) { }

  cargarRoles(): Promise<void> {
    if (this.cargaRoles) {
      return this.cargaRoles;
    }

    this.cargaRoles = this.cargarRolesDesdeFuentes();
    return this.cargaRoles;
  }

  private async cargarRolesDesdeFuentes(): Promise<void> {
    try {
      const [rolesObtenidos, props] = await Promise.all([
        this.autenticationService.getRole(),
        firstValueFrom(singleSpaPropsSubject),
      ]);
      this.roles = ROLES_DISPONIBLES.filter((rol) =>
        rolesObtenidos.includes(rol),
      );
      const rolSolicitado = props.rolActivo;
      this.rolActivo =
        rolSolicitado && this.roles.includes(rolSolicitado)
          ? rolSolicitado
          : this.roles.length === 1
            ? this.roles[0]
            : null;
    } finally {
      this.cargado = true;
    }
  }

  /** true si los roles ya se consultaron al proveedor de identidad. */
  estaCargado(): boolean {
    return this.cargado;
  }

  getRoles(): Rol[] {
    return this.roles;
  }

  /**
   * Rol con el que el Root pidió entrar al módulo.
   *
   * Es solo una preferencia de navegación (a qué área ir por defecto) y puede
   * ser `null` cuando el usuario tiene varios roles y el Root no eligió uno.
   * No debe usarse para autorizar: eso se resuelve con `tieneRol` /
   * `tieneAlgunRol` sobre todos los roles del usuario.
   */
  getRolActivo(): Rol | null {
    return this.rolActivo;
  }

  tieneRol(rol: string): boolean {
    return this.roles.some((rolDisponible) => rolDisponible === rol);
  }

  /**
   * true si el usuario tiene al menos uno de los roles indicados.
   *
   * Es la comprobación que usan las rutas y los permisos: un usuario puede
   * tener varios roles a la vez y el área se habilita por intersección con la
   * lista del usuario, sin depender de que exista un `rolActivo` único.
   */
  tieneAlgunRol(roles: readonly string[]): boolean {
    return roles.some((rol) => this.tieneRol(rol));
  }

  // Permiso para creación y edición
  permisoCreacion(rolesModulo: string[]): boolean {
    return rolesModulo.some((rol) =>
      this.roles.some((rolDisponible) => rolDisponible === rol),
    );
  }

  // Permiso para mostrar columna de acciones en un módulo en especifico
  mostrarAcciones(accionesModulo: { [rol: string]: { [estado: number]: string[] } }): boolean {
    return this.roles.some((rol) => {
      const accionesPorEstado = accionesModulo[rol];
      return accionesPorEstado && Object.values(accionesPorEstado).some((acciones) => acciones.length > 0);
    });
  }

  getRolPrioritario(rolPrioridad: string[]): string | null {
    return (
      rolPrioridad.find((rol) =>
        this.roles.some((rolDisponible) => rolDisponible === rol),
      ) ?? null
    );
  }
}
