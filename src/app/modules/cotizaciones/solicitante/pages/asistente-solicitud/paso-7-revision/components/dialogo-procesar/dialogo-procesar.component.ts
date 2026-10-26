import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { ResumenRadicacion, pluralizarProveedores } from "../../../../../../models/revision.model";

/** Datos que el paso 7 entrega al diálogo de confirmación. */
export interface DialogoProcesarDatos {
  readonly resumen: ResumenRadicacion;
}

/**
 * Diálogo "¿Procesar la solicitud?".
 *
 * Advierte que la radicación es vinculante e inmodificable antes de enviar la
 * solicitud a los proveedores objetivo. Al confirmar devuelve `true` y el paso
 * 7 simula la radicación; al cancelar devuelve `false` y todo sigue editable.
 *
 * El foco lo mueve el CDK (`MatDialog`): entra al abrirse y vuelve al botón que
 * lo abrió al cerrarse.
 */
@Component({
  selector: "dialogo-procesar",
  templateUrl: "./dialogo-procesar.component.html",
  styleUrls: ["./dialogo-procesar.component.scss"],
  standalone: false,
})
export class DialogoProcesarComponent {
  /** true mientras se simula el registro de la radicación en el servidor. */
  radicando = false;

  constructor(
    private readonly dialogRef: MatDialogRef<DialogoProcesarComponent>,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoProcesarDatos,
  ) {}

  get resumen(): ResumenRadicacion {
    return this.datos.resumen;
  }

  /** Etiqueta "12 proveedores" del texto de advertencia. */
  get proveedoresTexto(): string {
    return pluralizarProveedores(this.resumen.proveedoresNotificados);
  }

  /** Cancela: la solicitud permanece en revisión y editable. */
  cancelar(): void {
    if (!this.radicando) {
      this.dialogRef.close(false);
    }
  }

  /** Confirma y dispara la radicación formal simulada. */
  procesar(): void {
    if (this.radicando) {
      return;
    }
    this.radicando = true;
    // Simula la escritura del consecutivo de radicación en el servidor.
    setTimeout(() => this.dialogRef.close(true), 700);
  }
}
