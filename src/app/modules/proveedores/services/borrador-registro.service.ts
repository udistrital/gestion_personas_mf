import { Injectable } from "@angular/core";
import { BorradorRegistroPersonaNatural } from "../models/borrador-registro.model";
import { BorradorService } from "src/app/shared/services/borrador.service";

export const BORRADOR_PERSONA_NATURAL_KEY =
  "agora.gestion-personas.borrador.persona-natural";

/**
 * Fachada del borrador de persona natural sobre `BorradorService<T>`.
 *
 * Conserva exactamente la API de siempre (`guardar`/`cargar`/`eliminar`) y
 * añade lo propio de este formulario: los archivos no se serializan.
 */
@Injectable({ providedIn: "root" })
export class BorradorRegistroService extends BorradorService<BorradorRegistroPersonaNatural> {
  constructor() {
    super(BORRADOR_PERSONA_NATURAL_KEY);
  }

  override guardar(borrador: BorradorRegistroPersonaNatural): boolean {
    return super.guardar({
      ...borrador,
      formValue: this.sinArchivos(borrador.formValue) as Record<
        string,
        unknown
      >,
    });
  }

  protected override esValido(
    borrador: BorradorRegistroPersonaNatural,
  ): boolean {
    return (
      super.esValido(borrador) &&
      borrador.formValue !== null &&
      typeof borrador.formValue === "object" &&
      !Array.isArray(borrador.formValue)
    );
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
