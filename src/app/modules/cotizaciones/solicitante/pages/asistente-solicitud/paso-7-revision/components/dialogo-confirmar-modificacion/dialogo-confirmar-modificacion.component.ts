import { Component, Inject, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { ResumenDiferencias } from "../../../../../../models/edicion-solicitud.model";

/** Datos que el paso 7 entrega al diálogo de confirmación (S-04). */
export interface DialogoConfirmarModificacionDatos {
  /** Número visible de la solicitud que se modifica. */
  readonly solicitudId: string;
  /** Versión vigente del expediente ("v1.0"). */
  readonly versionActual: string;
  /** Cambios que se enviarán a aprobación (calculados por el asistente). */
  readonly diferencias: ResumenDiferencias;
  /** Justificación del cambio, ya convertida a texto plano. */
  readonly justificacion: string;
}

/**
 * Diálogo "¿Solicitar la modificación?" de la edición restringida (S-04).
 *
 * Antes de enviar la propuesta a la Oficina de Contratación muestra el resumen
 * de los cambios y la justificación registrada, y exige que el solicitante
 * reconozca que la solicitud queda pendiente de aprobación. Al confirmar
 * devuelve `true`; al seguir editando devuelve `false` y el formulario conserva
 * todo lo diligenciado.
 *
 * El foco inicial entra a "Seguir editando" (acción segura) y `Escape` cancela;
 * el botón de confirmación permanece deshabilitado hasta marcar el
 * reconocimiento, de modo que la confirmación sea explícita.
 */
@Component({
  selector: "dialogo-confirmar-modificacion",
  templateUrl: "./dialogo-confirmar-modificacion.component.html",
  styleUrls: ["./dialogo-confirmar-modificacion.component.scss"],
  standalone: false,
})
export class DialogoConfirmarModificacionComponent {
  /** true cuando el solicitante reconoce que la propuesta queda en aprobación. */
  readonly aceptado = signal(false);

  constructor(
    private readonly dialogRef: MatDialogRef<DialogoConfirmarModificacionComponent>,
    @Inject(MAT_DIALOG_DATA)
    readonly datos: DialogoConfirmarModificacionDatos,
  ) {}

  /** Etiqueta del total de cambios ("1 campo modificado"). */
  get totalTexto(): string {
    const total = this.datos.diferencias.total;
    return `${total} ${total === 1 ? "campo modificado" : "campos modificados"}`;
  }

  /** Refleja el estado del reconocimiento obligatorio. */
  alCambiarAceptacion(evento: Event): void {
    this.aceptado.set((evento.target as HTMLInputElement).checked);
  }

  /** Cierra sin solicitar nada; el formulario queda intacto. */
  cancelar(): void {
    this.dialogRef.close(false);
  }

  /** Confirma el envío de la propuesta a aprobación. */
  confirmar(): void {
    if (!this.aceptado()) {
      return;
    }
    this.dialogRef.close(true);
  }
}
