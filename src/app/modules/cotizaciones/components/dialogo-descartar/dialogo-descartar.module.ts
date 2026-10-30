import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoDescartarComponent } from "./dialogo-descartar.component";

@NgModule({
  declarations: [DialogoDescartarComponent],
  imports: [CommonModule, SharedModule],
  exports: [DialogoDescartarComponent],
})
export class DialogoDescartarModule {}
