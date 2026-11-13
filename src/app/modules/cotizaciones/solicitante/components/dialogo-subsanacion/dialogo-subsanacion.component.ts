import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {
  justificacionMinima,
  MIN_CARACTERES_JUSTIFICACION,
} from "src/app/shared/validators/justificacion.validator";
import { formatoFechaHoraOferente } from "../../../models/oferente.model";
import type { SolicitudDetalle } from "../../../models/solicitud.model";
import {
  estadoSubsanacion,
  type RegistroSubsanacion,
  type Subsanacion,
} from "../../../models/subsanacion.model";
import { SubsanacionService } from "../../../services/subsanacion.service";

export type ModoDialogoSubsanacion = "configurar" | "cancelar" | "ampliar";

export interface DialogoSubsanacionDatos {
  readonly modo: ModoDialogoSubsanacion;
  readonly solicitud: SolicitudDetalle;
  /** Datos del formulario cuando el modo es `configurar`. */
  readonly registro?: RegistroSubsanacion;
  /** Resumen visible de la configuración. */
  readonly resumen?: {
    readonly oferentes: number;
    readonly documentos: number;
    readonly inicio: string;
    readonly fin: string;
    readonly notificar: boolean;
  };
}

type EstadoDialogo = "listo" | "enviando" | "exito" | "error";
type TipoAmpliacion = "24" | "48" | "personalizada";

/**
 * Diálogo de actuación del periodo de subsanación (S-12).
 *
 * Reúne la confirmación de apertura, la cancelación con motivo y la ampliación
 * con horas fijas o fecha personalizada. Sigue el patrón de S-05: el diálogo
 * ejecuta la operación, muestra el éxito con el radicado y devuelve el periodo
 * actualizado al cerrar.
 */
