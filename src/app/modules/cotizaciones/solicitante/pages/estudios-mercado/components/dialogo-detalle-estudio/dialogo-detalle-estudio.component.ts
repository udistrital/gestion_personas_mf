import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { EventoLineaTiempo } from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import {
  ETIQUETAS_FUENTE_INFORMACION,
  ETIQUETAS_METODO_PRECIO,
  EstudioMercado,
  InvitacionEstudio,
  USUARIO_ESTUDIO_MOCK,
  estadoEstudioMercado,
  formatoFechaHoraEstudio,
  invitadosDe,
  respondieronDe,
} from "../../../../../models/estudio-mercado.model";
import { PROVEEDORES_MOCK } from "../../../../../models/proveedores.model";
import { formatoCop } from "../../../../../models/necesidad.model";

/** Datos del detalle rápido de un estudio. */
export interface DialogoDetalleEstudioDatos {
  readonly estudio: EstudioMercado;
}

/** Detalle rápido del estudio con invitaciones y trazabilidad. */
@Component({
  selector: "app-dialogo-detalle-estudio",
  templateUrl: "./dialogo-detalle-estudio.component.html",
  styleUrls: ["./dialogo-detalle-estudio.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoDetalleEstudioComponent {
  private readonly dialogRef = inject(
    MatDialogRef<DialogoDetalleEstudioComponent, "invitar" | undefined>,
  );
  readonly datos = inject<DialogoDetalleEstudioDatos>(MAT_DIALOG_DATA);
  readonly estudio = this.datos.estudio;

  readonly moneda = formatoCop;
  readonly formatoFecha = formatoFechaHoraEstudio;
  readonly invitadosDe = invitadosDe;
  readonly respondieronDe = respondieronDe;

  get estado(): ReturnType<typeof estadoEstudioMercado> {
    return estadoEstudioMercado(this.estudio);
  }

  get metodo(): string {
    return ETIQUETAS_METODO_PRECIO[this.estudio.metodoPrecio];
  }

  get fuente(): string {
    return ETIQUETAS_FUENTE_INFORMACION[this.estudio.fuenteInformacion];
  }

  get puedeInvitar(): boolean {
    return this.estado === "borrador" || this.estado === "en-recepcion";
  }

  get eventosLineaTiempo(): readonly EventoLineaTiempo[] {
    return this.estudio.eventos.map((evento) => ({
      id: evento.id,
      titulo: this.tituloEvento(evento.tipo),
      icono: this.iconoEvento(evento.tipo),
      tono: this.tonoEvento(evento.tipo),
      fecha: formatoFechaHoraEstudio(evento.fecha),
      fechaIso: evento.fecha,
      detalle: evento.detalle,
      sello: evento.radicado,
      autor: {
        usuario: evento.usuario,
        nombre: evento.nombreUsuario,
        rol: USUARIO_ESTUDIO_MOCK.rol,
      },
    }));
  }

  nombreProveedor(invitacion: InvitacionEstudio): string {
    return (
      PROVEEDORES_MOCK.find(
        (proveedor) => proveedor.id === invitacion.proveedorId,
      )?.nombre ?? invitacion.proveedorId
    );
  }

  nitProveedor(invitacion: InvitacionEstudio): string {
    return (
      PROVEEDORES_MOCK.find(
        (candidato) => candidato.id === invitacion.proveedorId,
      )?.nit ?? "—"
    );
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  invitar(): void {
    this.dialogRef.close("invitar");
  }

  private tituloEvento(tipo: string): string {
    switch (tipo) {
      case "creado":
        return "Estudio creado";
      case "borrador":
        return "Borrador actualizado";
      case "invitaciones":
        return "Invitaciones enviadas";
      case "invitacion-adicional":
        return "Invitaciones adicionales";
      case "descartado":
        return "Borrador descartado";
      default:
        return "Evento del estudio";
    }
  }

  private iconoEvento(tipo: string): string {
    switch (tipo) {
      case "creado":
        return "add_circle";
      case "borrador":
        return "edit_note";
      case "invitaciones":
      case "invitacion-adicional":
        return "forward_to_inbox";
      case "descartado":
        return "delete";
      default:
        return "history";
    }
  }

  private tonoEvento(tipo: string): "primario" | "destacado" | "neutro" | "exito" | "error" {
    switch (tipo) {
      case "invitaciones":
      case "invitacion-adicional":
        return "exito";
      case "descartado":
        return "error";
      case "creado":
        return "destacado";
      default:
        return "primario";
    }
  }
}
