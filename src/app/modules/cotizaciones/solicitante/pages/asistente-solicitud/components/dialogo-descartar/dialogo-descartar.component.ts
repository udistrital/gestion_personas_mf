import { Component, Inject, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type {
  ModoEdicionSolicitud,
  ResumenDiferencias,
  VersionEdicionSolicitud,
} from "../../../../../models/edicion-solicitud.model";

/** Datos que el asistente entrega al diálogo de descarte. */
export interface DialogoDescartarDatos {
  readonly solicitudId: string;
  readonly modo: ModoEdicionSolicitud;
  /** Cambios de esta sesión que se perderían si se confirma el descarte. */
  readonly diferencias: ResumenDiferencias;
  /** Versiones guardadas, de la vigente a la original. */
  readonly versiones: readonly VersionEdicionSolicitud[];
}

/** Decisión del diálogo: versión a la que se vuelve; `null` = la vigente. */
export interface ResultadoDescartar {
  readonly version: string | null;
}

/**
 * Diálogo "Descartar cambios" de la edición (S-04).
 *
 * El descarte es progresivo: la versión vigente conserva todo lo guardado y
 * solo elimina el avance sin guardar; una versión anterior restaura su
 * fotografía y descarta los guardados posteriores. Antes de confirmar se
 * enumeran los cambios en riesgo de la opción elegida. El foco entra al botón
 * de seguir editando (acción segura) y `Escape` cancela.
 */
@Component({
  selector: "dialogo-descartar",
  templateUrl: "./dialogo-descartar.component.html",
  styleUrls: ["./dialogo-descartar.component.scss"],
  standalone: false,
})
export class DialogoDescartarComponent {
  /** Versión elegida (inicialmente la vigente). */
  readonly seleccion = signal("");

  constructor(
    private readonly dialogRef: MatDialogRef<DialogoDescartarComponent>,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoDescartarDatos,
  ) {
    this.seleccion.set(
      this.datos.versiones.find((version) => version.actual)?.version ??
        this.datos.versiones[0]?.version ??
        "",
    );
  }

  get etiquetaModo(): string {
    return this.datos.modo === "completa"
      ? "Borrador · edición completa"
      : "Solicitud enviada · modificación restringida";
  }

  get versiones(): readonly VersionEdicionSolicitud[] {
    return this.datos.versiones;
  }

  /** true si hay versiones anteriores a las que se pueda volver. */
  get hayVersionesAnteriores(): boolean {
    return this.datos.versiones.some((version) => !version.actual);
  }

  /** Versión marcada por el usuario (la vigente si no hay selección). */
  get seleccionada(): VersionEdicionSolicitud | null {
    return (
      this.datos.versiones.find(
        (version) => version.version === this.seleccion(),
      ) ??
      this.datos.versiones.find((version) => version.actual) ??
      null
    );
  }

  /** true cuando se conserva la versión vigente. */
  get esVigente(): boolean {
    return this.seleccionada?.actual !== false;
  }

  /** Cambios que se perderían con la opción elegida. */
  get cambios(): ResumenDiferencias {
    if (this.esVigente) {
      return this.datos.diferencias;
    }
    return this.seleccionada?.diferencias ?? { grupos: [], total: 0 };
  }

  /** Título del bloque de cambios en riesgo. */
  get tituloCambios(): string {
    return this.esVigente
      ? "Cambios de esta sesión sin guardar"
      : "Cambios guardados que se perderán";
  }

  /** Etiqueta del botón de confirmación. */
  get tituloAccion(): string {
    return this.esVigente
      ? "Descartar cambios"
      : `Volver a ${this.seleccionada?.version ?? "la versión anterior"}`;
  }

  /** Icono del botón de confirmación. */
  get iconoAccion(): string {
    return this.esVigente ? "delete_outline" : "settings_backup_restore";
  }

  /** Elige la versión que se conservará. */
  seleccionar(version: string): void {
    this.seleccion.set(version);
  }

  /** Cierra sin tocar el formulario. */
  seguirEditando(): void {
    this.dialogRef.close();
  }

  /** Confirma el descarte con la versión elegida. */
  descartar(): void {
    this.dialogRef.close({
      version: this.esVigente ? null : (this.seleccionada?.version ?? null),
    });
  }
}
