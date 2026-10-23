import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'barra-acciones-formulario',
  templateUrl: './barra-acciones.component.html',
  styleUrls: ['./barra-acciones.component.scss'],
  standalone: false,
})
export class BarraAccionesComponent {
  @Input() mostrarRegreso = false;
  @Input() esUltimoPaso = false;
  @Input() estadoMensaje =
    "[mock] Borrador societario autoguardado con éxito";
  @Input() estadoDetalle =
    "Hoy a las 11:45 AM · Sesión cifrada SSL 256-bit Universidad Distrital";
  @Output() regreso = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<void>();
  @Output() continuar = new EventEmitter<void>();
  @Output() finalizar = new EventEmitter<void>();
}
