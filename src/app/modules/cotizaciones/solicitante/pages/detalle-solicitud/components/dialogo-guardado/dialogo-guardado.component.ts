import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { ResultadoGuardadoSolicitud } from "../../../../../models/edicion-solicitud.model";

/** Datos que la confirmación de guardado recibe del detalle. */
export interface DialogoGuardadoDatos {
  readonly solicitudId: string;
  readonly resultado: ResultadoGuardadoSolicitud;
}

/** Acción elegida por el usuario al cerrar la confirmación. */
export type AccionDialogoGuardado = "detalle" | "continuar";

/**
 * Confirmación "Cambios guardados correctamente" (S-04).
 *
 * Se abre desde el detalle con el resultado que dejó la navegación y resume la
 * nueva versión del expediente (versión, revisión, estado, fecha y cambios).
 * "Continuar editando borrador" solo aparece en la edición completa: una
 * modificación restringida queda pendiente de aprobación (S-08).
 */
@Component({
  selector: "dialogo-guardado",
  templateUrl: "./dialogo-guardado.component.html",
  styleUrls: ["./dialogo-guardado.component.scss"],
  standalone: false,
})
export class DialogoGuardadoComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoGuardadoComponent,
      AccionDialogoGuardado
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoGuardadoDatos,
  ) {}

  get resultado(): ResultadoGuardadoSolicitud {
    return this.datos.resultado;
  }

  get esBorrador(): boolean {
    return this.resultado.modo === "completa";
  }

  get tituloAccion(): string {
    return this.esBorrador
      ? "La nueva versión quedó guardada como borrador."
      : "La propuesta quedó pendiente de aprobación de la Oficina de Contratación.";
  }

  /** Cierra volviendo al detalle de la solicitud. */
  volverAlDetalle(): void {
    this.dialogRef.close("detalle");
  }

  /** Cierra y deja que el detalle regrese al asistente de edición. */
  continuarEditando(): void {
    this.dialogRef.close("continuar");
  }
}
