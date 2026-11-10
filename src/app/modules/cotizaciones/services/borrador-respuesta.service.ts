import { Injectable } from "@angular/core";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";
import type { ModoRespuestaProveedor } from "../models/respuesta-proveedor.model";

export interface BorradorRespuestaProveedor extends BorradorBase {
  readonly formValue: Record<string, unknown>;
}

/** Contexto opcional que separa el borrador de P-04 del de P-05. */
export interface ContextoBorradorRespuesta {
  readonly modo: ModoRespuestaProveedor;
  /** Versión de solicitud que se está actualizando. */
  readonly versionSolicitud?: string;
}

@Injectable({ providedIn: "root" })
export class BorradorRespuestaService {
  guardar(
    solicitudId: string,
    proveedorId: string,
    formValue: Record<string, unknown>,
    currentStep: number,
    contexto?: ContextoBorradorRespuesta,
  ): boolean {
    return this.almacen(solicitudId, proveedorId, contexto).guardar({
      version: 1,
      currentStep,
      savedAt: new Date().toISOString(),
      formValue,
    });
  }

  cargar(
    solicitudId: string,
    proveedorId: string,
    contexto?: ContextoBorradorRespuesta,
  ): BorradorRespuestaProveedor | null {
    return this.almacen(solicitudId, proveedorId, contexto).cargar();
  }

  eliminar(
    solicitudId: string,
    proveedorId: string,
    contexto?: ContextoBorradorRespuesta,
  ): void {
    this.almacen(solicitudId, proveedorId, contexto).eliminar();
  }

  private almacen(
    solicitudId: string,
    proveedorId: string,
    contexto?: ContextoBorradorRespuesta,
  ): BorradorService<BorradorRespuestaProveedor> {
    const sufijo =
      contexto?.modo === "actualizar"
        ? `.actualizacion.${encodeURIComponent(contexto.versionSolicitud ?? "sin-version")}`
        : "";
    return new BorradorService<BorradorRespuestaProveedor>(
      `agora.gestion-personas.borrador.respuesta.${encodeURIComponent(solicitudId)}.${encodeURIComponent(proveedorId)}${sufijo}`,
    );
  }
}
