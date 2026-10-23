import { Location } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Output,
  Signal,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";

import { ConsentimientoService } from "src/app/core/services/consentimiento.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ConsentimientoDialogComponent,
  DatosConsentimientoDialog,
} from "./consentimiento-dialog/consentimiento-dialog.component";
import { AccionConsentimiento } from "./consentimiento-dialog/consentimiento.utilidades";
import {
  ModalidadRegistro,
  OPCIONES_MODALIDAD_REGISTRO
} from "./registro-inicio.utilidades";

@Component({
  selector: "app-registro-inicio",
  templateUrl: "./registro-inicio.component.html",
  styleUrls: ["./registro-inicio.component.scss"],
  standalone: false,
})
export class RegistroInicioComponent implements AfterViewInit {
  titulo = "Registro — Ágora Core MF";

  @Output() modalidadSeleccionada = new EventEmitter<ModalidadRegistro>();

  readonly opciones: ModalidadRegistro[] = OPCIONES_MODALIDAD_REGISTRO;
  readonly formulario: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly location: Location,
    private readonly router: Router,
    private readonly alertaService: AlertService,
    private readonly dialog: MatDialog,
    private readonly consentimientoService: ConsentimientoService,
  ) {
    this.formulario = this.fb.group({
      modalidad: ["", Validators.required],
    });
  }

  get consentimientoAceptado(): Signal<boolean> {
    return this.consentimientoService.aceptado;
  }

  ngAfterViewInit(): void {
    if (this.consentimientoAceptado()) {
      this.mostrarConsentimientoConfirmado();
      return;
    }
    this.mostrarConsentimientoInformado();
  }

  get consentimientoPendiente(): boolean {
    return !this.consentimientoAceptado();
  }

  /** Reapertura del consentimiento desde el aviso de la vista. Si ya se aceptó
   *  anteriormente se muestra el estado confirmado, no se vuelve a pedir. */
  consultarConsentimiento(): void {
    if (this.consentimientoAceptado()) {
      this.mostrarConsentimientoConfirmado();
      return;
    }
    this.mostrarConsentimientoInformado();
  }

  private mostrarConsentimientoInformado(): void {
    this.abrirDialogo("informado", (accion) => {
      if (accion === "aceptar") {
        this.consentimientoService.registrarAceptacion();
        this.mostrarConsentimientoConfirmado();
        return;
      }
      if (accion === "rechazar") {
        this.mostrarConsentimientoRechazado();
      }
    });
  }

  private mostrarConsentimientoConfirmado(): void {
    this.abrirDialogo("confirmado", () => undefined);
  }

  private mostrarConsentimientoRechazado(): void {
    this.abrirDialogo("rechazado", (accion) => {
      if (accion === "reconsentar") {
        this.mostrarConsentimientoInformado();
      }
    });
  }

  private abrirDialogo(
    vista: DatosConsentimientoDialog["vista"],
    alCerrar: (accion: AccionConsentimiento | undefined) => void
  ): void {
    this.dialog
      .open<ConsentimientoDialogComponent, DatosConsentimientoDialog, AccionConsentimiento>(
        ConsentimientoDialogComponent,
        {
          data: { vista },
          disableClose: true,
          autoFocus: "dialog",
          ariaLabel: "Consentimiento informado para el tratamiento de datos personales",
          width: "720px",
          maxWidth: "94vw",
        }
      )
      .afterClosed()
      .subscribe((accion) => {
        alCerrar(accion);
      });
  }

  regresar(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl("/");
  }

  continuar(): void {
    if (this.consentimientoPendiente) {
      this.alertaService.showAlert(
        "Consentimiento requerido",
        "Debe aceptar el consentimiento para el tratamiento de datos personales para continuar con el diligenciamiento."
      );
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.alertaService.showAlert(
        "Selección requerida",
        "Seleccione la categoría correspondiente para continuar con el diligenciamiento."
      );
      return;
    }

    const seleccionada = this.opciones.find(
      (opcion) => opcion.id === this.formulario.get("modalidad")?.value
    );

    if (seleccionada) {
      switch (seleccionada.id) {
        case "persona-natural":
          this.router.navigateByUrl("/proveedores/registro-persona-natural");
          break;
        case "persona-juridica":
          this.router.navigateByUrl("/proveedores/registro-persona-juridica");
          break;
        case "consorcio":
          this.router.navigateByUrl("/proveedores/registro-consorcio");
          break;
        default:
          break;
      }
      
      this.modalidadSeleccionada.emit(seleccionada);
    }
  }
}