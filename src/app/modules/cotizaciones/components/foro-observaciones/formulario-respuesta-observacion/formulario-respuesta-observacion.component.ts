import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  contenidoForoMaximo,
  contenidoForoMinimo,
  MAX_CARACTERES_RESPUESTA_FORO,
  MIN_CARACTERES_FORO,
} from "src/app/shared/validators/contenido-foro.validator";

@Component({
  selector: "app-formulario-respuesta-observacion",
  templateUrl: "./formulario-respuesta-observacion.component.html",
  styleUrls: ["./formulario-respuesta-observacion.component.scss"],
  standalone: false,
})
export class FormularioRespuestaObservacionComponent implements OnChanges {
  @Input() inicial = "";
  @Input() editar = false;
  @Input() enviando = false;
  @Input() error = "";

  @Output() enviar = new EventEmitter<string>();
  @Output() cancelar = new EventEmitter<void>();

  readonly minimo = MIN_CARACTERES_FORO;
  readonly maximo = MAX_CARACTERES_RESPUESTA_FORO;
  readonly formulario = new FormGroup({
    contenido: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        contenidoForoMinimo(MIN_CARACTERES_FORO),
        contenidoForoMaximo(MAX_CARACTERES_RESPUESTA_FORO),
      ],
    }),
  });

  ngOnChanges(): void {
    if (this.inicial !== this.formulario.controls.contenido.value) {
      this.formulario.controls.contenido.setValue(this.inicial);
      this.formulario.markAsPristine();
    }
  }

  confirmar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando) {
      return;
    }
    this.enviar.emit(this.formulario.controls.contenido.value);
  }
}
