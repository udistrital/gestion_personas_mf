import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
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
export class FormularioNuevaObservacionComponent implements OnChanges {
  @Input() enviando = false;
  @Input() error = "";
  @Input() limpiarFormulario = 0;
  @Input() mostrarCancelar = false;
  @Input() textoEnviar = "Enviar observación";

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

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios["enviando"]) {
      if (this.enviando) {
        this.formulario.controls.contenido.disable({ emitEvent: false });
      } else {
        this.formulario.controls.contenido.enable({ emitEvent: false });
      }
    }
    if (
      cambios["limpiarFormulario"] &&
      !cambios["limpiarFormulario"].firstChange
    ) {
      this.formulario.reset({ contenido: "" });
    }
  }

  cancelar(): void {
    if (!this.enviando) {
      this.formulario.reset({ contenido: "" });
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
