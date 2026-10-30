import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoConfirmarEnvioComponent } from "./dialogo-confirmar-envio.component";

@NgModule({
  declarations: [DialogoConfirmarEnvioComponent],
  imports: [CommonModule, SharedModule],
  exports: [DialogoConfirmarEnvioComponent],
})
export class DialogoConfirmarEnvioModule {}
