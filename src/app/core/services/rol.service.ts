import { Injectable, signal } from "@angular/core";
import { ImplicitAutenticationService } from "./implicit_autentication.service";
import { Rol, ROLES_DISPONIBLES } from "../constants/roles.const";
import type { MatrizAccionesPorRol } from "../constants/acciones-por-rol-y-estado.const";
import { firstValueFrom } from "rxjs";
import { singleSpaPropsSubject } from "src/single-spa/single-spa-props";

@Injectable({
  providedIn: "root",
})
export class RolService {
  /**
   * Roles del usuario como señal.
   *
   * Es la fuente reactiva: los `computed` de las pantallas (menús, columnas de
   * acciones) se recalculan solos cuando la carga asíncrona del token termina.
   */
  private readonly rolesSignal = signal<readonly Rol[]>([]);
  private readonly rolActivoSignal = signal<Rol | null>(null);
  private cargaRoles?: Promise<void>;
  /** true cuando la carga de roles terminó (con o sin roles). */
  private cargado = false;

  /** Roles del usuario, solo lectura, para usar dentro de `computed`. */
  readonly roles = this.rolesSignal.asReadonly();

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
      const roles = ROLES_DISPONIBLES.filter((rol) =>
        rolesObtenidos.includes(rol),
      );
      this.rolesSignal.set(roles);
      const rolSolicitado = props.rolActivo;
      this.rolActivoSignal.set(
        rolSolicitado && roles.includes(rolSolicitado)
          ? rolSolicitado
          : roles.length === 1
            ? roles[0]
            : null,
      );
    } finally {
      this.cargado = true;
    }
  }

  /** true si los roles ya se consultaron al proveedor de identidad. */
  estaCargado(): boolean {
    return this.cargado;
  }

  getRoles(): Rol[] {
    return [...this.rolesSignal()];
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
    return this.rolActivoSignal();
  }

  tieneRol(rol: string): boolean {
    return this.rolesSignal().some((rolDisponible) => rolDisponible === rol);
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
  permisoCreacion(rolesModulo: readonly string[]): boolean {
    return rolesModulo.some((rol) =>
      this.rolesSignal().some((rolDisponible) => rolDisponible === rol),
    );
  }

  /**
   * Permiso para mostrar la columna de acciones de un módulo.
   *
   * Devuelve true si alguno de los roles del usuario tiene al menos una acción
   * en algún estado de la matriz. Al leer `rolesSignal` es seguro llamarlo
   * dentro de un `computed`.
   */
  mostrarAcciones(accionesModulo: MatrizAccionesPorRol): boolean {
    return this.rolesSignal().some((rol) => {
      const accionesPorEstado = accionesModulo[rol];
      return (
        !!accionesPorEstado &&
        Object.values(accionesPorEstado).some(
          (acciones) => (acciones?.length ?? 0) > 0,
        )
      );
    });
  }

  getRolPrioritario(rolPrioridad: string[]): string | null {
    return (
      rolPrioridad.find((rol) =>
        this.rolesSignal().some((rolDisponible) => rolDisponible === rol),
      ) ?? null
    );
  }
}
