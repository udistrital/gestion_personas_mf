import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "src/app/shared/shared.module";
import { EstudiosMercadoRoutingModule } from "./estudios-mercado-routing.module";
import { ListadoEstudiosComponent } from "./listado-estudios/listado-estudios.component";
import { CrearEstudioComponent } from "./crear-estudio/crear-estudio.component";
import { SelectorActividadesEstudioComponent } from "./components/selector-actividades/selector-actividades.component";
import { TablaProveedoresEstudioComponent } from "./components/tabla-proveedores-estudio/tabla-proveedores-estudio.component";
import { DialogoEstudioEconomicoComponent } from "./components/dialogo-estudio-economico/dialogo-estudio-economico.component";
import { DialogoInvitacionEstudioComponent } from "./components/dialogo-invitacion-estudio/dialogo-invitacion-estudio.component";
import { DialogoDetalleEstudioComponent } from "./components/dialogo-detalle-estudio/dialogo-detalle-estudio.component";
import { DialogoExportarEstudioComponent } from "./components/dialogo-exportar-estudio/dialogo-exportar-estudio.component";
import { DialogoDescartarEstudioComponent } from "./components/dialogo-descartar-estudio/dialogo-descartar-estudio.component";
import { DialogoDetalleProveedorEstudioComponent } from "./components/dialogo-detalle-proveedor-estudio/dialogo-detalle-proveedor-estudio.component";
import {
  EstudiosMercadoService,
  EstudiosMercadoServiceMock,
} from "../../../services/estudios-mercado.service";

/**
 * Módulo lazy de estudios de mercado (S-13).
 *
 * Se carga desde `cotizaciones/estudios-mercado` y mantiene su propio
 * proveedor de datos: el servicio abstracto es el único punto de enlace con
 * el backend futuro.
 */
@NgModule({
  declarations: [
    ListadoEstudiosComponent,
    CrearEstudioComponent,
    SelectorActividadesEstudioComponent,
    TablaProveedoresEstudioComponent,
    DialogoEstudioEconomicoComponent,
    DialogoInvitacionEstudioComponent,
    DialogoDetalleEstudioComponent,
    DialogoExportarEstudioComponent,
    DialogoDescartarEstudioComponent,
    DialogoDetalleProveedorEstudioComponent,
  ],
  imports: [CommonModule, SharedModule, EstudiosMercadoRoutingModule],
  providers: [
    // Único punto de enlace de S-13.
    { provide: EstudiosMercadoService, useClass: EstudiosMercadoServiceMock },
  ],
})
export class EstudiosMercadoModule {}
