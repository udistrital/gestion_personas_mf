import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormGroup } from "@angular/forms";

/** Opción mínima que necesita la nomenclatura DIAN. */
export interface OpcionDireccionDian {
  readonly id: number | string;
  readonly nombre: string;
}

/**
 * Generador de nomenclatura estándar DIAN (RUT).
 *
 * Compone la dirección a partir de vía, número de cruce, placa y datos de
 * interior. Es presentacional: escribe sobre el `formGroup` recibido y no
 * conoce el catálogo de origen de las opciones. Se usa tanto en el registro de
 * persona natural como en el de persona jurídica, que comparten la norma pero
 * nombran distinto sus controles.
 */
@Component({
  selector: "direccion-dian",
  templateUrl: "./direccion-dian.component.html",
  styleUrls: ["./direccion-dian.component.scss"],
  standalone: false,
})
export class DireccionDianComponent {
  /** Grupo que contiene los controles de la dirección. */
  @Input({ required: true }) formGroup!: FormGroup;

  /** Nombre del control de tipo de vía. */
  @Input() controlVia = "via";

  /** Nombre del control del detalle de vía. */
  @Input() controlDetalleVia = "detalleVia";

  /** Nombre del control del número de cruce. */
  @Input() controlNumeroCruce = "numeroCruce";

  /** Nombre del control de la placa de puerta. */
  @Input() controlPlacaPuerta = "placaPuerta";

  /** Nombre del control del tipo de interior. */
  @Input() controlInterior = "interior1";

  /** Nombre del control del detalle de interior. */
  @Input() controlDetalleInterior = "detalleInterior";

  /** Tipos de vía disponibles. */
  @Input() opcionesVia: readonly OpcionDireccionDian[] = [];

  /** Tipos de interior disponibles. */
  @Input() opcionesInterior: readonly OpcionDireccionDian[] = [];

  /** true mientras cargan los tipos de vía. */
  @Input() cargandoVia = false;

  /** Error de carga de los tipos de vía. */
  @Input() errorVia: string | null = null;

  /** true mientras cargan los tipos de interior. */
  @Input() cargandoInterior = false;

  /** Error de carga de los tipos de interior. */
  @Input() errorInterior: string | null = null;

  /** Pide reintentar la carga de los tipos de vía. */
  @Output() reintentarVia = new EventEmitter<void>();

  /** Pide reintentar la carga de los tipos de interior. */
  @Output() reintentarInterior = new EventEmitter<void>();

  /** Dirección normalizada que se muestra como vista previa. */
  get direccionGenerada(): string {
    const via = this.nombreOpcion(this.controlVia, this.opcionesVia);
    const detalle = this.texto(this.controlDetalleVia);
    const cruce = this.texto(this.controlNumeroCruce);
    const placa = this.texto(this.controlPlacaPuerta);
    const interior = this.nombreOpcion(this.controlInterior, this.opcionesInterior);
    const detalleInterior = this.texto(this.controlDetalleInterior);

    const partes = [via, detalle, cruce ? `# ${cruce}` : "", placa ? `- ${placa}` : ""];
    let direccion = partes.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    if (interior || detalleInterior) {
      direccion = [direccion, interior, detalleInterior]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return direccion.toUpperCase();
  }

  /** true cuando ya hay datos suficientes para validar la nomenclatura. */
  get nomenclaturaCompleta(): boolean {
    return (
      !!this.texto(this.controlDetalleVia) &&
      !!this.texto(this.controlNumeroCruce) &&
      !!this.texto(this.controlPlacaPuerta) &&
      !!this.texto(this.controlVia)
    );
  }

  get estadoNomenclatura(): string {
    return this.nomenclaturaCompleta
      ? "Nomenclatura Validada"
      : "Complete la nomenclatura";
  }

  /** Mensaje de error visible de un control obligatorio. */
  esInvalido(control: string): boolean {
    const campo = this.formGroup.get(control);
    return !!campo && campo.touched && campo.hasError("required");
  }

  private nombreOpcion(
    control: string,
    opciones: readonly OpcionDireccionDian[],
  ): string {
    const valor = this.formGroup.get(control)?.value;
    const opcion = opciones.find((item) => item.id === valor);
    return opcion?.nombre ?? "";
  }

  private texto(control: string): string {
    const valor = this.formGroup.get(control)?.value;
    return typeof valor === "string" ? valor.trim() : "";
  }
}
