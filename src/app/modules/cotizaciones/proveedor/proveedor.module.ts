import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { ProveedorRoutingModule } from "./proveedor-routing.module";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";

@NgModule({
  declarations: [
    BandejaSolicitudesComponent,
    PantallaProveedorPlaceholderComponent,
    DetalleSolicitudProveedorComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DetallePresentacionModule,
    ProveedorRoutingModule,
  ],
})
export class ProveedorModule {}
