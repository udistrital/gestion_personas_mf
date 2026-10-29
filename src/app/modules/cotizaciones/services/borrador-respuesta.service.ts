import { Injectable } from "@angular/core";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";

export interface BorradorRespuestaProveedor extends BorradorBase {
  readonly formValue: Record<string, unknown>;
}

@Injectable({ providedIn: "root" })
export class BorradorRespuestaService {
  guardar(
    solicitudId: string,
    proveedorId: string,
    formValue: Record<string, unknown>,
    currentStep: number,
  ): boolean {
    return this.almacen(solicitudId, proveedorId).guardar({
      version: 1,
      currentStep,
      savedAt: new Date().toISOString(),
      formValue,
    });
  }

  cargar(
    solicitudId: string,
    proveedorId: string,
  ): BorradorRespuestaProveedor | null {
    return this.almacen(solicitudId, proveedorId).cargar();
  }

  eliminar(solicitudId: string, proveedorId: string): void {
    this.almacen(solicitudId, proveedorId).eliminar();
  }

  private almacen(
    solicitudId: string,
    proveedorId: string,
  ): BorradorService<BorradorRespuestaProveedor> {
    return new BorradorService<BorradorRespuestaProveedor>(
      `agora.gestion-personas.borrador.respuesta.${encodeURIComponent(solicitudId)}.${encodeURIComponent(proveedorId)}`,
    );
  }
}
