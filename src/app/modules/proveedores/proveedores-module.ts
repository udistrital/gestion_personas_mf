import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { ProveedoresRoutingModule } from "./proveedores-routing.module";
import { RegistroInicioComponent } from "./components/registro-inicio/registro-inicio.component";
import { RegistroPersonaJuridicaComponent } from "./components/registro-persona-juridica/registro-persona-juridica.component";
import { RegistroPersonaJuridicaPaso1Component } from "./components/registro-persona-juridica/registro-persona-juridica-paso-1/registro-persona-juridica-paso-1.component";
import { RegistroPersonaJuridicaPaso2Component } from "./components/registro-persona-juridica/registro-persona-juridica-paso-2/registro-persona-juridica-paso-2.component";
import { RegistroPersonaJuridicaPaso3Component } from "./components/registro-persona-juridica/registro-persona-juridica-paso-3/registro-persona-juridica-paso-3.component";
import { RegistroPersonaJuridicaPaso4Component } from "./components/registro-persona-juridica/registro-persona-juridica-paso-4/registro-persona-juridica-paso-4.component";
import { RegistroPersonaJuridicaEstadoCatalogosComponent } from "./components/registro-persona-juridica/registro-persona-juridica-estado-catalogos/registro-persona-juridica-estado-catalogos.component";
import { RegistroPersonaNaturalComponent } from "./components/registro-persona-natural/registro-persona-natural.component";
import { RegistroPersonaNaturalPaso1Component } from "./components/registro-persona-natural/registro-persona-natural-paso-1/registro-persona-natural-paso-1.component";
import { RegistroPersonaNaturalPaso2Component } from "./components/registro-persona-natural/registro-persona-natural-paso-2/registro-persona-natural-paso-2.component";
import { RegistroPersonaNaturalPaso3Component } from "./components/registro-persona-natural/registro-persona-natural-paso-3/registro-persona-natural-paso-3.component";
import { RegistroPersonaNaturalPaso4Component } from "./components/registro-persona-natural/registro-persona-natural-paso-4/registro-persona-natural-paso-4.component";
import { ConsentimientoDialogComponent } from "./components/registro-inicio/consentimiento-dialog/consentimiento-dialog.component";
import { OpcionesRegistroComponent } from "./components/registro-inicio/opciones-registro/opciones-registro.component";
import { BotonTratamientoInformacionComponent } from "./components/registro-inicio/boton-tratamiento-informacion/boton-tratamiento-informacion.component";

@NgModule({
  declarations: [
    RegistroInicioComponent,
    RegistroPersonaJuridicaComponent,
    RegistroPersonaJuridicaPaso1Component,
    RegistroPersonaJuridicaPaso2Component,
    RegistroPersonaJuridicaPaso3Component,
    RegistroPersonaJuridicaPaso4Component,
    RegistroPersonaJuridicaEstadoCatalogosComponent,
    RegistroPersonaNaturalComponent,
    RegistroPersonaNaturalPaso1Component,
    RegistroPersonaNaturalPaso2Component,
    ConsentimientoDialogComponent,
    OpcionesRegistroComponent,
    BotonTratamientoInformacionComponent,
  ],
  imports: [
    SharedModule,
    ProveedoresRoutingModule,
    RegistroPersonaNaturalPaso3Component,
    RegistroPersonaNaturalPaso4Component,
  ],
})
export class ProveedoresModule {}
