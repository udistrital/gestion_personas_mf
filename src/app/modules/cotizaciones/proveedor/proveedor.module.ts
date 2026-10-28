import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { ProveedorRoutingModule } from "./proveedor-routing.module";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";
import { ForoObservacionesModule } from "../components/foro-observaciones/foro-observaciones.module";
import { ObservacionesProveedorComponent } from "./pages/observaciones/observaciones-proveedor.component";

@NgModule({
  declarations: [
    BandejaSolicitudesComponent,
    PantallaProveedorPlaceholderComponent,
    DetalleSolicitudProveedorComponent,
    ObservacionesProveedorComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DetallePresentacionModule,
    ForoObservacionesModule,
    ProveedorRoutingModule,
  ],
})
export class ProveedorModule {}
