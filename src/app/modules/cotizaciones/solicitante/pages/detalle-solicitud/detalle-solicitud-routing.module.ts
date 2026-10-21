import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { solicitudResolver } from "../../../resolvers/solicitud.resolver";
import { DetalleSolicitudComponent } from "./detalle-solicitud.component";
import { PestanaGeneralComponent } from "./pestanas/general/pestana-general.component";
import { PestanaPlaceholderComponent } from "./pestanas/pestana-placeholder/pestana-placeholder.component";

/**
 * Rutas del detalle de una solicitud (S-03).
 *
 * El padre resuelve la solicitud con `solicitudResolver`, de modo que las siete
 * pestañas hijas comparten la misma instancia sin volver a pedirla. La pestaña
 * activa vive en la URL (segmento de ruta), así que se conserva al recargar.
 *
 * Cada pestaña tiene su propia ruta hija desde el inicio para poder implementar
 * su contenido sin tocar el armazón. Las seis pendientes apuntan hoy al
 * placeholder, que toma el nombre de la pestaña desde `data`.
 */
const routes: Routes = [
  {
    path: "",
    component: DetalleSolicitudComponent,
    resolve: { solicitud: solicitudResolver },
    children: [
      { path: "", pathMatch: "full", redirectTo: "general" },
      {
        path: "general",
        component: PestanaGeneralComponent,
        title: "ÁGORA · Detalle · General",
      },
      {
        path: "presupuesto",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Presupuesto",
        data: { pestanaTitulo: "Presupuesto" },
      },
      {
        path: "items",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Ítems",
        data: { pestanaTitulo: "Ítems" },
      },
      {
        path: "contratacion",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Contratación y pago",
        data: { pestanaTitulo: "Contratación y pago" },
      },
      {
        path: "proveedores",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Proveedores objetivo",
        data: { pestanaTitulo: "Proveedores objetivo" },
      },
      {
        path: "documentos",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Documentos",
        data: { pestanaTitulo: "Documentos" },
      },
      {
        path: "historial",
        component: PestanaPlaceholderComponent,
        title: "ÁGORA · Detalle · Historial",
        data: { pestanaTitulo: "Historial" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DetalleSolicitudRoutingModule {}
