import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { AsistenteSolicitudComponent } from "./pages/asistente-solicitud/asistente-solicitud.component";
import { EditarSolicitudComponent } from "./pages/editar-solicitud/editar-solicitud.component";
import { ForoObservacionesPageComponent } from "./pages/foro-observaciones/foro-observaciones-page.component";

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
