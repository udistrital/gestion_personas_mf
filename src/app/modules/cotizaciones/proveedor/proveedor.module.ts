import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { ProveedorRoutingModule } from "./proveedor-routing.module";

@NgModule({
  declarations: [
    BandejaSolicitudesComponent,
    PantallaProveedorPlaceholderComponent,
  ],
  imports: [CommonModule, SharedModule, ProveedorRoutingModule],
})
export class ProveedorModule {}
