import { NgModule } from "@angular/core";
import { CotizacionesRoutingModule } from "./cotizaciones-routing.module";
import {
  ObservacionesService,
  ObservacionesServiceMock,
} from "./services/observaciones.service";
import {
  SolicitudesService,
  SolicitudesServiceMock,
} from "./services/solicitudes.service";
import { EntradaCotizacionesComponent } from "./pages/entrada-cotizaciones/entrada-cotizaciones.component";
import {
  RespuestaProveedorService,
  RespuestaProveedorServiceMock,
} from "./services/respuesta-proveedor.service";

/**
 * Módulo raíz del dominio de cotizaciones. Las áreas (solicitante,
 * proveedor, ordenador) se cargan de forma perezosa desde su routing.
 */
@NgModule({
  declarations: [EntradaCotizacionesComponent],
  imports: [CotizacionesRoutingModule],
  providers: [
    { provide: SolicitudesService, useClass: SolicitudesServiceMock },
    { provide: ObservacionesService, useClass: ObservacionesServiceMock },
    {
      provide: RespuestaProveedorService,
      useClass: RespuestaProveedorServiceMock,
    },
  ],
})
export class CotizacionesModule {}
