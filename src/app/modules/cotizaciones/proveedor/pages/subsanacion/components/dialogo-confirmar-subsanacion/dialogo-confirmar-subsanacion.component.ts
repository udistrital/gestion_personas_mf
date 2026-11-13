import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/** Datos del resumen previo a radicar la subsanación (P-08). */
export interface DialogoConfirmarSubsanacionDatos {
  readonly solicitudId: string;
  readonly documentos: readonly {
    readonly nombre: string;
    readonly peso: string;
  }[];
  readonly pendientesObligatorios: number;
  readonly justificacion: string;
  readonly hash: string;
}

/**
 * Confirmación de la radicación formal de la subsanación.
 *
 * El foco inicial queda en la acción segura (revisar) y `Escape` cierra sin
 * radicar. Si faltan obligatorios, el botón de confirmación se deshabilita.
 */
@Component({
  selector: "dialogo-confirmar-subsanacion",
  templateUrl: "./dialogo-confirmar-subsanacion.component.html",
  styleUrls: ["./dialogo-confirmar-subsanacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoConfirmarSubsanacionComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoConfirmarSubsanacionComponent,
      boolean
    >,
    @Inject(MAT_DIALOG_DATA)
    readonly datos: DialogoConfirmarSubsanacionDatos,
  ) {}

  get puedeConfirmar(): boolean {
    return (
      this.datos.pendientesObligatorios === 0 &&
      this.datos.documentos.length > 0
    );
  }

  revisar(): void {
    this.dialogRef.close(false);
  }

  confirmar(): void {
    if (this.puedeConfirmar) {
      this.dialogRef.close(true);
    }
  }
}
