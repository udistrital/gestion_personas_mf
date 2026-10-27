import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { APP_BASE_HREF } from "@angular/common";
import { AuthGuard } from "./core/_guards/auth.guard";

const routes: Routes = [
  {
    path: "proveedores",
    canActivate: [AuthGuard],
    loadChildren: () =>
      import("./modules/proveedores/proveedores-module").then(
        (m) => m.ProveedoresModule
      ),
  },
  {
    path: "cotizaciones",
    canActivate: [AuthGuard],
    loadChildren: () =>
      import("./modules/cotizaciones/cotizaciones.module").then(
        (m) => m.CotizacionesModule
      ),
  },
  {
    path: "",
    redirectTo: "proveedores",
    pathMatch: "full",
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [{ provide: APP_BASE_HREF, useValue: "/gestion-proveedor" }],
})
export class AppRoutingModule {}
