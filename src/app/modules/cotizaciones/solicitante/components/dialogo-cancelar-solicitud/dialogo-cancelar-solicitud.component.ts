import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import {
  justificacionMinima,
  MIN_CARACTERES_JUSTIFICACION,
} from "src/app/shared/validators/justificacion.validator";
import { SolicitudDetalle } from "../../../models/solicitud.model";
import { SolicitudesService } from "../../../services/solicitudes.service";

export type OrigenDialogoCancelacion = "listado" | "detalle";
type EstadoDialogo = "cargando" | "listo" | "bloqueada" | "error" | "exito";

export interface DialogoCancelarSolicitudDatos {
  readonly solicitudId: string;
  readonly origen: OrigenDialogoCancelacion;
}

/** Confirmación y constancia simulada de cancelación (S-05). */
@Component({
  selector: "app-dialogo-cancelar-solicitud",
  templateUrl: "./dialogo-cancelar-solicitud.component.html",
  styleUrls: ["./dialogo-cancelar-solicitud.component.scss"],
  standalone: false,
})
export class DialogoCancelarSolicitudComponent implements OnInit {
  private readonly servicio = inject(SolicitudesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<DialogoCancelarSolicitudComponent, SolicitudDetalle>,
  );
  readonly datos = inject<DialogoCancelarSolicitudDatos>(MAT_DIALOG_DATA);

  readonly vista = signal<EstadoDialogo>("cargando");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly enviando = signal(false);
  readonly error = signal("");
  readonly aceptado = signal(false);
  readonly minimoJustificacion = MIN_CARACTERES_JUSTIFICACION;

  readonly formulario = new FormGroup({
    justificacion: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        justificacionMinima(MIN_CARACTERES_JUSTIFICACION),
      ],
    }),
  });

  ngOnInit(): void {
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => {
        if (evento.key === "Escape" && this.vista() === "exito") {
          evento.preventDefault();
          evento.stopPropagation();
          this.volver();
        }
      });
    this.cargarSolicitud();
  }

  get puedeConfirmar(): boolean {
    return (
      this.vista() === "listo" &&
      !this.enviando() &&
      this.formulario.valid &&
      this.aceptado()
    );
  }

  get origenEnviado(): boolean {
    const estado = this.solicitud()?.estado;
    return (
      estado === "enviada-proveedores" ||
      estado === "enviada-con-modificaciones"
    );
  }

  get tituloAccionVolver(): string {
    return this.datos.origen === "listado"
      ? "Volver al listado de solicitudes"
      : "Volver al detalle de la solicitud";
  }

  cargarSolicitud(): void {
    this.vista.set("cargando");
    this.error.set("");

    this.servicio
      .obtenerPorId(this.datos.solicitudId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitud) => {
          this.solicitud.set(solicitud);
          if (!solicitud) {
            this.vista.set("error");
            this.error.set("La solicitud no existe o ya no está disponible.");
            return;
          }
          this.vista.set(
            this.permisos.puede("cancelar", solicitud) ? "listo" : "bloqueada",
          );
        },
        error: (error: Error) => {
          this.error.set(
            error.message ||
              "No fue posible cargar la solicitud. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  alCambiarAceptacion(evento: Event): void {
    this.aceptado.set((evento.target as HTMLInputElement).checked);
  }

  alSalirJustificacion(): void {
    this.formulario.controls.justificacion.markAsTouched();
  }

  confirmar(): void {
    if (this.enviando() || this.vista() !== "listo") {
      return;
    }
    this.formulario.markAllAsTouched();
    if (!this.formulario.valid || !this.aceptado()) {
      return;
    }

    this.error.set("");
    this.enviando.set(true);
    this.dialogRef.disableClose = true;
    this.servicio
      .cancelarSolicitud(
        this.datos.solicitudId,
        this.formulario.controls.justificacion.value,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitud) => {
          this.solicitud.set(solicitud);
          this.enviando.set(false);
          this.dialogRef.disableClose = true;
          this.vista.set("exito");
        },
        error: (error: Error) => {
          this.error.set(
            error.message ||
              "No fue posible cancelar la solicitud. Intente nuevamente.",
          );
          this.enviando.set(false);
          this.dialogRef.disableClose = false;
        },
      });
  }

  volver(): void {
    if (this.enviando()) {
      return;
    }
    const solicitud = this.solicitud();
    this.dialogRef.close(
      solicitud?.estado === "cancelada" ? solicitud : undefined,
    );
  }
}
