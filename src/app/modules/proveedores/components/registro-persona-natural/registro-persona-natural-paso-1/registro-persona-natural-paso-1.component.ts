import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormGroup } from "@angular/forms";
import {
  CatalogosPersonaNaturalPaso1,
  OpcionNatural,
} from "../registro-persona-natural-catalogos.service";
import {
  ClaveGeografiaNatural,
  EstadoCatalogoNatural,
  EstadoListaNatural,
} from "../registro-persona-natural.component";

@Component({
  selector: "app-registro-persona-natural-paso-1",
  templateUrl: "./registro-persona-natural-paso-1.component.html",
  styleUrls: ["./registro-persona-natural-paso-1.component.scss"],
  standalone: false,
})
export class RegistroPersonaNaturalPaso1Component {
  @Input({ required: true }) identificacionForm!: FormGroup;
  @Input({ required: true }) caracterizacionForm!: FormGroup;
  @Input({ required: true }) experienciaForm!: FormGroup;
  @Input({ required: true }) tributarioForm!: FormGroup;
  @Input({ required: true }) residenciaForm!: FormGroup;
  @Input({ required: true }) contactoForm!: FormGroup;
  @Input() catalogos: CatalogosPersonaNaturalPaso1 | null = null;
  @Input() estadoCatalogos: EstadoCatalogoNatural = { cargando: false, error: null };
  @Input() geografia!: Record<ClaveGeografiaNatural, EstadoListaNatural>;
  @Output() reintentarCatalogos = new EventEmitter<void>();
  @Output() reintentarGeografia = new EventEmitter<ClaveGeografiaNatural>();

  opciones(clave: keyof CatalogosPersonaNaturalPaso1): OpcionNatural[] {
    return this.catalogos?.[clave] ?? [];
  }

  get paisResidenciaNombre(): string {
    return (
      this.opciones("paises").find(
        (pais) =>
          pais.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() ===
          "colombia",
      )?.nombre ?? ""
    );
  }

  get tieneHijosAfirmativo(): boolean {
    const id = this.caracterizacionForm.get("tieneHijos")?.value;
    const nombre = this.opciones("tieneHijos").find((o) => o.id === id)?.nombre;
    return (
      typeof nombre === "string" &&
      nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "si"
    );
  }

  incrementarMeses(
    controlName: "experienciaLaboralTotal" | "experienciaProfesional"
  ): void {
    const control = this.experienciaForm.get(controlName);

    if (!control) {
      return;
    }

    const valorActual = Number(control.value) || 0;
    control.setValue(valorActual + 1);
    control.markAsDirty();
  }

  decrementarMeses(
    controlName: "experienciaLaboralTotal" | "experienciaProfesional"
  ): void {
    const control = this.experienciaForm.get(controlName);

    if (!control) {
      return;
    }

    const valorActual = Number(control.value) || 0;
    control.setValue(Math.max(0, valorActual - 1));
    control.markAsDirty();
  }
}
