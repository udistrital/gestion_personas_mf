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
  /** `envio` para P-04 y `actualizacion` para P-05. */
  readonly modo?: "envio" | "actualizacion";
  readonly totalAnterior?: number;
  readonly fechaCierre?: string;
  readonly versionAnterior?: string;
  readonly versionNueva?: string;
  readonly adenda?: string;
  readonly radicadoPrevio?: string;
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

  get esActualizacion(): boolean {
    return this.datos.modo === "actualizacion";
  }

  get diferencia(): number {
    return this.datos.total - (this.datos.totalAnterior ?? 0);
  }

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

  formatoDiferencia(valor: number): string {
    const signo = valor > 0 ? "+" : "";
    return `${signo}${this.formatoMoneda(valor)}`;
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
