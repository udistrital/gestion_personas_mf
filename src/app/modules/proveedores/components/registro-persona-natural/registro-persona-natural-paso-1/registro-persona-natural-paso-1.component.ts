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

  readonly opcionesSiNo = [
    { id: true, nombre: 'Sí' },
    { id: false, nombre: 'No' },
  ];

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
    return this.caracterizacionForm.get("tieneHijos")?.value === true;
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
