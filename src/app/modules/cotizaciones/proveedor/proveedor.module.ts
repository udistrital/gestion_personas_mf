import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { MatPaginatorModule } from "@angular/material/paginator";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaSolicitudesComponent } from "./pages/bandeja-solicitudes/bandeja-solicitudes.component";
import { PantallaProveedorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-proveedor-placeholder.component";
import { ProveedorRoutingModule } from "./proveedor-routing.module";
import { DetalleSolicitudProveedorComponent } from "./pages/detalle-solicitud/detalle-solicitud-proveedor.component";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";
import { ForoObservacionesModule } from "../components/foro-observaciones/foro-observaciones.module";
import { ObservacionesProveedorComponent } from "./pages/observaciones/observaciones-proveedor.component";
import { ResponderSolicitudComponent } from "./pages/responder-solicitud/responder-solicitud.component";
import { DialogoDescartarModule } from "../components/dialogo-descartar/dialogo-descartar.module";
import { DialogoExcedePresupuestoModule } from "../components/dialogo-excede-presupuesto/dialogo-excede-presupuesto.module";
import { DialogoConfirmarEnvioModule } from "../components/dialogo-confirmar-envio/dialogo-confirmar-envio.module";
import { DialogoEnvioExitosoModule } from "../components/dialogo-envio-exitoso/dialogo-envio-exitoso.module";
import { AvisoAdendaComponent } from "../components/aviso-adenda/aviso-adenda.component";
import { ResumenDiferenciasModule } from "../components/resumen-diferencias/resumen-diferencias.module";
import { ExitoActualizacionComponent } from "./pages/actualizar-respuesta/exito-actualizacion/exito-actualizacion.component";
import { MiCotizacionProveedorComponent } from "./pages/mi-cotizacion/mi-cotizacion-proveedor.component";
import { ResumenMiCotizacionComponent } from "./pages/mi-cotizacion/components/resumen-respuesta/resumen-respuesta.component";
import { TablaItemsOfertadosComponent } from "./pages/mi-cotizacion/components/tabla-items-ofertados/tabla-items-ofertados.component";
import { ValoresOfertaComponent } from "./pages/mi-cotizacion/components/valores-oferta/valores-oferta.component";
import { DocumentosOfertadosComponent } from "./pages/mi-cotizacion/components/documentos-ofertados/documentos-ofertados.component";
import { EstadoVacioMiCotizacionComponent } from "./pages/mi-cotizacion/components/estado-vacio/estado-vacio.component";

@NgModule({
  declarations: [
    BandejaSolicitudesComponent,
    PantallaProveedorPlaceholderComponent,
    DetalleSolicitudProveedorComponent,
    ObservacionesProveedorComponent,
    ResponderSolicitudComponent,
    AvisoAdendaComponent,
    ExitoActualizacionComponent,
    MiCotizacionProveedorComponent,
    ResumenMiCotizacionComponent,
    TablaItemsOfertadosComponent,
    ValoresOfertaComponent,
    DocumentosOfertadosComponent,
    EstadoVacioMiCotizacionComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    MatPaginatorModule,
    DetallePresentacionModule,
    ForoObservacionesModule,
    DialogoDescartarModule,
    DialogoExcedePresupuestoModule,
    DialogoConfirmarEnvioModule,
    DialogoEnvioExitosoModule,
    ResumenDiferenciasModule,
    ProveedorRoutingModule,
  ],
})
export class ProveedorModule {}
