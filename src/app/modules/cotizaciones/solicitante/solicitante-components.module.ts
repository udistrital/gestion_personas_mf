import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoCancelarSolicitudComponent } from "./components/dialogo-cancelar-solicitud/dialogo-cancelar-solicitud.component";

/** Componentes presentacionales compartidos entre S-01 y el detalle S-03. */
@NgModule({
  declarations: [DialogoCancelarSolicitudComponent],
  imports: [SharedModule],
  exports: [DialogoCancelarSolicitudComponent],
})
export class SolicitanteComponentsModule {}
