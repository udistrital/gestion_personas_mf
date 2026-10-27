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

  getRolActivo(): Rol | null {
    return this.rolActivo;
  }

  tieneRol(rol: string): boolean {
    return this.roles.some((rolDisponible) => rolDisponible === rol);
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
