import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoCancelarSolicitudComponent } from "./components/dialogo-cancelar-solicitud/dialogo-cancelar-solicitud.component";
import { TarjetaIdentidadProveedorComponent } from "../components/tarjeta-identidad-proveedor/tarjeta-identidad-proveedor.component";

/** Componentes presentacionales compartidos entre S-01, S-03 y S-10. */
@NgModule({
  declarations: [
    DialogoCancelarSolicitudComponent,
    TarjetaIdentidadProveedorComponent,
  ],
  imports: [SharedModule],
  exports: [
    DialogoCancelarSolicitudComponent,
    TarjetaIdentidadProveedorComponent,
  ],
})
export class SolicitanteComponentsModule {}
