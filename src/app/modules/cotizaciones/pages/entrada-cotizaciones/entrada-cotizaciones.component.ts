import { Component } from "@angular/core";

@Component({
  selector: "app-entrada-cotizaciones",
  template: '<p class="entrada" role="status">Abriendo el área de Cotizaciones…</p>',
  styles: [
    ".entrada { padding: 1rem 1.5rem; color: var(--agora-text-muted); }",
  ],
  standalone: false,
})
export class EntradaCotizacionesComponent {}
