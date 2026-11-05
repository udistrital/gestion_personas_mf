import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

/**
 * Placeholder de las pantallas que aún no pertenecen a esta entrega
 * (evaluación S-09, detalle del proveedor S-10 y decisión S-11).
 *
 * Se usa desde las acciones del tablero de oferentes para no inventar rutas ni
 * dejar enlaces muertos; el destino de regreso lo indica `data.volver`.
 */
@Component({
  selector: "app-pantalla-por-definir",
  templateUrl: "./pantalla-por-definir.component.html",
  styleUrls: ["./pantalla-por-definir.component.scss"],
  standalone: false,
})
export class PantallaPorDefinirComponent {
  readonly titulo: string;
  readonly pantalla: string;
  readonly breadcrumb: string;

  private readonly solicitudId: string;
  private readonly destino: "oferentes" | "detalle" | "listado" | "comparador";

  constructor(
    private readonly ruta: ActivatedRoute,
    private readonly router: Router,
  ) {
    const datos = this.ruta.snapshot.data;
    this.titulo = datos["titulo"] ?? "Pantalla por implementar";
    this.pantalla = datos["pantalla"] ?? "S-00";
    const volver = this.ruta.snapshot.queryParamMap.get("volver");
    this.destino =
      volver === "comparador" || volver === "oferentes" || volver === "detalle"
        ? volver
        : (datos["volver"] ?? "listado");
    this.solicitudId = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › <b>${this.titulo}</b></p>`;
  }

  volver(): void {
    if (this.destino === "comparador" && this.solicitudId) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        this.solicitudId,
        "evaluacion",
      ]);
      return;
    }
    if (this.destino === "oferentes" && this.solicitudId) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        this.solicitudId,
        "oferentes",
      ]);
      return;
    }
    if (this.destino === "detalle" && this.solicitudId) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        this.solicitudId,
      ]);
      return;
    }
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }
}
