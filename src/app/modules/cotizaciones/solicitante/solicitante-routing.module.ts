import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { AsistenteSolicitudComponent } from "./pages/asistente-solicitud/asistente-solicitud.component";

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
  // Detalle de la solicitud (S-03) — módulo perezoso.
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
