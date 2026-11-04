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

  /** Referencia estable para no recrear el arreglo en cada detección de cambios. */
  private readonly sinOpciones: OpcionNatural[] = [];

  get opcionesEps(): OpcionNatural[] {
    return this.catalogos?.eps ?? this.sinOpciones;
  }

  get opcionesAfp(): OpcionNatural[] {
    return this.catalogos?.afp ?? this.sinOpciones;
  }

  get opcionesCcf(): OpcionNatural[] {
    return this.catalogos?.ccf ?? this.sinOpciones;
  }

  get opcionesEntidadesBancarias(): OpcionNatural[] {
    return this.catalogos?.entidadesBancarias ?? this.sinOpciones;
  }

  get opcionesTipoCuenta(): OpcionNatural[] {
    return this.catalogos?.tiposCuenta ?? this.sinOpciones;
  }

  /** Mensaje de error de un control, o null si no aplica. */
  mensajeError(controlName: string, tipo: "required" | "email" = "required"): string | null {
    const control = this.afiliacionesFinanzasForm.get(controlName);
    if (!control || !control.touched || !control.hasError(tipo)) {
      return null;
    }
    if (tipo === "email") {
      return "Ingrese un correo electrónico válido.";
    }
    switch (controlName) {
      case "eps":
        return "Seleccione una EPS.";
      case "afp":
        return "Seleccione una AFP.";
      case "entidadBancaria":
        return "Seleccione una entidad bancaria.";
      case "tipoCuenta":
        return "Seleccione el tipo de cuenta.";
      case "numeroCuentaBancaria":
        return "El número de cuenta es obligatorio.";
      case "capitalAutorizadoPatrimonio":
        return "Este valor es obligatorio.";
      case "pensionadoAsignacionRetiro":
        return "Indique si es pensionado.";
      default:
        return "Este campo es obligatorio.";
    }
  }
}
