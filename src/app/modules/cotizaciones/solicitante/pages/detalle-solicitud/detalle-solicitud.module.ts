import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "src/app/shared/shared.module";
import { DetalleSolicitudComponent } from "./detalle-solicitud.component";
import { DetalleSolicitudRoutingModule } from "./detalle-solicitud-routing.module";
import { TarjetaSeccionComponent } from "./components/tarjeta-seccion/tarjeta-seccion.component";
import { ParEtiquetaValorComponent } from "./components/par-etiqueta-valor/par-etiqueta-valor.component";
import { EncabezadoPestanaComponent } from "./components/encabezado-pestana/encabezado-pestana.component";
import { PestanaGeneralComponent } from "./pestanas/general/pestana-general.component";
import { PestanaPresupuestoComponent } from "./pestanas/presupuesto/pestana-presupuesto.component";
import { PestanaPlaceholderComponent } from "./pestanas/pestana-placeholder/pestana-placeholder.component";

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
    PestanaPlaceholderComponent,
  ],
  imports: [CommonModule, SharedModule, DetalleSolicitudRoutingModule],
})
export class DetalleSolicitudModule {}
