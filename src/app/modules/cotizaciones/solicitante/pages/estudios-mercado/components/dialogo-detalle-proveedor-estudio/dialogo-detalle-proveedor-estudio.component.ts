import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {
  ETIQUETAS_ESTADO_INSCRIPCION,
  ProveedorEstudio,
} from "../../../../../models/estudio-mercado.model";
import { ACTIVIDADES_CIIU } from "../../../../../models/proveedores.model";

/** Datos del detalle de un proveedor del estudio. */
export interface DialogoDetalleProveedorEstudioDatos {
  readonly proveedor: ProveedorEstudio;
  /** false cuando el estudio ya no admite nuevas invitaciones. */
  readonly permiteInvitar?: boolean;
}

/** Ficha lateral del proveedor (mockup S-13b). */
@Component({
  selector: "app-dialogo-detalle-proveedor-estudio",
  templateUrl: "./dialogo-detalle-proveedor-estudio.component.html",
  styleUrls: ["./dialogo-detalle-proveedor-estudio.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoDetalleProveedorEstudioComponent {
  private readonly dialogRef = inject(
    MatDialogRef<DialogoDetalleProveedorEstudioComponent, "invitar" | undefined>,
  );
  readonly datos = inject<DialogoDetalleProveedorEstudioDatos>(MAT_DIALOG_DATA);
  readonly proveedor = this.datos.proveedor;
  readonly estadoInscripcion =
    ETIQUETAS_ESTADO_INSCRIPCION[this.proveedor.estadoInscripcion];

  get actividades(): readonly {
    codigo: string;
    descripcion: string;
  }[] {
    return this.proveedor.coincidencias.map((codigo) => ({
      codigo,
      descripcion:
        ACTIVIDADES_CIIU.find((actividad) => actividad.codigo === codigo)
          ?.descripcion ?? codigo,
    }));
  }

  get puedeInvitar(): boolean {
    return (
      this.datos.permiteInvitar !== false &&
      this.proveedor.estadoInvitacion === "sin-invitar"
    );
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  invitar(): void {
    this.dialogRef.close("invitar");
  }
}
