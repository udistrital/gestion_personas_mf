import { Injectable, signal } from "@angular/core";

export const CLAVE_CONSENTIMIENTO = "agora.gestion-personas.consentimiento";

@Injectable({ providedIn: "root" })
export class ConsentimientoService {
  readonly aceptado = signal(false);

  constructor() {
    this.aceptado.set(this.leer());
  }

  registrarAceptacion(): void {
    try {
      sessionStorage.setItem(CLAVE_CONSENTIMIENTO, "aceptado");
    } catch {
      // Sin storage disponible el estado solo vive en memoria de la pestaña.
    }
    this.aceptado.set(true);
  }

  private leer(): boolean {
    try {
      return sessionStorage.getItem(CLAVE_CONSENTIMIENTO) === "aceptado";
    } catch {
      return false;
    }
  }
}
