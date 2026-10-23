import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {
  AccionConsentimiento,
  ContenidoConsentimiento,
  CONTENIDO_CONSENTIMIENTO,
  VistaConsentimiento,
} from "./consentimiento.utilidades";

export interface DatosConsentimientoDialog {
  vista: VistaConsentimiento;
}

interface SegmentoRender {
  texto: string;
  url?: string;
}

interface ParrafoRender {
  segmentos: SegmentoRender[];
}

@Component({
  selector: "app-consentimiento-dialog",
  templateUrl: "./consentimiento-dialog.component.html",
  styleUrls: ["./consentimiento-dialog.component.scss"],
  standalone: false,
})
export class ConsentimientoDialogComponent {
  readonly contenido: ContenidoConsentimiento;
  readonly parrafos: ParrafoRender[];

  constructor(
    private readonly dialogRef: MatDialogRef<
      ConsentimientoDialogComponent,
      AccionConsentimiento
    >,
    @Inject(MAT_DIALOG_DATA) datos: DatosConsentimientoDialog
  ) {
    this.contenido = CONTENIDO_CONSENTIMIENTO[datos.vista];
    this.parrafos = this.contenido.parrafos.map((parrafo) => ({
      segmentos: parrafo.segmentos.map((segmento) =>
        typeof segmento === "string"
          ? { texto: segmento }
          : { texto: segmento.texto, url: segmento.url }
      ),
    }));
  }

  accion(accion: AccionConsentimiento): void {
    this.dialogRef.close(accion);
  }
}
