import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { SharedModule } from "src/app/shared/shared.module";
import { SolicitudesServiceMock, SolicitudesService } from "../services/solicitudes.service";
import { SicapitalService, SicapitalServiceMock } from "../services/sicapital.service";
import { SolicitanteRoutingModule } from "./solicitante-routing.module";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { AsistenteSolicitudComponent } from "./pages/asistente-solicitud/asistente-solicitud.component";
import { DialogoAcuerdoComponent } from "./pages/asistente-solicitud/paso-1-necesidad/components/dialogo-acuerdo/dialogo-acuerdo.component";
import { PasoNecesidadComponent } from "./pages/asistente-solicitud/paso-1-necesidad/paso-necesidad.component";
import { PasoDatosGeneralesComponent } from "./pages/asistente-solicitud/paso-2-datos-generales/paso-datos-generales.component";
import { PasoItemsComponent } from "./pages/asistente-solicitud/paso-3-items/paso-items.component";
import { PasoPendienteComponent } from "./pages/asistente-solicitud/paso-pendiente/paso-pendiente.component";
import { paginadorEnEspanol } from "./mat-paginator-intl-es";

@NgModule({
  declarations: [
    ListadoSolicitudesComponent,
    AsistenteSolicitudComponent,
    DialogoAcuerdoComponent,
    PasoNecesidadComponent,
    PasoDatosGeneralesComponent,
    PasoItemsComponent,
    PasoPendienteComponent,
  ],
  imports: [CommonModule, SharedModule, SolicitanteRoutingModule],
  providers: [
    // ÚNICO punto de enlace de la capa de datos simulada.
    // Cambiar `useClass` por `SolicitudesServiceHttp` cuando exista el backend.
    { provide: SolicitudesService, useClass: SolicitudesServiceMock },
    // Único punto de enlace de SICAPITAL (cruce del paso 1 del asistente).
    { provide: SicapitalService, useClass: SicapitalServiceMock },
    { provide: MatPaginatorIntl, useFactory: paginadorEnEspanol },
  ],
})
export class SolicitanteModule {}
