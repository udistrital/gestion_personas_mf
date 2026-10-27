import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "src/app/shared/shared.module";
import { DetalleSolicitudComponent } from "./detalle-solicitud.component";
import { DetalleSolicitudRoutingModule } from "./detalle-solicitud-routing.module";
import { PestanaContratacionPagoComponent } from "./pestanas/contratacion-pago/pestana-contratacion-pago.component";
import { PestanaDocumentosComponent } from "./pestanas/documentos/pestana-documentos.component";
import { PestanaGeneralComponent } from "./pestanas/general/pestana-general.component";
import { PestanaHistorialComponent } from "./pestanas/historial/pestana-historial.component";
import { PestanaItemsComponent } from "./pestanas/items/pestana-items.component";
import { PestanaPresupuestoComponent } from "./pestanas/presupuesto/pestana-presupuesto.component";
import { PestanaProveedoresObjetivoComponent } from "./pestanas/proveedores-objetivo/pestana-proveedores-objetivo.component";
import { DialogoGuardadoComponent } from "./components/dialogo-guardado/dialogo-guardado.component";
import { SolicitanteComponentsModule } from "../../solicitante-components.module";
import { DetallePresentacionModule } from "./components/detalle-presentacion.module";

/**
 * Módulo del detalle de una solicitud (S-03).
 *
 * Agrupa el armazón (`DetalleSolicitudComponent`) y las pestañas. Los
 * componentes de presentación compartidos con P-02 se exportan desde
 * `DetallePresentacionModule`. Se carga de forma perezosa desde el módulo del
 * solicitante (`:id` → `loadChildren`).
 *
 * Los componentes compartidos del detalle viven en Cotizaciones, no en
 * `shared/`, porque son propios de este dominio.
 */
@NgModule({
  declarations: [
    DetalleSolicitudComponent,
    PestanaGeneralComponent,
    PestanaPresupuestoComponent,
    PestanaItemsComponent,
    PestanaContratacionPagoComponent,
    PestanaProveedoresObjetivoComponent,
    PestanaDocumentosComponent,
    PestanaHistorialComponent,
    DialogoGuardadoComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DetallePresentacionModule,
    SolicitanteComponentsModule,
    DetalleSolicitudRoutingModule,
  ],
})
export class DetalleSolicitudModule {}
