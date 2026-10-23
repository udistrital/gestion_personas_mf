import { Component, Input } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ModalidadRegistro, ModalidadRegistroId, OPCIONES_MODALIDAD_REGISTRO } from "../registro-inicio.utilidades";

@Component({
  selector: "app-opciones-registro",
  templateUrl: "./opciones-registro.component.html",
  styleUrl: "./opciones-registro.component.scss",
  standalone: false,
})
export class OpcionesRegistroComponent {
  @Input() opciones: ModalidadRegistro[] = OPCIONES_MODALIDAD_REGISTRO;
  @Input() formulario!: FormGroup;
  @Input() modalidadSeleccionada: ModalidadRegistroId | null = null;
  @Input() deshabilitado = false;

  constructor() {}
}
