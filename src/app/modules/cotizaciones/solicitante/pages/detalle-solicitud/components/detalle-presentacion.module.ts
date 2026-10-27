import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { EncabezadoPestanaComponent } from "./encabezado-pestana/encabezado-pestana.component";
import { ParEtiquetaValorComponent } from "./par-etiqueta-valor/par-etiqueta-valor.component";
import { TarjetaSeccionComponent } from "./tarjeta-seccion/tarjeta-seccion.component";

@NgModule({
  declarations: [
    TarjetaSeccionComponent,
    ParEtiquetaValorComponent,
    EncabezadoPestanaComponent,
  ],
  imports: [CommonModule, SharedModule],
  exports: [
    TarjetaSeccionComponent,
    ParEtiquetaValorComponent,
    EncabezadoPestanaComponent,
  ],
})
export class DetallePresentacionModule {}
