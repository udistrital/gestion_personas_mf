import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";

const routes: Routes = [
  {
    path: "",
    component: ListadoSolicitudesComponent,
    title: "Ágora · Mis solicitudes",
  },
  // Destinos provisionales (NO implementados aún):
  // 'nueva' → S-02 Asistente; ':id' → S-03 Detalle.
  {
    path: "nueva",
    component: ListadoSolicitudesComponent,
    data: { titulo: "Nueva solicitud de cotización", pantalla: "S-02" },
  },
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
