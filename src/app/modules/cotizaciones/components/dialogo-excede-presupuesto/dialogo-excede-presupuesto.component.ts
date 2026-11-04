import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/** Datos que la respuesta del proveedor entrega al aviso presupuestal. */
export interface DialogoExcedePresupuestoDatos {
  readonly solicitudId: string;
  /** Límite presupuestal publicado para la cotización (valor del CDP). */
  readonly limite: number;
  /** Valor total estimado de la oferta diligenciada por el proveedor. */
  readonly total: number;
}

/** Resultado del aviso: `revisar` lleva al paso 1 a corregir los valores. */
export type ResultadoExcedePresupuesto = "revisar";

/**
 * Aviso bloqueante de sobrecosto (P-04).
 *
 * Se muestra cuando el total de la oferta supera el límite presupuestal
 * publicado y el proveedor intenta avanzar de paso o radicar la respuesta.
 * No ofrece una acción para continuar: solo permite volver al paso 1 a
 * corregir los valores o cerrar el aviso para seguir en el paso actual.
 */
@Component({
  selector: "dialogo-excede-presupuesto",
  templateUrl: "./dialogo-excede-presupuesto.component.html",
  styleUrls: ["./dialogo-excede-presupuesto.component.scss"],
  standalone: false,
})
export class DialogoExcedePresupuestoComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoExcedePresupuestoComponent,
      ResultadoExcedePresupuesto
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoExcedePresupuestoDatos,
  ) {}

  /** Valor en que la oferta supera el límite. */
  get exceso(): number {
    return Math.max(0, this.datos.total - this.datos.limite);
  }

  /** Porcentaje de exceso frente al límite publicado. */
  get porcentajeExceso(): number {
    return this.datos.limite > 0
      ? (this.exceso / this.datos.limite) * 100
      : 0;
  }

  formatoMoneda(valor: number): string {
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }

  /** Cierra el aviso indicando que se debe corregir el paso 1. */
  revisarValores(): void {
    this.dialogRef.close("revisar");
  }

  /** Cierra el aviso sin mover al usuario del paso actual. */
  cerrar(): void {
    this.dialogRef.close();
  }
}
