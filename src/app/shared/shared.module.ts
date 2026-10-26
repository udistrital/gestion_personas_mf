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
import { ChipEstadoComponent } from "./components/chip-estado/chip-estado.component";
import { LineaTiempoComponent } from "./components/linea-tiempo/linea-tiempo.component";
import { ListadoFiltrosComponent } from "./components/listado-filtros/listado-filtros.component";
import { AsistentePasosComponent } from "./components/asistente-pasos/asistente-pasos.component";
import { BannerPasoComponent } from "./components/banner-paso/banner-paso.component";
import { EditorEnriquecidoComponent } from "./components/editor-enriquecido/editor-enriquecido.component";
import { EtiquetaPorDefinirComponent } from "./components/etiqueta-por-definir/etiqueta-por-definir.component";
import { HtmlSeguroPipe } from "./pipes/html-seguro.pipe";
import { QuillModule } from "ngx-quill";

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
    ChipEstadoComponent,
    LineaTiempoComponent,
    ListadoFiltrosComponent,
    AsistentePasosComponent,
    BannerPasoComponent,
    EditorEnriquecidoComponent,
    EtiquetaPorDefinirComponent,
    HtmlSeguroPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    IconosModule,
    QuillModule.forRoot(),
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
    ChipEstadoComponent,
    LineaTiempoComponent,
    ListadoFiltrosComponent,
    AsistentePasosComponent,
    BannerPasoComponent,
    EditorEnriquecidoComponent,
    EtiquetaPorDefinirComponent,
    QuillModule,
    HtmlSeguroPipe,
  ],
})
export class SharedModule {}
