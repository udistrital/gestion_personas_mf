import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ListadoEstudiosComponent } from "./listado-estudios/listado-estudios.component";
import { CrearEstudioComponent } from "./crear-estudio/crear-estudio.component";

const routes: Routes = [
  {
    path: "",
    component: ListadoEstudiosComponent,
    title: "ÁGORA · Estudios de mercado",
  },
  {
    path: "nuevo",
    component: ListadoEstudiosComponent,
    data: { abrirNuevo: true },
    title: "ÁGORA · Nuevo estudio de mercado",
  },
  {
    path: ":id/proveedores",
    component: CrearEstudioComponent,
    title: "ÁGORA · Buscar e invitar proveedores",
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EstudiosMercadoRoutingModule {}
