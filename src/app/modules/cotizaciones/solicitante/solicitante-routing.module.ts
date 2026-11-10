import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { AsistenteSolicitudComponent } from "./pages/asistente-solicitud/asistente-solicitud.component";
import { EditarSolicitudComponent } from "./pages/editar-solicitud/editar-solicitud.component";
import { ForoObservacionesPageComponent } from "./pages/foro-observaciones/foro-observaciones-page.component";
import { TableroOferentesComponent } from "./pages/tablero-oferentes/tablero-oferentes.component";
import { ComparadorCotizacionesComponent } from "./pages/comparador-cotizaciones/comparador-cotizaciones.component";
import { DetalleProveedorOfertaComponent } from "./pages/detalle-proveedor-oferta/detalle-proveedor-oferta.component";
import { DecisionCotizacionComponent } from "./pages/decision-cotizacion/decision-cotizacion.component";
import { ConfigurarSubsanacionComponent } from "./pages/subsanacion/configurar-subsanacion/configurar-subsanacion.component";
import { HistorialSubsanacionComponent } from "./pages/subsanacion/historial-subsanacion/historial-subsanacion.component";
import { solicitudResolver } from "../resolvers/solicitud.resolver";

/**
 * Rutas del área solicitante.
 *
 * Las dos entradas de edición (S-04) van antes de `:id` para que el detalle no
 * capture el segmento de la acción. Ambas montan el mismo armazón: el modo
 * (completo o restringido) lo decide el estado real de la solicitud, no la URL.
 */
const routes: Routes = [
  {
    path: "",
    component: ListadoSolicitudesComponent,
    title: "ÁGORA · Mis solicitudes",
  },
  {
    path: "nueva",
    component: AsistenteSolicitudComponent,
    title: "ÁGORA · Nueva solicitud de cotización",
    data: { titulo: "Nueva solicitud de cotización", pantalla: "S-02" },
  },
  {
    path: ":id/editar",
    component: EditarSolicitudComponent,
    title: "ÁGORA · Modificar solicitud",
    data: { titulo: "Modificar solicitud", pantalla: "S-04" },
  },
  {
    path: ":id/solicitar-modificacion",
    component: EditarSolicitudComponent,
    title: "ÁGORA · Solicitar modificación",
    data: { titulo: "Solicitar modificación", pantalla: "S-04" },
  },
  {
    path: ":id/observaciones",
    component: ForoObservacionesPageComponent,
    title: "ÁGORA · Foro de observaciones",
    data: { titulo: "Foro de observaciones", pantalla: "S-06" },
  },
  {
    path: ":id/oferentes",
    component: TableroOferentesComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Tablero de oferentes",
  },
  {
    path: ":id/evaluacion/proveedores/:proveedorId",
    component: DetalleProveedorOfertaComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Detalle del proveedor y su oferta",
  },
  {
    path: ":id/evaluacion/decision",
    component: DecisionCotizacionComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Decisión y justificación",
  },
  {
    path: ":id/evaluacion",
    component: ComparadorCotizacionesComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Comparador de cotizaciones",
  },
  {
    path: ":id/subsanacion/historial",
    component: HistorialSubsanacionComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Historial de subsanación",
  },
  {
    path: ":id/subsanacion",
    component: ConfigurarSubsanacionComponent,
    resolve: { solicitud: solicitudResolver },
    title: "ÁGORA · Subsanación documental",
  },
  {
    path: ":id",
    loadChildren: () =>
      import("./pages/detalle-solicitud/detalle-solicitud.module").then(
        (m) => m.DetalleSolicitudModule,
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SolicitanteRoutingModule {}
