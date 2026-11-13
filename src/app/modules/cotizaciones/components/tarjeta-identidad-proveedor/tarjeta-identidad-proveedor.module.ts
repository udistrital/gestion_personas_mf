import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { TarjetaIdentidadProveedorComponent } from "./tarjeta-identidad-proveedor.component";

/**
 * Módulo propio de la tarjeta de identidad del proveedor.
 *
 * Se separó de `SolicitanteComponentsModule` para que el portal del proveedor
 * pueda reutilizarla sin arrastrar los diálogos del área solicitante. S-10 y
 * S-11 la siguen recibiendo mediante la reexportación de su módulo, sin
 * cambios visuales.
 */
@NgModule({
  declarations: [TarjetaIdentidadProveedorComponent],
  imports: [SharedModule],
  exports: [TarjetaIdentidadProveedorComponent],
})
export class TarjetaIdentidadProveedorModule {}
