import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ROLES_SOLICITANTE } from "src/app/core/constants/roles.const";
import { rolGuard } from "src/app/core/_guards/rol.guard";

const routes: Routes = [
  {
    path: "solicitudes",
    canMatch: [rolGuard],
    data: { roles: ROLES_SOLICITANTE },
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
