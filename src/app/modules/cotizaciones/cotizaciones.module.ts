import { NgModule } from "@angular/core";
import { CotizacionesRoutingModule } from "./cotizaciones-routing.module";

/**
 * Módulo raíz del dominio de cotizaciones. Las áreas (solicitante,
 * proveedor, ordenador) se cargan de forma perezosa desde su routing.
 */
@NgModule({
  imports: [CotizacionesRoutingModule],
})
export class CotizacionesModule {}
