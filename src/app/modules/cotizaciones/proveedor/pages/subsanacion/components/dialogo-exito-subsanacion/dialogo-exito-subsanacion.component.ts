import { Component, Inject, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { AlertService } from "src/app/shared/services/alert.service";
import { formatoFechaHoraOferente } from "../../../../../models/oferente.model";

/** Datos del acuse de radicación de la subsanación. */
export interface DialogoExitoSubsanacionDatos {
  readonly radicado: string;
  readonly solicitudId: string;
  /** Fecha ISO de la radicación. */
  readonly fecha: string;
  readonly operador: string;
  readonly hash: string;
}

/**
 * Acuse de radicación de P-08.
 *
 * Confirma el radicado y devuelve al proveedor a su cotización. La constancia
 * PDF es simulada: el gestor documental institucional aún no está conectado.
 */
@Component({
  selector: "dialogo-exito-subsanacion",
  templateUrl: "./dialogo-exito-subsanacion.component.html",
  styleUrls: ["./dialogo-exito-subsanacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoExitoSubsanacionComponent {
  private readonly alerta = inject(AlertService);

  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoExitoSubsanacionComponent,
      boolean
    >,
    @Inject(MAT_DIALOG_DATA)
    readonly datos: DialogoExitoSubsanacionDatos,
  ) {}

  get fecha(): string {
    return formatoFechaHoraOferente(this.datos.fecha);
  }

  descargarConstancia(): void {
    void this.alerta.showAlert(
      "Constancia en preparación",
      "La constancia de la subsanación se generará cuando el gestor documental institucional esté conectado. El radicado y la estampa cronológica ya quedaron registrados en la demostración.",
    );
  }

  irACotizacion(): void {
    this.dialogRef.close(true);
  }
}
