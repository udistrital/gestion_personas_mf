import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { MatPaginatorModule } from "@angular/material/paginator";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { ProveedorRoutingModule } from "./proveedor-routing.module";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";
import { ForoObservacionesModule } from "../components/foro-observaciones/foro-observaciones.module";
import { ObservacionesProveedorComponent } from "./pages/observaciones/observaciones-proveedor.component";
import { ResponderSolicitudComponent } from "./pages/responder-solicitud/responder-solicitud.component";
import { DialogoDescartarModule } from "../components/dialogo-descartar/dialogo-descartar.module";
import { DialogoExcedePresupuestoModule } from "../components/dialogo-excede-presupuesto/dialogo-excede-presupuesto.module";
import { DialogoConfirmarEnvioModule } from "../components/dialogo-confirmar-envio/dialogo-confirmar-envio.module";
import { DialogoEnvioExitosoModule } from "../components/dialogo-envio-exitoso/dialogo-envio-exitoso.module";

@NgModule({
  declarations: [
    BandejaSolicitudesComponent,
    PantallaProveedorPlaceholderComponent,
    DetalleSolicitudProveedorComponent,
    ObservacionesProveedorComponent,
    ResponderSolicitudComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    MatPaginatorModule,
    DetallePresentacionModule,
    ForoObservacionesModule,
    DialogoDescartarModule,
    DialogoExcedePresupuestoModule,
    DialogoConfirmarEnvioModule,
    DialogoEnvioExitosoModule,
    ProveedorRoutingModule,
  ],
})
export class ProveedorModule {}
