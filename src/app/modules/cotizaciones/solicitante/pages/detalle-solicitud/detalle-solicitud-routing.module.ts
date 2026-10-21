import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { solicitudResolver } from "../../../resolvers/solicitud.resolver";
import { DetalleSolicitudComponent } from "./detalle-solicitud.component";
import { PestanaContratacionPagoComponent } from "./pestanas/contratacion-pago/pestana-contratacion-pago.component";
import { PestanaDocumentosComponent } from "./pestanas/documentos/pestana-documentos.component";
import { PestanaGeneralComponent } from "./pestanas/general/pestana-general.component";
import { PestanaItemsComponent } from "./pestanas/items/pestana-items.component";
import { PestanaPresupuestoComponent } from "./pestanas/presupuesto/pestana-presupuesto.component";
import { PestanaProveedoresObjetivoComponent } from "./pestanas/proveedores-objetivo/pestana-proveedores-objetivo.component";
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
        component: PestanaPresupuestoComponent,
        title: "ÁGORA · Detalle · Presupuesto",
      },
      {
        path: "items",
        component: PestanaItemsComponent,
        title: "ÁGORA · Detalle · Ítems",
      },
      {
        path: "contratacion",
        component: PestanaContratacionPagoComponent,
        title: "ÁGORA · Detalle · Contratación y pago",
      },
      {
        path: "proveedores",
        component: PestanaProveedoresObjetivoComponent,
        title: "ÁGORA · Detalle · Proveedores objetivo",
      },
      {
        path: "documentos",
        component: PestanaDocumentosComponent,
        title: "ÁGORA · Detalle · Documentos",
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
