import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { EstudioMercado } from "../../../../../models/estudio-mercado.model";
import { EstudiosMercadoService } from "../../../../../services/estudios-mercado.service";

/** Datos del modal de descarte de un borrador. */
export interface DialogoDescartarEstudioDatos {
  readonly estudio: EstudioMercado;
}

/** Confirmación de descarte del borrador (mockup S-13a). */
@Component({
  selector: "app-dialogo-descartar-estudio",
  templateUrl: "./dialogo-descartar-estudio.component.html",
  styleUrls: ["./dialogo-descartar-estudio.component.scss"],
  standalone: false,
})
export class DialogoDescartarEstudioComponent {
  private readonly servicio = inject(EstudiosMercadoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<DialogoDescartarEstudioComponent, boolean>,
  );
  readonly datos = inject<DialogoDescartarEstudioDatos>(MAT_DIALOG_DATA);

  readonly descartando = signal(false);
  readonly error = signal("");

  descartar(): void {
    if (this.descartando()) {
      return;
    }
    this.descartando.set(true);
    this.dialogRef.disableClose = true;
    this.error.set("");
    this.servicio
      .descartar(this.datos.estudio.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.disableClose = false;
          this.descartando.set(false);
          this.dialogRef.close(true);
        },
        error: (error: Error) => {
          this.dialogRef.disableClose = false;
          this.descartando.set(false);
          this.error.set(
            error.message ||
              "No fue posible descartar el borrador. Intente nuevamente.",
          );
        },
      });
  }

  cerrar(): void {
    if (!this.descartando()) {
      this.dialogRef.close(false);
    }
  }
}
