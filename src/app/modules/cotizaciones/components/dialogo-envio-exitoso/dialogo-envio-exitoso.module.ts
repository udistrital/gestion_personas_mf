import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoEnvioExitosoComponent } from "./dialogo-envio-exitoso.component";

@NgModule({
  declarations: [DialogoEnvioExitosoComponent],
  imports: [CommonModule, SharedModule],
  exports: [DialogoEnvioExitosoComponent],
})
export class DialogoEnvioExitosoModule {}
