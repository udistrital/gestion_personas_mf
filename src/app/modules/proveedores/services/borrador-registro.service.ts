import { Injectable } from "@angular/core";
import { BorradorRegistroPersonaNatural } from "../models/borrador-registro.model";

export const BORRADOR_PERSONA_NATURAL_KEY =
  "agora.gestion-personas.borrador.persona-natural";

@Injectable({ providedIn: "root" })
export class BorradorRegistroService {
  guardar(borrador: BorradorRegistroPersonaNatural): boolean {
    try {
      const serializable: BorradorRegistroPersonaNatural = {
        ...borrador,
        formValue: this.sinArchivos(borrador.formValue) as Record<
          string,
          unknown
        >,
      };
      localStorage.setItem(
        BORRADOR_PERSONA_NATURAL_KEY,
        JSON.stringify(serializable),
      );
      return true;
    } catch {
      return false;
    }
  }

  cargar(): BorradorRegistroPersonaNatural | null {
    try {
      const crudo = localStorage.getItem(BORRADOR_PERSONA_NATURAL_KEY);
      if (!crudo) {
        return null;
      }

      const parsed = JSON.parse(crudo) as BorradorRegistroPersonaNatural;
      if (parsed.version !== 1 || typeof parsed.formValue !== "object") {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  eliminar(): void {
    localStorage.removeItem(BORRADOR_PERSONA_NATURAL_KEY);
  }

  /**
   * File objects cannot be JSON-serialized. Drafts keep field names but drop
   * binary uploads so restore never throws or stores a fake path.
   */
  private sinArchivos(valor: unknown): unknown {
    if (typeof File !== "undefined" && valor instanceof File) {
      return null;
    }

    if (Array.isArray(valor)) {
      return valor.map((item) => this.sinArchivos(item));
    }

    if (valor && typeof valor === "object") {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([clave, item]) => [
          clave,
          this.sinArchivos(item),
        ]),
      );
    }

    return valor;
  }
}
