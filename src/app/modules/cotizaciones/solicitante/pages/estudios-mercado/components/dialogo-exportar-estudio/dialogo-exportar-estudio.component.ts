import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { AlertService } from "src/app/shared/services/alert.service";
import type { EstudioMercado } from "../../../../../models/estudio-mercado.model";

/** Datos del modal de exportación. */
export interface DialogoExportarEstudioDatos {
  readonly estudio: EstudioMercado;
}

/** Modal de exportación simulada del mockup S-13a. */
@Component({
  selector: "app-dialogo-exportar-estudio",
  templateUrl: "./dialogo-exportar-estudio.component.html",
  styleUrls: ["./dialogo-exportar-estudio.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoExportarEstudioComponent {
  private readonly dialogRef = inject(MatDialogRef<DialogoExportarEstudioComponent>);
  private readonly alerta = inject(AlertService);
  readonly datos = inject<DialogoExportarEstudioDatos>(MAT_DIALOG_DATA);

  exportar(formato: "pdf" | "xlsx"): void {
    const etiqueta = formato === "pdf" ? "PDF oficial" : "XLSX / CSV";
    void this.alerta.showSuccessAlert(
      `Se generó el archivo ${etiqueta} del estudio ${this.datos.estudio.id}. Operación simulada hasta conectar el gestor documental.`,
      "Exportación simulada",
    );
    this.dialogRef.close();
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
