import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoCancelarSolicitudComponent } from "./components/dialogo-cancelar-solicitud/dialogo-cancelar-solicitud.component";
import { DialogoConfirmarDecisionComponent } from "./components/dialogo-confirmar-decision/dialogo-confirmar-decision.component";
import { DialogoSubsanacionComponent } from "./components/dialogo-subsanacion/dialogo-subsanacion.component";
import { TarjetaIdentidadProveedorComponent } from "../components/tarjeta-identidad-proveedor/tarjeta-identidad-proveedor.component";

/** Componentes presentacionales compartidos entre S-01, S-03, S-10, S-11 y S-12. */
@NgModule({
  declarations: [
    DialogoCancelarSolicitudComponent,
    DialogoConfirmarDecisionComponent,
    DialogoSubsanacionComponent,
    TarjetaIdentidadProveedorComponent,
  ],
  imports: [SharedModule],
  exports: [
    DialogoCancelarSolicitudComponent,
    DialogoConfirmarDecisionComponent,
    DialogoSubsanacionComponent,
    TarjetaIdentidadProveedorComponent,
  ],
})
export class SolicitanteComponentsModule {}
