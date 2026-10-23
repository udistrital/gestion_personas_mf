import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'registro-persona-juridica-estado-catalogos',
  templateUrl: './registro-persona-juridica-estado-catalogos.component.html',
  styleUrls: ['./registro-persona-juridica-estado-catalogos.component.scss'],
  standalone: false,
})
export class RegistroPersonaJuridicaEstadoCatalogosComponent {
  @Input() cargando = false;
  @Input() error: string | null = null;
  @Input() sinRegistros = false;
  @Output() reintentar = new EventEmitter<void>();
}
