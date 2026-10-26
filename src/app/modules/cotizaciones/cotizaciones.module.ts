import { NgModule } from "@angular/core";
import { CotizacionesRoutingModule } from "./cotizaciones-routing.module";
import {
  ObservacionesService,
  ObservacionesServiceMock,
} from "./services/observaciones.service";

/**
 * Módulo raíz del dominio de cotizaciones. Las áreas (solicitante,
 * proveedor, ordenador) se cargan de forma perezosa desde su routing.
 */
@NgModule({
  imports: [CotizacionesRoutingModule],
  providers: [
    { provide: ObservacionesService, useClass: ObservacionesServiceMock },
  ],
})
export class CotizacionesModule {}
