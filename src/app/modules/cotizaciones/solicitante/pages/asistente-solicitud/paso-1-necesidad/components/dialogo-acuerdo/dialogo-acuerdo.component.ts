import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {
  AcuerdoMarco,
  formatoCop,
} from "../../../../../../models/necesidad.model";

/** Datos que el paso 1 entrega al diálogo de acuerdo marco. */
export interface DialogoAcuerdoDatos {
  readonly acuerdo: AcuerdoMarco;
}

/**
 * Diálogo de "Acuerdo Marco Establecido".
 *
 * Se abre automáticamente cuando el cruce con SICAPITAL devuelve un
 * `acuerdoMarco`; el avance al paso 2 queda bloqueado hasta que el usuario
 * lo acepta (`close(true)`). Cerrarlo sin aceptar (`close(false)`) conserva
 * el bloqueo y deja un enlace para volver a abrirlo.
 *
 * El foco lo mueve el CDK (`MatDialog`): entra al abrirse y regresa al
 * botón que lo abrió al cerrarse.
 */
@Component({
  selector: "dialogo-acuerdo",
  templateUrl: "./dialogo-acuerdo.component.html",
  styleUrls: ["./dialogo-acuerdo.component.scss"],
  standalone: false,
})
export class DialogoAcuerdoComponent {
  readonly formatoCop = formatoCop;

  /** true mientras se simula el registro del acuerdo en el servidor. */
  registrando = false;

  constructor(
    private readonly dialogRef: MatDialogRef<DialogoAcuerdoComponent>,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoAcuerdoDatos,
  ) {}

  get acuerdo(): AcuerdoMarco {
    return this.datos.acuerdo;
  }

  /** Cancela el acuerdo: el avance sigue bloqueado. */
  cancelar(): void {
    if (!this.registrando) {
      this.dialogRef.close(false);
    }
  }

  /** Acepta el acuerdo y libera el avance al paso 2. */
  aceptar(): void {
    if (this.registrando) {
      return;
    }
    this.registrando = true;
    // Simula la escritura del acuse en el servidor.
    setTimeout(() => this.dialogRef.close(true), 500);
  }
}
