import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { ResumenDiferenciasComponent } from "./resumen-diferencias.component";

/** Resumen de cambios compartido por S-04, S-08 y P-05. */
@NgModule({
  declarations: [ResumenDiferenciasComponent],
  imports: [CommonModule, SharedModule],
  exports: [ResumenDiferenciasComponent],
})
export class ResumenDiferenciasModule {}
