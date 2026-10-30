import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/** Datos de contexto que se muestran en la confirmación de radicación. */
export interface DialogoConfirmarEnvioDatos {
  readonly solicitudId: string;
  /** Valor total estimado de la oferta (subtotal + IVA). */
  readonly total: number;
  /** Días de vigencia declarados por el proveedor. */
  readonly diasVigencia: number | null;
  /** Fecha de vencimiento de la oferta en formato ISO, si existe. */
  readonly fechaVencimiento: string;
}

/**
 * Confirmación previa a la radicación de la respuesta (P-04).
 *
 * Recuerda que el envío es preclusivo: se genera un radicado y no se puede
 * reemplazar la respuesta desde esta pantalla. El foco entra al botón de
 * revisar (acción segura) y `Escape` cierra sin radicar.
 */
@Component({
  selector: "dialogo-confirmar-envio",
  templateUrl: "./dialogo-confirmar-envio.component.html",
  styleUrls: ["./dialogo-confirmar-envio.component.scss"],
  standalone: false,
})
export class DialogoConfirmarEnvioComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoConfirmarEnvioComponent,
      boolean
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoConfirmarEnvioDatos,
  ) {}

  get vigencia(): string {
    return this.datos.diasVigencia !== null
      ? `${this.datos.diasVigencia} días calendario`
      : "Sin definir";
  }

  get vencimiento(): string {
    const fecha = this.datos.fechaVencimiento;
    if (!fecha) {
      return "Sin definir";
    }
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
  }

  formatoMoneda(valor: number): string {
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }

  /** Cierra sin radicar la respuesta. */
  revisar(): void {
    this.dialogRef.close(false);
  }

  /** Confirma la radicación. */
  confirmar(): void {
    this.dialogRef.close(true);
  }
}
