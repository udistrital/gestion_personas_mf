import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { AsistenteSolicitudComponent } from "./pages/asistente-solicitud/asistente-solicitud.component";

const routes: Routes = [
  {
    path: "",
    component: ListadoSolicitudesComponent,
    title: "Ágora · Mis solicitudes",
  },
  {
    path: "nueva",
    component: AsistenteSolicitudComponent,
    title: "Ágora · Nueva solicitud de cotización",
    data: { titulo: "Nueva solicitud de cotización", pantalla: "S-02" },
  },
  // Destino provisional (NO implementado aún):
  // ':id' → S-03 Detalle.
  {
    path: ":id",
    component: ListadoSolicitudesComponent,
    data: { titulo: "Detalle de solicitud", pantalla: "S-03" },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SolicitanteRoutingModule {}
