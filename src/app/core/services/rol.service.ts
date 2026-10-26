import { Injectable } from "@angular/core";
import { ImplicitAutenticationService } from "./implicit_autentication.service";
import { ROLES_DISPONIBLES } from "../constants/roles.const";

@Injectable({
  providedIn: "root",
})
export class RolService {
  private roles: string[] = [];

  constructor(private readonly autenticationService: ImplicitAutenticationService) { }

  async cargarRoles() {
    const rolesObtenidos: any = await this.autenticationService.getRole();
    
    this.roles = ROLES_DISPONIBLES.filter((rol) => rolesObtenidos.includes(rol));
  }

  getRoles(): string[] {
    return this.roles;
  }

  tieneRol(rol: string): boolean {
    return this.roles.includes(rol);
  }

  // Permiso para creación y edición
  permisoCreacion(rolesModulo: string[]): boolean {
    return rolesModulo.some((rol) => this.roles.includes(rol));
  }

  // Permiso para mostrar columna de acciones en un módulo en especifico
  mostrarAcciones(accionesModulo: { [rol: string]: { [estado: number]: string[] } }): boolean {
    return this.roles.some((rol) => {
      const accionesPorEstado = accionesModulo[rol];
      return accionesPorEstado && Object.values(accionesPorEstado).some((acciones) => acciones.length > 0);
    });
  }

  getRolPrioritario(rolPrioridad: string[]): string | null {
    return rolPrioridad.find(rol => this.roles.includes(rol)) ?? null;
  }
}
