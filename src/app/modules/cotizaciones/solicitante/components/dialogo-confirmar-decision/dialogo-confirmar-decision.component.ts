import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { formatoCop } from "../../../models/necesidad.model";

/** Datos que la confirmación de S-11 recibe de la página. */
export interface DialogoConfirmarDecisionDatos {
  readonly solicitudId: string;
  readonly proveedorNombre: string;
  readonly valor: number;
  readonly notificar: boolean;
}

/**
 * Confirmación del envío a validación (S-11).
 *
 * Advierte que el envío es único (RN-35) y resume la oferta que se remite al
 * Ordenador del Gasto. No ejecuta el envío: la página conserva el formulario y
 * el texto si el servicio falla.
 */
@Component({
  selector: "app-dialogo-confirmar-decision",
  templateUrl: "./dialogo-confirmar-decision.component.html",
  styleUrls: ["./dialogo-confirmar-decision.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoConfirmarDecisionComponent {
  readonly moneda = formatoCop;

  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoConfirmarDecisionComponent,
      boolean
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoConfirmarDecisionDatos,
  ) {}

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
