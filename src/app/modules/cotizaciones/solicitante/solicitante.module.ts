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
import { PasoContratacionComponent } from "./pages/asistente-solicitud/paso-4-contratacion/paso-contratacion.component";
import { PasoProveedoresComponent } from "./pages/asistente-solicitud/paso-5-proveedores/paso-proveedores.component";
import { TarjetaProveedorComponent } from "./pages/asistente-solicitud/paso-5-proveedores/components/tarjeta-proveedor/tarjeta-proveedor.component";
import { PasoDocumentosComponent } from "./pages/asistente-solicitud/paso-6-documentos/paso-documentos.component";
import { FilaAnexoComponent } from "./pages/asistente-solicitud/paso-6-documentos/components/fila-anexo/fila-anexo.component";
import { PasoRevisionComponent } from "./pages/asistente-solicitud/paso-7-revision/paso-revision.component";
import { AcordeonPasoComponent } from "./pages/asistente-solicitud/paso-7-revision/components/acordeon-paso/acordeon-paso.component";
import { ListaVerificacionComponent } from "./pages/asistente-solicitud/paso-7-revision/components/lista-verificacion/lista-verificacion.component";
import { DialogoProcesarComponent } from "./pages/asistente-solicitud/paso-7-revision/components/dialogo-procesar/dialogo-procesar.component";
import { paginadorEnEspanol } from "./mat-paginator-intl-es";

@NgModule({
  declarations: [
    ListadoSolicitudesComponent,
    AsistenteSolicitudComponent,
    DialogoAcuerdoComponent,
    PasoNecesidadComponent,
    PasoDatosGeneralesComponent,
    PasoItemsComponent,
    PasoContratacionComponent,
    PasoProveedoresComponent,
    TarjetaProveedorComponent,
    PasoDocumentosComponent,
    FilaAnexoComponent,
    PasoRevisionComponent,
    AcordeonPasoComponent,
    ListaVerificacionComponent,
    DialogoProcesarComponent,
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
