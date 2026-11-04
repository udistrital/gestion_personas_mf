import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  Observacion,
  RespuestaObservacionEntrada,
} from "../../../models/observacion.model";

@Component({
  selector: "app-lista-observaciones",
  templateUrl: "./lista-observaciones.component.html",
  styleUrls: ["./lista-observaciones.component.scss"],
  standalone: false,
})
export class ListaObservacionesComponent {
  @Input() observaciones: readonly Observacion[] = [];
  @Input() modo: "solicitante" | "proveedor" = "solicitante";
  @Input() puedeResponder = false;
  @Input() puedeEditarRespuesta = false;
  @Input() enviandoId: string | null = null;
  @Input() errorId: string | null = null;
  @Input() errorEnvio = "";
  @Input() enfocarId: string | null = null;
  @Input() hayFiltros = false;

  @Output() respuestaEnviada = new EventEmitter<RespuestaObservacionEntrada>();
}
