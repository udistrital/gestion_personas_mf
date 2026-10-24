import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "src/app/shared/shared.module";
import { DetalleSolicitudComponent } from "./detalle-solicitud.component";
import { DetalleSolicitudRoutingModule } from "./detalle-solicitud-routing.module";
import { TarjetaSeccionComponent } from "./components/tarjeta-seccion/tarjeta-seccion.component";
import { ParEtiquetaValorComponent } from "./components/par-etiqueta-valor/par-etiqueta-valor.component";
import { EncabezadoPestanaComponent } from "./components/encabezado-pestana/encabezado-pestana.component";
import { PestanaContratacionPagoComponent } from "./pestanas/contratacion-pago/pestana-contratacion-pago.component";
import { PestanaDocumentosComponent } from "./pestanas/documentos/pestana-documentos.component";
import { PestanaGeneralComponent } from "./pestanas/general/pestana-general.component";
import { PestanaHistorialComponent } from "./pestanas/historial/pestana-historial.component";
import { PestanaItemsComponent } from "./pestanas/items/pestana-items.component";
import { PestanaPresupuestoComponent } from "./pestanas/presupuesto/pestana-presupuesto.component";
import { PestanaProveedoresObjetivoComponent } from "./pestanas/proveedores-objetivo/pestana-proveedores-objetivo.component";

/**
 * Módulo del detalle de una solicitud (S-03).
 *
 * Agrupa el armazón (`DetalleSolicitudComponent`), los componentes compartidos
 * del detalle y las pestañas. Se carga de forma perezosa desde el módulo del
 * solicitante (`:id` → `loadChildren`).
 *
 * Los componentes compartidos viven aquí, no en `shared/`, porque son propios
 * del dominio de cotizaciones; si otra área los necesitara se promoverían.
 */
@NgModule({
  declarations: [
    DetalleSolicitudComponent,
    TarjetaSeccionComponent,
    ParEtiquetaValorComponent,
    EncabezadoPestanaComponent,
    PestanaGeneralComponent,
    PestanaPresupuestoComponent,
    PestanaItemsComponent,
    PestanaContratacionPagoComponent,
    PestanaProveedoresObjetivoComponent,
    PestanaDocumentosComponent,
    PestanaHistorialComponent,
  ],
  imports: [CommonModule, SharedModule, DetalleSolicitudRoutingModule],
})
export class DetalleSolicitudModule {}