@Component({
  selector: "app-dialogo-subsanacion",
  templateUrl: "./dialogo-subsanacion.component.html",
  styleUrls: ["./dialogo-subsanacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoSubsanacionComponent {
  private readonly servicio = inject(SubsanacionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<DialogoSubsanacionComponent, Subsanacion | undefined>,
  );
  readonly datos = inject<DialogoSubsanacionDatos>(MAT_DIALOG_DATA);

  readonly vista = signal<EstadoDialogo>("listo");
  readonly error = signal("");
  readonly resultado = signal<Subsanacion | null>(null);
  readonly minimo = MIN_CARACTERES_JUSTIFICACION;

  readonly formulario = new FormGroup({
    motivo: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        justificacionMinima(MIN_CARACTERES_JUSTIFICACION),
      ],
    }),
    tipoAmpliacion: new FormControl<TipoAmpliacion>("24", {
      nonNullable: true,
    }),
    nuevaFecha: new FormControl("", { nonNullable: true }),
    nuevaHora: new FormControl("12:00", { nonNullable: true }),
    aceptado: new FormControl(false, { nonNullable: true }),
  });

  get esConfigurar(): boolean {
    return this.datos.modo === "configurar";
  }

  get esCancelar(): boolean {
    return this.datos.modo === "cancelar";
  }

  get esAmpliar(): boolean {
    return this.datos.modo === "ampliar";
  }

  get titulo(): string {
    if (this.vista() === "exito") {
      if (this.esConfigurar) {
        return "Periodo de subsanación habilitado";
      }
      return this.esCancelar
        ? "Periodo de subsanación cancelado"
        : "Plazo de subsanación ampliado";
    }
    if (this.esConfigurar) {
      return "¿Desea habilitar el periodo de subsanación?";
    }
    return this.esCancelar
      ? "Cancelar periodo de subsanación"
      : "Ampliar plazo de subsanación";
  }

  get subtitulo(): string {
    if (this.esConfigurar) {
      return "Se notificará a los oferentes seleccionados y se abrirá la ventana oficial de recepción.";
    }
    if (this.esCancelar) {
      return "Esta acción revocará la ventana de cargue para todos los oferentes de forma inmediata.";
    }
    return "El nuevo cierre debe ser posterior al actual y queda registrado en la auditoría.";
  }

  get icono(): string {
    if (this.vista() === "exito") {
      return this.esCancelar ? "cancel" : "verified";
    }
    return this.esConfigurar ? "send" : this.esCancelar ? "warning" : "update";
  }

  get puedeConfirmar(): boolean {
    if (this.vista() !== "listo") {
      return false;
    }
    if (this.esConfigurar) {
      return true;
    }
    if (this.esCancelar) {
      return (
        this.formulario.valid &&
        this.formulario.controls.aceptado.value
      );
    }
    if (
      this.formulario.controls.tipoAmpliacion.value === "personalizada" &&
      (!this.formulario.controls.nuevaFecha.value ||
        !this.formulario.controls.nuevaHora.value)
    ) {
      return false;
    }
    return this.formulario.valid;
  }

  get mostrarFechaPersonalizada(): boolean {
    return (
      this.esAmpliar &&
      this.formulario.controls.tipoAmpliacion.value === "personalizada"
    );
  }

  get etiquetaConfirmar(): string {
    if (this.esConfigurar) {
      return "Confirmar y habilitar";
    }
    return this.esCancelar
      ? "Confirmar cancelación"
      : "Confirmar ampliación";
  }

  get motivoVisible(): string {
    return this.formulario.controls.motivo.value.trim();
  }

  formatear(iso: string): string {
    return formatoFechaHoraOferente(iso);
  }

  estadoPeriodo(periodo: Subsanacion) {
    return estadoSubsanacion(periodo);
  }

  get resumenPeriodo(): {
    inicio: string;
    fin: string;
    oferentes: number;
    documentos: number;
    notificar: boolean;
  } | null {
    if (!this.datos.resumen) {
      return null;
    }
    return this.datos.resumen;
  }

  get periodoResultado(): Subsanacion | null {
    return this.resultado();
  }

  confirmar(): void {
    if (this.vista() === "enviando") {
      return;
    }
    this.formulario.markAllAsTouched();
    if (!this.puedeConfirmar) {
      return;
    }

    this.error.set("");
    this.vista.set("enviando");

    if (this.esConfigurar) {
      if (!this.datos.registro) {
        this.error.set("No hay datos para configurar el periodo.");
        this.vista.set("error");
        return;
      }
      this.servicio
        .configurar(this.datos.solicitud, this.datos.registro)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (periodo) => this.exito(periodo),
          error: (fallo: Error) => this.fallo(fallo),
        });
      return;
    }

    if (this.esCancelar) {
      this.servicio
        .cancelar(this.datos.solicitud, this.motivoVisible)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (periodo) => this.exito(periodo),
          error: (fallo: Error) => this.fallo(fallo),
        });
      return;
    }

    const tipo = this.formulario.controls.tipoAmpliacion.value;
    const horas = tipo === "24" ? 24 : tipo === "48" ? 48 : null;
    const nuevaFecha =
      tipo === "personalizada"
        ? `${this.formulario.controls.nuevaFecha.value}T${
            this.formulario.controls.nuevaHora.value || "00:00"
          }:00-05:00`
        : null;

    this.servicio
      .ampliar(this.datos.solicitud, horas, nuevaFecha, this.motivoVisible)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (periodo) => this.exito(periodo),
        error: (fallo: Error) => this.fallo(fallo),
      });
  }

  reintentar(): void {
    this.vista.set("listo");
    this.error.set("");
    this.confirmar();
  }

  cerrar(): void {
    if (this.vista() === "enviando") {
      return;
    }
    this.dialogRef.close(this.resultado() ?? undefined);
  }

  private exito(periodo: Subsanacion): void {
    this.resultado.set(periodo);
    this.vista.set("exito");
  }

  private fallo(fallo: Error): void {
    this.error.set(
      fallo.message ||
        "No fue posible completar la operación. Intente nuevamente.",
    );
    this.vista.set("error");
  }
}
