import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { DocumentoOfertaRadicado } from "../../../../../models/documentos.model";

/** Documentos radicados de la respuesta, con su clasificación y formato. */
@Component({
  selector: "app-documentos-ofertados",
  templateUrl: "./documentos-ofertados.component.html",
  styleUrls: ["./documentos-ofertados.component.scss"],
  standalone: false,
})
export class DocumentosOfertadosComponent {
  @Input({ required: true }) documentos: readonly DocumentoOfertaRadicado[] = [];
  @Input() totalRadicados = 0;
  @Input() descargando: string | null = null;
  @Input() errorDescarga = "";

  @Output() ver = new EventEmitter<DocumentoOfertaRadicado>();
  @Output() descargar = new EventEmitter<DocumentoOfertaRadicado>();
  @Output() cerrarError = new EventEmitter<void>();

  get principal(): DocumentoOfertaRadicado | null {
    return this.documentos.find((documento) => documento.principal) ?? null;
  }

  get adicionales(): readonly DocumentoOfertaRadicado[] {
    return this.documentos.filter((documento) => !documento.principal);
  }

  get total(): number {
    return this.documentos.length;
  }

  puedeAccionar(documento: DocumentoOfertaRadicado): boolean {
    return documento.estado !== "pendiente" && documento.formatoValido;
  }

  etiquetaEstado(documento: DocumentoOfertaRadicado): string {
    return documento.estado === "pendiente" ? "No radicado" : "Radicado";
  }
}
