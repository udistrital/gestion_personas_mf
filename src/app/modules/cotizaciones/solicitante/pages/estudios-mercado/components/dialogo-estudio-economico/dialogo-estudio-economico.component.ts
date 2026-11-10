import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import {
  justificacionMinima,
} from "src/app/shared/validators/justificacion.validator";
import {
  ETIQUETAS_FUENTE_INFORMACION,
  ETIQUETAS_METODO_PRECIO,
  ETIQUETAS_VARIABLE_TRIBUTARIA,
  EstudioMercado,
  FuenteInformacionEstudio,
  MetodoPrecioEstudio,
  OfertaVinculadaEstudio,
  RegistroEstudioMercado,
  SolicitudAsociadaEstudio,
  USUARIO_ESTUDIO_MOCK,
  VariableTributaria,
  actividadesPorCodigo,
  calcularValorReferencia,
} from "../../../../../models/estudio-mercado.model";
import { formatoCop } from "../../../../../models/necesidad.model";
import { EstudiosMercadoService } from "../../../../../services/estudios-mercado.service";

/** Datos del diálogo de creación/edición económica. */
export interface DialogoEstudioEconomicoDatos {
  readonly estudio: EstudioMercado | null;
}

/**
 * Modal “Nuevo estudio de mercado” del mockup S-13a.
 *
 * Implementa los campos económicos visibles (fuente, metodología, análisis,
 * variables tributarias y ofertas vinculadas) y calcula un valor de referencia
 * simple. No implementa la matriz APU ni el dashboard de métricas: esas piezas
 * quedaron fuera de esta entrega.
 */
