import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
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
import {
  EstudioMercado,
  ProveedorEstudio,
  RegistroInvitacionEstudio,
  asuntoInvitacionEstudio,
  formatoFechaHoraEstudio,
} from "../../../../../models/estudio-mercado.model";
import { EstudiosMercadoService } from "../../../../../services/estudios-mercado.service";

/** Datos del modal de invitación a proveedores. */
export interface DialogoInvitacionEstudioDatos {
  readonly estudio: EstudioMercado;
  readonly proveedores: readonly ProveedorEstudio[];
  readonly asunto: string;
  readonly mensaje: string;
  readonly fechaLimite: string | null;
}

type EstadoInvitacion =
  | "formulario"
  | "confirmacion"
  | "enviando"
  | "exito"
  | "error";

/**
 * Modal de invitación del mockup S-13b.
 *
 * Reúne el mensaje formal, el plazo, los adjuntos y la notificación, muestra
 * una confirmación con el número de destinatarios y bloquea el doble envío.
 * El error conserva lo diligenciado para reintentar.
 */
@Component({
  selector: "app-dialogo-invitacion-estudio",
  templateUrl: "./dialogo-invitacion-estudio.component.html",
  styleUrls: ["./dialogo-invitacion-estudio.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoInvitacionEstudioComponent implements OnInit {
  private readonly servicio = inject(EstudiosMercadoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<DialogoInvitacionEstudioComponent, EstudioMercado>,
  );
  readonly datos = inject<DialogoInvitacionEstudioDatos>(MAT_DIALOG_DATA);

  readonly estado = signal<EstadoInvitacion>("formulario");
  readonly error = signal("");
  readonly resultado = signal<EstudioMercado | null>(null);
  readonly minimo = MIN_CARACTERES_JUSTIFICACION;
  readonly minFecha = new Date();

  readonly formulario = new FormGroup({
    mensaje: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        justificacionMinima(MIN_CARACTERES_JUSTIFICACION),
      ],
    }),
    fechaLimiteFecha: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fechaLimiteHora: new FormControl("17:00", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    adjuntos: new FormControl<File[]>([], { nonNullable: true }),
    notificar: new FormControl(true, { nonNullable: true }),
  });

  readonly asunto = computed(
    () =>
      this.datos.asunto ||
      asuntoInvitacionEstudio(this.datos.estudio.id, this.datos.estudio.objeto),
  );

  readonly cantidad = computed(() => this.datos.proveedores.length);

  get fechaLimiteIso(): string {
    const fecha = this.formulario.controls.fechaLimiteFecha.value;
    const hora = this.formulario.controls.fechaLimiteHora.value;
    if (!fecha || !hora) {
      return "";
    }
    return `${fecha}T${hora}:00-05:00`;
  }

  get fechaLimiteTexto(): string {
    return formatoFechaHoraEstudio(this.fechaLimiteIso);
  }

  get caracteresMensaje(): number {
    return this.formulario.controls.mensaje.value.trim().length;
  }

  ngOnInit(): void {
    const limite = this.datos.fechaLimite
      ? new Date(this.datos.fechaLimite)
      : this.fechaLimitePorDefecto();
    const fecha = Number.isNaN(limite.getTime())
      ? this.fechaLimitePorDefecto()
      : limite;

    this.formulario.patchValue({
      mensaje:
        this.datos.mensaje ||
        this.mensajePorDefecto(this.datos.estudio, fecha.toISOString()),
      fechaLimiteFecha: this.aFechaIso(fecha),
      fechaLimiteHora: this.aHora(fecha),
    });
  }

  continuar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      return;
    }
    if (this.cantidad() === 0) {
      this.error.set("Seleccione al menos un proveedor para invitar.");
      return;
    }
    this.error.set("");
    this.estado.set("confirmacion");
  }

  volver(): void {
    if (this.estado() === "enviando") {
      return;
    }
    this.error.set("");
    this.estado.set("formulario");
  }

  enviar(): void {
    if (this.estado() === "enviando") {
      return;
    }
    this.error.set("");
    this.estado.set("enviando");
    this.dialogRef.disableClose = true;

    const registro: RegistroInvitacionEstudio = {
      proveedoresIds: this.datos.proveedores.map(
        (proveedor) => proveedor.proveedor.id,
      ),
      asunto: this.asunto(),
      mensaje: this.formulario.controls.mensaje.value,
      fechaLimite: this.fechaLimiteIso,
      notificar: this.formulario.controls.notificar.value,
      adjuntos: this.formulario.controls.adjuntos.value,
    };

    this.servicio
      .enviarInvitaciones(this.datos.estudio.id, registro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estudio) => {
          this.dialogRef.disableClose = false;
          this.resultado.set(estudio);
          this.estado.set("exito");
        },
        error: (error: Error) => {
          this.dialogRef.disableClose = false;
          this.error.set(
            error.message ||
              "No fue posible enviar las invitaciones. Intente nuevamente.",
          );
          this.estado.set("error");
        },
      });
  }

  cerrar(): void {
    this.dialogRef.close(this.resultado() ?? undefined);
  }

  private fechaLimitePorDefecto(): Date {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 10);
    fecha.setHours(17, 0, 0, 0);
    return fecha;
  }

  private aFechaIso(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  }

  private aHora(fecha: Date): string {
    return `${String(fecha.getHours()).padStart(2, "0")}:${String(
      fecha.getMinutes(),
    ).padStart(2, "0")}`;
  }

  private mensajePorDefecto(estudio: EstudioMercado, fechaLimite: string): string {
    return (
      `Estimado proveedor: la Universidad Distrital Francisco José de Caldas le ` +
      `invita cordialmente a remitir su propuesta económica y ficha técnica ` +
      `para el Estudio de Mercado ${estudio.id}, correspondiente a ` +
      `${estudio.objeto}. La fecha límite de recepción es el ` +
      `${formatoFechaHoraEstudio(fechaLimite)}.`
    );
  }
}
