import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-boton-tratamiento-informacion",
  templateUrl: "./boton-tratamiento-informacion.component.html",
  styleUrl: "./boton-tratamiento-informacion.component.scss",
  standalone: false,
})
export class BotonTratamientoInformacionComponent {
  @Input() consentimientoAceptado = false;
  @Output() solicitarConsentimiento = new EventEmitter<void>();
}