@Component({
  selector: "app-dialogo-estudio-economico",
  templateUrl: "./dialogo-estudio-economico.component.html",
  styleUrls: ["./dialogo-estudio-economico.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoEstudioEconomicoComponent implements OnInit {
  private readonly servicio = inject(EstudiosMercadoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(
    MatDialogRef<DialogoEstudioEconomicoComponent, EstudioMercado>,
  );
  readonly datos = inject<DialogoEstudioEconomicoDatos>(MAT_DIALOG_DATA);

  readonly moneda = formatoCop;
  readonly fuentes = Object.entries(ETIQUETAS_FUENTE_INFORMACION) as [
    FuenteInformacionEstudio,
    string,
  ][];
  readonly metodos = Object.entries(ETIQUETAS_METODO_PRECIO) as [
    MetodoPrecioEstudio,
    string,
  ][];
  readonly variables = Object.entries(ETIQUETAS_VARIABLE_TRIBUTARIA) as [
    VariableTributaria,
    string,
  ][];
  readonly solicitudes = signal<readonly SolicitudAsociadaEstudio[]>([]);
  readonly ofertas = signal<readonly OfertaVinculadaEstudio[]>([]);
  readonly cargandoSolicitudes = signal(true);
  readonly errorSolicitudes = signal("");
  readonly errorOfertas = signal("");
  readonly errorGuardado = signal("");
  readonly guardando = signal(false);

  readonly formulario = new FormGroup({
    solicitudId: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    objeto: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, justificacionMinima(10)],
    }),
    fuenteInformacion: new FormControl<FuenteInformacionEstudio>("agora", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    metodoPrecio: new FormControl<MetodoPrecioEstudio>("menor-homologado", {
      nonNullable: true,
      validators: [Validators.required],
    }),
    analisisTecnico: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, justificacionMinima(50)],
    }),
    ofertasSeleccionadas: new FormControl<readonly string[]>([], {
      nonNullable: true,
    }),
    variablesTributarias: new FormControl<readonly VariableTributaria[]>(
      ["iva", "estampilla-universidad", "estampilla-cultura", "estampilla-adulto-mayor"],
      { nonNullable: true },
    ),
  });

  private readonly formTick = signal(0);

  readonly solicitud = computed(() => {
    this.formTick();
    return this.solicitudes().find(
      (candidata) =>
        candidata.id === this.formulario.controls.solicitudId.value,
    );
  });

  readonly valorReferencia = computed(() => {
    this.formTick();
    const seleccionadas = new Set(
      this.formulario.controls.ofertasSeleccionadas.value,
    );
    return calcularValorReferencia(
      this.ofertas().map((oferta) => ({
        ...oferta,
        seleccionada: seleccionadas.has(oferta.id),
      })),
      this.formulario.controls.metodoPrecio.value,
    );
  });

  get codigo(): string {
    return this.datos.estudio?.id ?? "Se generará al guardar";
  }

  get mostrarErrorObjeto(): boolean {
    const control = this.formulario.controls.objeto;
    return control.invalid && (control.touched || control.dirty);
  }

  get mostrarErrorAnalisis(): boolean {
    const control = this.formulario.controls.analisisTecnico;
    return control.invalid && (control.touched || control.dirty);
  }

  ngOnInit(): void {
    this.servicio
      .listarSolicitudesAsociadas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitudes) => {
          this.solicitudes.set(solicitudes);
          this.cargandoSolicitudes.set(false);
          this.inicializar(solicitudes);
        },
        error: () => {
          this.cargandoSolicitudes.set(false);
          this.errorSolicitudes.set(
            "No fue posible cargar las solicitudes asociadas. Intente nuevamente.",
          );
        },
      });

    this.formulario.controls.solicitudId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.aplicarSolicitud(id));
    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update((valor) => valor + 1));
  }

  private inicializar(solicitudes: readonly SolicitudAsociadaEstudio[]): void {
    const estudio = this.datos.estudio;
    if (estudio) {
      const solicitud =
        solicitudes.find((candidata) => candidata.id === estudio.solicitudId) ??
        solicitudes[0];
      this.formulario.patchValue(
        {
          solicitudId: solicitud?.id ?? "",
          objeto: estudio.objeto,
          fuenteInformacion: estudio.fuenteInformacion,
          metodoPrecio: estudio.metodoPrecio,
          analisisTecnico: estudio.analisisTecnico,
          ofertasSeleccionadas: estudio.ofertasVinculadas
            .filter((oferta) => oferta.seleccionada)
            .map((oferta) => oferta.id),
          variablesTributarias: [...estudio.variablesTributarias],
        },
        { emitEvent: false },
      );
      this.ofertas.set(estudio.ofertasVinculadas);
      return;
    }

    const primera = solicitudes[0];
    if (!primera) {
      return;
    }
    this.formulario.patchValue(
      {
        solicitudId: primera.id,
        objeto: primera.titulo,
      },
      { emitEvent: false },
    );
    this.aplicarSolicitud(primera.id);
  }

  private aplicarSolicitud(id: string): void {
    const solicitud = this.solicitudes().find(
      (candidata) => candidata.id === id,
    );
    if (!solicitud) {
      this.ofertas.set([]);
      return;
    }
    this.ofertas.set(solicitud.ofertas);
    this.formulario.controls.ofertasSeleccionadas.setValue(
      solicitud.ofertas.map((oferta) => oferta.id),
    );
    if (!this.datos.estudio) {
      this.formulario.controls.objeto.setValue(solicitud.titulo);
    }
  }

  estaOfertaSeleccionada(id: string): boolean {
    return this.formulario.controls.ofertasSeleccionadas.value.includes(id);
  }

  alternarOferta(id: string, marcada: boolean): void {
    const actuales = new Set(
      this.formulario.controls.ofertasSeleccionadas.value,
    );
    if (marcada) {
      actuales.add(id);
    } else {
      actuales.delete(id);
    }
    this.formulario.controls.ofertasSeleccionadas.setValue([...actuales]);
    this.errorOfertas.set("");
  }

  estaVariable(variable: VariableTributaria): boolean {
    return this.formulario.controls.variablesTributarias.value.includes(
      variable,
    );
  }

  alternarVariable(variable: VariableTributaria, marcada: boolean): void {
    const actuales = new Set(
      this.formulario.controls.variablesTributarias.value,
    );
    if (marcada) {
      actuales.add(variable);
    } else {
      actuales.delete(variable);
    }
    this.formulario.controls.variablesTributarias.setValue([...actuales]);
  }

  guardar(fijarPresupuesto: boolean): void {
    this.errorGuardado.set("");
    this.errorOfertas.set("");
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      return;
    }

    const solicitud = this.solicitud();
    if (!solicitud) {
      this.errorGuardado.set("Seleccione una solicitud asociada.");
      return;
    }
    if (this.formulario.controls.ofertasSeleccionadas.value.length === 0) {
      this.errorOfertas.set(
        "Seleccione al menos una oferta para calcular el valor de referencia.",
      );
      return;
    }

    const seleccionadas = new Set(
      this.formulario.controls.ofertasSeleccionadas.value,
    );
    const ofertas = this.ofertas().map((oferta) => ({
      ...oferta,
      seleccionada: seleccionadas.has(oferta.id),
    }));

    const registro: RegistroEstudioMercado = {
      solicitudId: solicitud.id,
      objeto: this.formulario.controls.objeto.value,
      tipoNecesidad: solicitud.tipoNecesidad,
      vigencia: solicitud.vigencia,
      dependencia: solicitud.dependencia,
      responsable:
        this.datos.estudio?.responsable ?? USUARIO_ESTUDIO_MOCK.nombre,
      fuenteInformacion: this.formulario.controls.fuenteInformacion.value,
      metodoPrecio: this.formulario.controls.metodoPrecio.value,
      analisisTecnico: this.formulario.controls.analisisTecnico.value,
      variablesTributarias:
        this.formulario.controls.variablesTributarias.value,
      ofertasVinculadas: ofertas,
      actividades:
        this.datos.estudio?.actividades ??
        actividadesPorCodigo(solicitud.actividades),
      areaSnies: this.datos.estudio?.areaSnies ?? "",
      nucleoSnies: this.datos.estudio?.nucleoSnies ?? "",
      fechaLimite: this.datos.estudio?.fechaLimite ?? null,
      asunto: this.datos.estudio?.asunto ?? "",
      mensaje: this.datos.estudio?.mensaje ?? "",
      notificar: this.datos.estudio?.notificar ?? true,
      adjuntos: [],
      fijarPresupuesto,
    };

    this.guardando.set(true);
    this.dialogRef.disableClose = true;
    this.servicio
      .guardarBorrador(this.datos.estudio?.id ?? null, registro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estudio) => {
          this.dialogRef.disableClose = false;
          this.guardando.set(false);
          this.dialogRef.close(estudio);
        },
        error: (error: Error) => {
          this.dialogRef.disableClose = false;
          this.guardando.set(false);
          this.errorGuardado.set(
            error.message ||
              "No fue posible guardar el estudio. Intente nuevamente.",
          );
        },
      });
  }

  cerrar(): void {
    if (!this.guardando()) {
      this.dialogRef.close();
    }
  }
}
