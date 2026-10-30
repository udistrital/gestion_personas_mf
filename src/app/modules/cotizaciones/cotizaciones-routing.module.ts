import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import {
  entradaCotizacionesGuard,
  rolGuard,
} from "src/app/core/_guards/rol.guard";
import {
  ROL_PROVEEDOR,
  ROLES_SOLICITANTE,
} from "src/app/core/constants/roles.const";
import { EntradaCotizacionesComponent } from "./pages/entrada-cotizaciones/entrada-cotizaciones.component";

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
  {
    path: "bandeja-solicitudes",
    canMatch: [rolGuard],
    data: { roles: [ROL_PROVEEDOR] },
    loadChildren: () =>
      import("./proveedor/proveedor.module").then(
        (m) => m.ProveedorModule,
      ),
  },
  {
    path: "",
    pathMatch: "full",
    canActivate: [entradaCotizacionesGuard],
    component: EntradaCotizacionesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CotizacionesRoutingModule {}
