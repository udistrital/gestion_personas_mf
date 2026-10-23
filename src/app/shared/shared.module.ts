import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MaterialModule } from "./modules/material.module";
import { IconosModule } from "./modules/iconos.module";
import { PlantillaPaginaContenedoraComponent } from "./components/templates/plantilla-pagina-contenedora/plantilla-pagina-contenedora.component";
import { PlantillaTarjetaContenedoraComponent } from "./components/templates/plantilla-tarjeta-contenedora/plantilla-tarjeta-contenedora.component";
import { StepperVisualComponent } from "./components/stepper-visual/stepper-visual.component";
import { AvisoLegalComponent } from "./components/formulario/aviso-legal/aviso-legal.component";
import { BarraAccionesComponent } from "./components/formulario/barra-acciones/barra-acciones.component";
import { DireccionGeneradaComponent } from "./components/formulario/direccion-generada/direccion-generada.component";
import { CampoDineroComponent } from "./components/formulario/campo-dinero/campo-dinero.component";
import { ValidacionCampoDirective } from "./directives/validacion-campo.directive";

@NgModule({
  declarations: [
    PlantillaPaginaContenedoraComponent,
    PlantillaTarjetaContenedoraComponent,
    StepperVisualComponent,
    AvisoLegalComponent,
    BarraAccionesComponent,
    DireccionGeneradaComponent,
    CampoDineroComponent,
    ValidacionCampoDirective,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    IconosModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MaterialModule,
    IconosModule,
    PlantillaPaginaContenedoraComponent,
    PlantillaTarjetaContenedoraComponent,
    StepperVisualComponent,
    AvisoLegalComponent,
    BarraAccionesComponent,
    DireccionGeneradaComponent,
    CampoDineroComponent,
    ValidacionCampoDirective,
  ],
})
export class SharedModule {}
