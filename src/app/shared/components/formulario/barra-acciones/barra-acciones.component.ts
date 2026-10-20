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
  /** Etiqueta del botón de regreso. */
  @Input() tituloRegresar = 'Regresar';
  /** Etiqueta del botón de avance. */
  @Input() tituloContinuar = 'Continuar';
  /**
   * Etiqueta del botón del último paso. Por defecto "Finalizar"; el paso 7 la
   * cambia por "Procesar solicitud".
   */
  @Input() tituloFinal = 'Finalizar';
  /**
   * Texto secundario del botón del último paso (p. ej. "Enviar a 12
   * proveedores"). Si está vacío el botón se muestra en una sola línea.
   */
  @Input() subtituloFinal = '';
  /** Icono del botón del último paso; el paso 7 usa el de envío. */
  @Input() iconoFinal = 'check_circle';
  /**
   * Bloquea el avance (también lo deshabilita visualmente) cuando el paso
   * todavía no cumple sus validaciones. Se muestra como `title` del botón.
   */
  @Input() deshabilitarContinuar = false;
  @Input() ayudaContinuar?: string;
  @Output() regreso = new EventEmitter<void>();
  @Output() guardar = new EventEmitter<void>();
  @Output() continuar = new EventEmitter<void>();
  @Output() finalizar = new EventEmitter<void>();
}
