import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

const routes: Routes = [
  {
    path: "solicitudes",
    loadChildren: () =>
      import("./solicitante/solicitante.module").then(
        (m) => m.SolicitanteModule,
      ),
  },
  { path: "", pathMatch: "full", redirectTo: "solicitudes" },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CotizacionesRoutingModule {}
