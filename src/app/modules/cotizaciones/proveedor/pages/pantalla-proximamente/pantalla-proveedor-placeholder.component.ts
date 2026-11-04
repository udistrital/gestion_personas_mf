import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-pantalla-proveedor-placeholder",
  templateUrl: "./pantalla-proveedor-placeholder.component.html",
  styleUrls: ["./pantalla-proveedor-placeholder.component.scss"],
  standalone: false,
})
export class PantallaProveedorPlaceholderComponent {
  readonly titulo: string;
  readonly pantalla: string;
  readonly breadcrumb =
    "<p>Portal Proveedor › Cotizaciones › Solicitudes de cotización</p>";

  constructor(route: ActivatedRoute) {
    this.titulo = route.snapshot.data["titulo"] ?? "Pantalla por implementar";
    this.pantalla = route.snapshot.data["pantalla"] ?? "P-00";
  }
}
