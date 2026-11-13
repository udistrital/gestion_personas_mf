import { Injectable } from "@angular/core";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";

/** Prefijo único del borrador de S-12. */
export const BORRADOR_SUBSANACION_PREFIX =
  "agora.gestion-personas.borrador.subsanacion";

/** Borrador del formulario de configuración de subsanación. */
export interface BorradorSubsanacion extends BorradorBase {
  version: number;
  currentStep: number;
  savedAt: string;
  /** Valores serializados del formulario de S-12. */
  formValue: Record<string, unknown>;
  /** Oferentes marcados en la tabla. */
  seleccionados: readonly string[];
}

/**
 * Borrador local del formulario de S-12.
 *
 * Se guarda por solicitud para que dos procesos distintos no se pisen. No
 * persiste archivos: la configuración solo guarda observaciones y fechas.
 */
@Injectable({ providedIn: "root" })
export class BorradorSubsanacionService {
  guardar(id: string, borrador: BorradorSubsanacion): boolean {
    return this.almacen(id).guardar(borrador);
  }

  cargar(id: string): BorradorSubsanacion | null {
    return this.almacen(id).cargar();
  }

  eliminar(id: string): void {
    this.almacen(id).eliminar();
  }

  private almacen(id: string): BorradorService<BorradorSubsanacion> {
    return new BorradorService<BorradorSubsanacion>(
      `${BORRADOR_SUBSANACION_PREFIX}.${id}`,
    );
  }
}
