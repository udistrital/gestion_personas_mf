import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import {
  Observacion,
  RespuestaObservacionEntrada,
} from "../../../models/observacion.model";

@Component({
  selector: "app-tarjeta-observacion",
  templateUrl: "./tarjeta-observacion.component.html",
  styleUrls: ["./tarjeta-observacion.component.scss"],
  standalone: false,
})
export class TarjetaObservacionComponent implements OnChanges {
  @Input({ required: true }) observacion!: Observacion;
  @Input() modo: "solicitante" | "proveedor" = "solicitante";
  @Input() puedeResponder = false;
  @Input() puedeEditarRespuesta = false;
  @Input() enviando = false;
  @Input() error = "";
  @Input() enfocar = false;

  @Output() respuestaEnviada = new EventEmitter<RespuestaObservacionEntrada>();

  @ViewChild("tarjeta") private tarjeta?: ElementRef<HTMLElement>;

  formularioVisible = false;
  editar = false;

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios["enfocar"]?.currentValue) {
      this.formularioVisible = false;
      setTimeout(() => this.tarjeta?.nativeElement.focus());
    }
  }

  abrirFormulario(editar: boolean): void {
    this.editar = editar;
    this.formularioVisible = true;
  }

  cerrarFormulario(): void {
    if (!this.enviando) {
      this.formularioVisible = false;
    }
  }

  enviarRespuesta(contenidoHtml: string): void {
    this.respuestaEnviada.emit({
      observacionId: this.observacion.id,
      contenidoHtml,
      editar: this.editar,
    });
  }
}
