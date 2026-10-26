import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import {
  contenidoForoMinimo,
  MIN_CARACTERES_FORO,
} from "src/app/shared/validators/contenido-foro.validator";

@Component({
  selector: "app-formulario-nueva-observacion",
  templateUrl: "./formulario-nueva-observacion.component.html",
  styleUrls: ["./formulario-nueva-observacion.component.scss"],
  standalone: false,
})
export class FormularioNuevaObservacionComponent {
  @Input() enviando = false;
  @Input() error = "";

  @Output() enviar = new EventEmitter<string>();

  readonly minimo = MIN_CARACTERES_FORO;
  readonly formulario = new FormGroup({
    contenido: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        contenidoForoMinimo(MIN_CARACTERES_FORO),
      ],
    }),
  });

  confirmar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando) {
      return;
    }
    this.enviar.emit(this.formulario.controls.contenido.value);
  }
}
