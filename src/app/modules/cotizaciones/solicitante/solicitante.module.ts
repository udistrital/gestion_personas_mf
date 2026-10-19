import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { SharedModule } from "src/app/shared/shared.module";
import { SolicitudesServiceMock, SolicitudesService } from "../services/solicitudes.service";
import { SolicitanteRoutingModule } from "./solicitante-routing.module";
import { ListadoSolicitudesComponent } from "./pages/listado-solicitudes/listado-solicitudes.component";
import { paginadorEnEspanol } from "./mat-paginator-intl-es";

@NgModule({
  declarations: [
    ListadoSolicitudesComponent
  ],
  imports: [CommonModule, SharedModule, SolicitanteRoutingModule],
  providers: [
    // ÚNICO punto de enlace de la capa de datos simulada.
    // Cambiar `useClass` por `SolicitudesServiceHttp` cuando exista el backend.
    { provide: SolicitudesService, useClass: SolicitudesServiceMock },
    { provide: MatPaginatorIntl, useFactory: paginadorEnEspanol },
  ],
})
export class SolicitanteModule {}
