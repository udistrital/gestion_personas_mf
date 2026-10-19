/**
 * Contrato mínimo de todo borrador persistido en el navegador.
 *
 * Los tipos concretos (`BorradorRegistroPersonaNatural`,
 * `BorradorSolicitudNueva`, ...) lo extienden y añaden sus propios campos.
 */
export interface BorradorBase {
  /** Esquema del borrador; cambia solo si cambia su forma de guardarse. */
  version: number;
  /** Paso (1-based) que el usuario había alcanzado. */
  currentStep: number;
  /** ISO8601 de la última guardada. */
  savedAt: string;
}

/**
 * Persistencia genérica de borradores en `localStorage`.
 *
 * Solo se preocupa por la clave, la versión y el manejo de errores de
 * almacenamiento; cada tipo de borrador aporta su modelo. No persiste
 * archivos: las capas que manejan `File` (registro de proveedores) descartan
 * los binarios antes de llamar a `guardar`, y los asistentes no guardan
 * archivos en el borrador (se suben en el servidor cuando exista).
 *
 * No se registra como provider: cada consumidor decide la clave
 * (`super("agora.…")`).
 */
export class BorradorService<T extends BorradorBase> {
  constructor(
    protected readonly clave: string,
    protected readonly versionEsperada: number = 1,
  ) {}

  /** Serializa y guarda. Devuelve false si el almacenamiento falla. */
  guardar(borrador: T): boolean {
    try {
      localStorage.setItem(this.clave, JSON.stringify(borrador));
      return true;
    } catch {
      return false;
    }
  }

  /** Devuelve el borrador almacenado o null (vacío, corrupto o ajeno). */
  cargar(): T | null {
    try {
      const crudo = localStorage.getItem(this.clave);
      if (!crudo) {
        return null;
      }

      const parsed = JSON.parse(crudo) as T | null;
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return this.esValido(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  eliminar(): void {
    try {
      localStorage.removeItem(this.clave);
    } catch {
      /* almacenamiento no disponible: nada que limpiar */
    }
  }

  /** Validación del payload; los subtipos pueden añadir condiciones. */
  protected esValido(borrador: T): boolean {
    return borrador.version === this.versionEsperada;
  }
}
