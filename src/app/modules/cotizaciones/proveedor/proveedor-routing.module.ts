import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { detalleProveedorResolver } from "./pages/detalle-solicitud/detalle-proveedor.resolver";
import { ObservacionesProveedorComponent } from "./pages/observaciones/observaciones-proveedor.component";
import { ResponderSolicitudComponent } from "./pages/responder-solicitud/responder-solicitud.component";
import { MiCotizacionProveedorComponent } from "./pages/mi-cotizacion/mi-cotizacion-proveedor.component";
import { ResultadoProveedorComponent } from "./pages/resultado/resultado-proveedor.component";

const routes: Routes = [
  {
    path: "",
    component: BandejaSolicitudesComponent,
    title: "ÁGORA · Solicitudes de cotización",
  },
  {
    path: ":id/observaciones",
    component: ObservacionesProveedorComponent,
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Observaciones de la solicitud",
  },
  {
    path: ":id/responder",
    component: ResponderSolicitudComponent,
    data: { modo: "responder" },
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Responder solicitud",
  },
  {
    path: ":id/actualizar",
    component: ResponderSolicitudComponent,
    data: { modo: "actualizar" },
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Modificar respuesta",
  },
  {
    path: ":id/mi-cotizacion",
    component: MiCotizacionProveedorComponent,
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Mi cotización",
  },
  {
    path: ":id/resultado",
    component: ResultadoProveedorComponent,
    resolve: { detalleProveedor: detalleProveedorResolver },
    title: "ÁGORA · Respuesta del solicitante",
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
