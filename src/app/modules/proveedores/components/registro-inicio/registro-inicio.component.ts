import { Location } from "@angular/common";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  Signal,
} from "@angular/core";
import { HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { forkJoin } from "rxjs";

import { ConsentimientoService } from "src/app/core/services/consentimiento.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ErrorRelacionMid,
  ProveedorMidRespuesta,
  RespuestaProveedorMid,
} from "../../models/gestion-personas-mid.model";
import {
  GestionPersonasMidService,
} from "../../services/gestion-personas-mid.service";
import { RegistroPersonaJuridicaCatalogosService } from "../registro-persona-juridica/services/registro-persona-juridica-catalogos.service";
import {
  ConsentimientoDialogComponent,
  DatosConsentimientoDialog,
} from "./consentimiento-dialog/consentimiento-dialog.component";
import { AccionConsentimiento } from "./consentimiento-dialog/consentimiento.utilidades";
import {
  ModalidadRegistro,
  OPCIONES_MODALIDAD_REGISTRO
} from "./registro-inicio.utilidades";

type EstadoConsultaMid = "idle" | "loading" | "success" | "partial" | "error";

function esRegistro(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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
  estadoConsultaMid: EstadoConsultaMid = "idle";
  mensajeConsultaMid = "";
  codigoHttpConsultaMid: number | null = null;
  proveedorConsultado: ProveedorMidRespuesta | null = null;
  erroresExpansionMid: ErrorRelacionMid[] = [];
  editandoProveedorMid = false;
  private solicitudConsultaMid = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly location: Location,
    private readonly router: Router,
    private readonly alertaService: AlertService,
    private readonly dialog: MatDialog,
    private readonly consentimientoService: ConsentimientoService,
    private readonly gestionPersonasMidService: GestionPersonasMidService,
    private readonly catalogosProveedorService: RegistroPersonaJuridicaCatalogosService,
    private readonly destroyRef: DestroyRef,
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

  get consultaMidEnCurso(): boolean {
    return this.estadoConsultaMid === "loading";
  }

  consultarProveedorExistente(event: Event, id: number): void {
    event.preventDefault();
    if (this.consultaMidEnCurso) {
      return;
    }

    this.limpiarResultadoConsulta();
    this.estadoConsultaMid = "loading";
    this.mensajeConsultaMid = "Consultando proveedor en Gestión de Personas MID...";
    const solicitud = ++this.solicitudConsultaMid;

    try {
      this.gestionPersonasMidService
        .consultar(id, [
          "Id",
          "TerceroId",
          "TipoRegistroId",
          "Tercero.Id",
          "Tercero.TipoContribuyenteId",
        ])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (solicitud !== this.solicitudConsultaMid) {
              return;
            }
            this.procesarRespuestaConsulta(response);
          },
          error: (error: unknown) => {
            if (solicitud !== this.solicitudConsultaMid) {
              return;
            }
            this.estadoConsultaMid = "error";
            this.codigoHttpConsultaMid =
              error instanceof HttpErrorResponse ? error.status : null;
            this.mensajeConsultaMid = this.mensajeErrorConsulta(error);
          },
        });
    } catch (error: unknown) {
      this.estadoConsultaMid = "error";
      this.mensajeConsultaMid =
        error instanceof Error
          ? error.message
          : "No fue posible iniciar la consulta del proveedor.";
    }
  }

  editarProveedorConsultado(): void {
    const proveedor = this.proveedorConsultado;
    if (
      !proveedor
      || typeof proveedor.Id !== "number"
      || !Number.isSafeInteger(proveedor.Id)
      || proveedor.Id <= 0
      || typeof proveedor.TerceroId !== "number"
      || !Number.isSafeInteger(proveedor.TerceroId)
      || proveedor.TerceroId <= 0
      || this.editandoProveedorMid
    ) {
      return;
    }

    this.editandoProveedorMid = true;
    forkJoin({
      natural: this.catalogosProveedorService.obtenerIdTipoContribuyente("P_NATURAL"),
      juridica: this.catalogosProveedorService.obtenerIdTipoContribuyente("P_JURIDICA"),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ natural, juridica }) => {
          this.editandoProveedorMid = false;
          const tipoContribuyenteId = proveedor.Tercero?.TipoContribuyenteId;
          const tipoRegistroId = proveedor.TipoRegistroId;
          const ruta = tipoContribuyenteId === natural
            && tipoRegistroId === natural
            ? "/proveedores/registro-persona-natural"
            : tipoContribuyenteId === juridica
              && tipoRegistroId === juridica
              ? "/proveedores/registro-persona-juridica"
              : undefined;
          if (!ruta) {
            void this.alertaService.showErrorAlert(
              "El tipo de registro y el tipo de contribuyente del proveedor no corresponden a la misma modalidad válida.",
            );
            return;
          }
          void this.router.navigate([ruta], {
            queryParams: { id: proveedor.Id },
          });
        },
        error: (error: unknown) => {
          this.editandoProveedorMid = false;
          const detalle = error instanceof Error
            ? error.message
            : "No fue posible resolver los tipos de registro del catálogo.";
          void this.alertaService.showErrorAlert(detalle);
        },
      });
  }

  limpiarResultadoConsulta(): void {
    this.solicitudConsultaMid++;
    this.estadoConsultaMid = "idle";
    this.mensajeConsultaMid = "";
    this.codigoHttpConsultaMid = null;
    this.proveedorConsultado = null;
    this.erroresExpansionMid = [];
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

  private procesarRespuestaConsulta(
    response: HttpResponse<RespuestaProveedorMid>,
  ): void {
    this.codigoHttpConsultaMid = response.status;
    const envelope = response.body;

    if (!envelope) {
      this.estadoConsultaMid = "error";
      this.mensajeConsultaMid = "El MID devolvió una respuesta vacía.";
      return;
    }

    if (envelope.Status !== String(response.status)) {
      this.estadoConsultaMid = "error";
      this.mensajeConsultaMid =
        "El código HTTP no coincide con el estado informado por el MID.";
      return;
    }

    if (!envelope.Success || !envelope.Data) {
      this.estadoConsultaMid = "error";
      this.mensajeConsultaMid =
        envelope.Message || "El MID no pudo completar la consulta.";
      return;
    }

    if (response.status !== 200 && response.status !== 206) {
      this.estadoConsultaMid = "error";
      this.mensajeConsultaMid =
        "El MID devolvió un código HTTP no previsto para la consulta.";
      return;
    }

    this.proveedorConsultado = envelope.Data;
    this.erroresExpansionMid = envelope.MetaData?.Errors ?? [];
    this.mensajeConsultaMid = envelope.Message;
    this.estadoConsultaMid = response.status === 206 ? "partial" : "success";
  }

  private mensajeErrorConsulta(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body: unknown = error.error;
      if (esRegistro(body) && typeof body["Message"] === "string") {
        return body["Message"];
      }
      if (error.status === 0) {
        return "No fue posible conectar con el MID. Verifique URL, red, CORS y autenticación.";
      }
      return `La consulta al MID falló (HTTP ${error.status}).`;
    }
    return error instanceof Error
      ? error.message
      : "No fue posible consultar el proveedor.";
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