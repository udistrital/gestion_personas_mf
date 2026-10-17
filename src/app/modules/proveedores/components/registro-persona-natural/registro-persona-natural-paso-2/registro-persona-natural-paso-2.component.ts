import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormGroup } from "@angular/forms";
import {
  CatalogosPersonaNaturalPaso2,
  OpcionNatural,
} from "../registro-persona-natural-catalogos.service";
import { EstadoCatalogoNatural } from "../registro-persona-natural.component";

@Component({
  selector: "app-registro-persona-natural-paso-2",
  templateUrl: "./registro-persona-natural-paso-2.component.html",
  styleUrls: ["./registro-persona-natural-paso-2.component.scss"],
  standalone: false,
})
export class RegistroPersonaNaturalPaso2Component {
  @Input({ required: true }) afiliacionesFinanzasForm!: FormGroup;

  @Input() catalogos: CatalogosPersonaNaturalPaso2 | null = null;
  @Input() estadoCatalogos: EstadoCatalogoNatural = { cargando: false, error: null };
  @Output() reintentarCatalogos = new EventEmitter<void>();

  readonly opcionesSiNo = [
  { value: "no", label: "No, cotizante activo" },
  { value: "si", label: "Sí, pensionado" },
];

  get opcionesEps(): OpcionNatural[] {
    return this.catalogos?.eps ?? [];
  }

  get opcionesAfp(): OpcionNatural[] {
    return this.catalogos?.afp ?? [];
  }

  get opcionesCcf(): OpcionNatural[] {
    return this.catalogos?.ccf ?? [];
  }

  get opcionesEntidadesBancarias(): OpcionNatural[] {
    return this.catalogos?.entidadesBancarias ?? [];
  }

  get opcionesTipoCuenta(): OpcionNatural[] {
    return this.catalogos?.tiposCuenta ?? [];
  }

  esInvalido(controlName: string): boolean {
    const control = this.afiliacionesFinanzasForm.get(controlName);
    return !!control && control.invalid && control.touched;
  }
}
