import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { detalleProveedorResolver } from "./pages/detalle-solicitud/detalle-proveedor.resolver";

const routes: Routes = [
  {
    path: "",
    component: BandejaSolicitudesComponent,
    title: "ÁGORA · Solicitudes de cotización",
  },
  {
    path: ":id/observaciones",
    component: PantallaProveedorPlaceholderComponent,
    title: "ÁGORA · Observaciones de la solicitud",
    data: { titulo: "Observaciones", pantalla: "P-03" },
  },
  {
    path: ":id/responder",
    component: PantallaProveedorPlaceholderComponent,
    title: "ÁGORA · Responder solicitud",
    data: { titulo: "Responder solicitud", pantalla: "P-04" },
  },
  {
    path: ":id",
    component: DetalleSolicitudProveedorComponent,
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Detalle de solicitud",
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProveedorRoutingModule {}
