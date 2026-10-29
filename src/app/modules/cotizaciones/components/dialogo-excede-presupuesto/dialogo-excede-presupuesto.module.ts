import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoExcedePresupuestoComponent } from "./dialogo-excede-presupuesto.component";

@NgModule({
  declarations: [DialogoExcedePresupuestoComponent],
  imports: [CommonModule, SharedModule],
  exports: [DialogoExcedePresupuestoComponent],
})
export class DialogoExcedePresupuestoModule {}
