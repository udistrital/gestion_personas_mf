import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { SharedModule } from "src/app/shared/shared.module";
import {
  SicapitalService,
  SicapitalServiceMock,
} from "../services/sicapital.service";
import { SolicitanteRoutingModule } from "./solicitante-routing.module";
import { SolicitanteComponentsModule } from "./solicitante-components.module";
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
import { DialogoConfirmarModificacionComponent } from "./pages/asistente-solicitud/paso-7-revision/components/dialogo-confirmar-modificacion/dialogo-confirmar-modificacion.component";
import { ResumenDiferenciasModule } from "../components/resumen-diferencias/resumen-diferencias.module";
import { DialogoDescartarModule } from "../components/dialogo-descartar/dialogo-descartar.module";
import { EditarSolicitudComponent } from "./pages/editar-solicitud/editar-solicitud.component";
import { paginadorEnEspanol } from "./mat-paginator-intl-es";
import { ForoObservacionesModule } from "../components/foro-observaciones/foro-observaciones.module";
import { ForoObservacionesPageComponent } from "./pages/foro-observaciones/foro-observaciones-page.component";
import { TableroOferentesComponent } from "./pages/tablero-oferentes/tablero-oferentes.component";
import { ComparadorCotizacionesComponent } from "./pages/comparador-cotizaciones/comparador-cotizaciones.component";
import { DetalleProveedorOfertaComponent } from "./pages/detalle-proveedor-oferta/detalle-proveedor-oferta.component";
import { DecisionCotizacionComponent } from "./pages/decision-cotizacion/decision-cotizacion.component";
import { ConfigurarSubsanacionComponent } from "./pages/subsanacion/configurar-subsanacion/configurar-subsanacion.component";
import { HistorialSubsanacionComponent } from "./pages/subsanacion/historial-subsanacion/historial-subsanacion.component";
import { DetallePresentacionModule } from "./pages/detalle-solicitud/components/detalle-presentacion.module";
import { PantallaPorDefinirComponent } from "./pages/pantalla-por-definir/pantalla-por-definir.component";
import {
  OferentesService,
  OferentesServiceMock,
} from "../services/oferentes.service";
import {
  EvaluacionService,
  EvaluacionServiceMock,
} from "../services/evaluacion.service";
import {
  SubsanacionService,
  SubsanacionServiceMock,
} from "../services/subsanacion.service";

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
    DialogoConfirmarModificacionComponent,
    EditarSolicitudComponent,
    ForoObservacionesPageComponent,
    TableroOferentesComponent,
    ComparadorCotizacionesComponent,
    DetalleProveedorOfertaComponent,
    DecisionCotizacionComponent,
    ConfigurarSubsanacionComponent,
    HistorialSubsanacionComponent,
    PantallaPorDefinirComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    SolicitanteComponentsModule,
    DetallePresentacionModule,
    SolicitanteRoutingModule,
    ForoObservacionesModule,
    DialogoDescartarModule,
    ResumenDiferenciasModule,
  ],
  providers: [
    // Único punto de enlace de SICAPITAL (cruce del paso 1 del asistente).
    { provide: SicapitalService, useClass: SicapitalServiceMock },
    // Único punto de enlace del tablero de oferentes (S-07).
    { provide: OferentesService, useClass: OferentesServiceMock },
    // Único punto de enlace del trámite de decisión (S-11).
    { provide: EvaluacionService, useClass: EvaluacionServiceMock },
    // Único punto de enlace de la subsanación documental (S-12).
    { provide: SubsanacionService, useClass: SubsanacionServiceMock },
    { provide: MatPaginatorIntl, useFactory: paginadorEnEspanol },
  ],
})
export class SolicitanteModule {}
