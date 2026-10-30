import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/** Datos de la respuesta radicada que se muestran en el acuse. */
export interface DialogoEnvioExitosoDatos {
  readonly radicado: string;
  readonly solicitudId: string;
  /** Valor total de la oferta radicada (subtotal + IVA). */
  readonly total: number;
  /** Fecha de radicación en formato ISO. */
  readonly fechaRadicacion: string;
}

/**
 * Acuse de radicación de la respuesta (P-04).
 *
 * Reemplaza la pantalla de éxito: confirma el radicado generado y, al cerrar,
 * devuelve al proveedor a la bandeja de solicitudes.
 */
@Component({
  selector: "dialogo-envio-exitoso",
  templateUrl: "./dialogo-envio-exitoso.component.html",
  styleUrls: ["./dialogo-envio-exitoso.component.scss"],
  standalone: false,
})
export class DialogoEnvioExitosoComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<DialogoEnvioExitosoComponent>,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoEnvioExitosoDatos,
  ) {}

  get fecha(): string {
    const fecha = new Date(this.datos.fechaRadicacion);
    if (Number.isNaN(fecha.getTime())) {
      return this.datos.fechaRadicacion;
    }
    return fecha.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  formatoMoneda(valor: number): string {
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }

  /** Cierra el acuse; el componente navega a la bandeja. */
  volverABandeja(): void {
    this.dialogRef.close(true);
  }
}
