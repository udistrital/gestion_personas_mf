import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SharedModule } from "src/app/shared/shared.module";
import { ForoObservacionesComponent } from "./foro-observaciones.component";
import { ListaObservacionesComponent } from "./lista-observaciones/lista-observaciones.component";
import { TarjetaObservacionComponent } from "./tarjeta-observacion/tarjeta-observacion.component";
import { FormularioNuevaObservacionComponent } from "./formulario-nueva-observacion/formulario-nueva-observacion.component";
import { FormularioRespuestaObservacionComponent } from "./formulario-respuesta-observacion/formulario-respuesta-observacion.component";

@NgModule({
  declarations: [
    ForoObservacionesComponent,
    ListaObservacionesComponent,
    TarjetaObservacionComponent,
    FormularioNuevaObservacionComponent,
    FormularioRespuestaObservacionComponent,
  ],
  imports: [CommonModule, SharedModule],
  exports: [
    ForoObservacionesComponent,
    ListaObservacionesComponent,
    TarjetaObservacionComponent,
    FormularioNuevaObservacionComponent,
    FormularioRespuestaObservacionComponent,
  ],
})
export class ForoObservacionesModule {}
