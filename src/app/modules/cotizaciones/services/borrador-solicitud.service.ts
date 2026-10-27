import { Injectable } from "@angular/core";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";

/** Clave única del borrador del asistente S-02 (single point). */
export const BORRADOR_SOLICITUD_KEY =
  "agora.gestion-personas.borrador.solicitud-nueva";

/**
 * Borrador del asistente de nueva solicitud.
 *
 * Guarda los valores crudos del `FormGroup` raíz (un subgrupo por paso) y el
 * paso alcanzado. No guarda archivos: los adjuntos viven en el servidor.
 */
export interface BorradorSolicitudNueva extends BorradorBase {
  version: number;
  currentStep: number;
  savedAt: string;
  /** Valores serializados del `FormGroup` raíz del asistente. */
  formValue: Record<string, unknown>;
}

@Injectable({ providedIn: "root" })
export class BorradorSolicitudService extends BorradorService<BorradorSolicitudNueva> {
  constructor() {
    super(BORRADOR_SOLICITUD_KEY);
  }

  /** Además de la versión, exige los valores del formulario. */
  protected override esValido(borrador: BorradorSolicitudNueva): boolean {
    return (
      super.esValido(borrador) &&
      !!borrador.formValue &&
      typeof borrador.formValue === "object"
    );
  }
}
