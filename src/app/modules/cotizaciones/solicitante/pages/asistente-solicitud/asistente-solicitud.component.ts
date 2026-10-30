import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { debounceTime } from "rxjs";
import { AlertService } from "src/app/shared/services/alert.service";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import {
  BorradorSolicitudNueva,
  BorradorSolicitudService,
} from "../../../services/borrador-solicitud.service";
import { CalendarioFestivosService } from "../../../services/calendario-festivos.service";
import type {
  ContextoEdicionSolicitud,
  DatosEdicionSolicitud,
  ModoEdicionSolicitud,
  ResumenDiferencias,
  ResultadoGuardadoSolicitud,
  VersionEdicionSolicitud,
} from "../../../models/edicion-solicitud.model";
import { DiferenciasSolicitudService } from "../../../services/diferencias-solicitud.service";
import { EdicionSolicitudService } from "../../../services/edicion-solicitud.service";
import { ReglasEdicionSolicitudService } from "../../../services/reglas-edicion-solicitud.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import {
  DialogoDescartarComponent,
  type DialogoDescartarDatos,
  type ResultadoDescartar,
} from "../../../components/dialogo-descartar/dialogo-descartar.component";
import { ResultadoCruce, formatoCop } from "../../../models/necesidad.model";
import { aniosDelRango } from "../../../models/calendario.model";
import {
  DEPENDENCIAS_DESTINO,
  DEPENDENCIAS_SOLICITANTES,
  MIN_CARACTERES_CRITERIO,
  MIN_CARACTERES_PLAN,
  diasHabilesEntre,
  formatoFechaLarga,
} from "../../../models/datos-generales.model";
import { ItemSolicitud, resumirItems } from "../../../models/items.model";
import {
  ActividadVinculada,
  ResumenSolicitudProveedores,
} from "../../../models/proveedores.model";
import {
  FORMA_PAGO_CONTRAENTREGA,
  MEDIOS_PAGO,
  ParametroPago,
  TIPOS_CONTRATO,
  etiquetaCorta,
} from "../../../models/contratacion.model";
import {
  ANEXOS_SEMILLA,
  AnexoSolicitud,
  DOCUMENTOS_OFERENTE_SEMILLA,
  DocumentoOferente,
} from "../../../models/documentos.model";
import { PASOS_SOLICITUD } from "./asistente-solicitud.const";
import {
  ResumenRadicacion,
  contarProveedoresNotificados,
  pluralizarProveedores,
} from "../../../models/revision.model";
import type { ItemVerificacion } from "../../../models/revision.model";
import { EstadoCruce } from "./paso-1-necesidad/paso-necesidad.component";
import {
  minCaracteres,
  validadorCronograma,
} from "./paso-2-datos-generales/paso-datos-generales.component";
import { alMenosUnItem } from "./paso-3-items/paso-items.component";
import { sumaPorcentajes } from "./paso-4-contratacion/paso-contratacion.component";
import { criteriosProveedores } from "./paso-5-proveedores/paso-proveedores.component";
import {
  DatosRevision,
  PasoRevisionComponent,
} from "./paso-7-revision/paso-revision.component";

const PRIMER_PASO = 1;
const SEGUNDO_PASO = 2;
const TERCER_PASO = 3;
const CUARTO_PASO = 4;
const QUINTO_PASO = 5;
const SEXTO_PASO = 6;
const SEPTIMO_PASO = 7;
const ULTIMO_PASO = 7;

interface ValidacionPaso extends ItemVerificacion {
  readonly paso: number;
}

/**
 * Asistente de nueva solicitud de cotización (S-02).
 */
@Component({
  selector: "asistente-solicitud",
  templateUrl: "./asistente-solicitud.component.html",
  styleUrls: ["./asistente-solicitud.component.scss"],
  standalone: false,
})
export class AsistenteSolicitudComponent implements OnInit {
  readonly pasos = PASOS_SOLICITUD;

  /**
   * Contexto de edición (S-04). `null` cuando el asistente crea una solicitud.
   *
   * El armazón de edición entrega la solicitud, el modo habilitado por el
   * estado y la fotografía editable ya armada; el asistente reutiliza el mismo
   * formulario, los mismos pasos y las mismas validaciones de S-02.
   */
  @Input() contextoEdicion: ContextoEdicionSolicitud | null = null;

  /** Notifica que la edición se guardó; el armazón navega al detalle. */
  @Output() guardado = new EventEmitter<ResultadoGuardadoSolicitud>();

  /** Notifica que el usuario descartó los cambios y quiere salir. */
  @Output() descartado = new EventEmitter<void>();

  /** true mientras se persiste la edición en la capa de datos. */
  readonly guardando = signal(false);

  /** Mensaje del último fallo al guardar la edición (vacío = sin error). */
  readonly errorGuardado = signal("");

  /** Cambios calculados contra la última versión guardada. */
  readonly diferencias = signal<ResumenDiferencias>({ grupos: [], total: 0 });

  private readonly reglas = inject(ReglasEdicionSolicitudService);
  private readonly edicionDraft = inject(EdicionSolicitudService);
  private readonly diferenciasSvc = inject(DiferenciasSolicitudService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly dialog = inject(MatDialog);

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Mis Solicitudes de Cotización › <b>Nueva solicitud</b></p>";

  readonly asistenteForm: FormGroup;

  /** Paso visible. */
  pasoActual = PRIMER_PASO;

  /** Último paso alcanzado; el stepper no permite saltarse los intermedios. */
  pasoAlcanzado = PRIMER_PASO;

  /** Estado del cruce con SICAPITAL (lo informa el paso 1). */
  readonly estadoCruce = signal<EstadoCruce>("inicial");

  /** true cuando el acuerdo marco (si lo hay) ya fue aceptado. */
  readonly acuerdoAceptado = signal(false);

  /** Resultado del cruce del paso 1; alimenta las tarjetas de solo lectura del paso 2. */
  readonly resultadoCruce = signal<ResultadoCruce | null>(null);

  /** true cuando al entrar había un borrador persistido en el equipo. */
  readonly borradorRestaurado = signal(false);

  /**
   * true cuando la solicitud ya quedó radicada. Se deriva del formulario para
   * que el estado sobreviva a la navegación entre pasos y a un borrador
   * restaurado (la radicación es definitiva).
   */
  get solicitudRadicada(): boolean {
    return this.revisionForm.get("radicada")?.value === true;
  }

  /**
   * true cuando el paso 7 muestra la vista de éxito.
   *
   * La vista de éxito sustituye la barra de acciones (el expediente ya está
   * radicado), así que el paso 7 notifica el cambio de vista.
   */
  readonly vistaExitosa = signal(false);

  /** Componente del paso 7; el asistente le delega el procesamiento. */
  @ViewChild(PasoRevisionComponent)
  private pasoRevision?: PasoRevisionComponent;

  /** Textos del bloque de estado de la barra de acciones. */
  estadoMensaje = "Borrador de solicitud autoguardado";
  estadoDetalle =
    "Los cambios se guardan automáticamente en este equipo · Sesión cifrada SSL 256-bit Universidad Distrital";

  constructor(
    fb: FormBuilder,
    private readonly borrador: BorradorSolicitudService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
    private readonly calendarioFestivos: CalendarioFestivosService,
  ) {
    this.asistenteForm = fb.group({
      // Paso 1 (implementado)
      necesidad: fb.group({
        unidadEjecutora: ["", Validators.required],
        vigencia: ["", Validators.required],
        numeroNecesidad: ["", Validators.required],
      }),
      // Paso 2 (implementado)
      datosGenerales: fb.group(
        {
          dependenciaSolicitante: ["", Validators.required],
          dependenciaDestino: ["", Validators.required],
          fechaApertura: ["", Validators.required],
          fechaCierre: ["", Validators.required],
          criterioSeleccion: ["", minCaracteres(MIN_CARACTERES_CRITERIO)],
          planAccion: ["", minCaracteres(MIN_CARACTERES_PLAN)],
        },
        {
          validators: validadorCronograma(() =>
            this.calendarioFestivos.fechasFestivas(),
          ),
        },
      ),
      // Pasos 3 en adelante: se habilitan con su implementación.
      items: fb.group(
        {
          modo: ["individual", Validators.required],
          archivo: [""],
          procesado: [false],
          registros: [[]],
        },
        { validators: alMenosUnItem() },
      ),
      // Paso 4 (implementado)
      contratacion: fb.group(
        {
          tipoContrato: ["", Validators.required],
          medioPago: ["", Validators.required],
          formaPago: ["", Validators.required],
          // Arreglo plano de parámetros de pago; el validador de grupo exige
          // que sumen exactamente 100 %.
          parametros: [[]],
        },
        { validators: sumaPorcentajes() },
      ),
      proveedores: fb.group(
        {
          // Arreglo plano de actividades CIIU vinculadas; el validador de
          // grupo exige al menos una. El SNIES obligatorio se evalúa en el
          // asistente porque depende del tipo de necesidad del paso 3.
          actividades: [[]],
          areaSnies: [""],
          nucleoSnies: [""],
        },
        { validators: criteriosProveedores() },
      ),
      // Paso 6 (implementado): los anexos y la matriz documental se guardan
      // como arreglos planos para que el borrador los restaure con un
      // `patchValue` simple.
      documentos: fb.group({
        anexos: [[]],
        requeridos: [[]],
      }),
      // Paso 7 (implementado): la revisión no captura datos nuevos; el
      // subgrupo solo guarda el radicado cuando la solicitud se procesa.
      revision: fb.group({
        radicado: [""],
        radicada: [false],
      }),
    });

  }

  // ── Edición de una solicitud existente (S-04) ────────────────────────────

  /** true cuando el asistente modifica una solicitud existente. */
  get esEdicion(): boolean {
    return this.contextoEdicion !== null;
  }

  /** Modo habilitado por el estado de la solicitud (`null` al crear). */
  get modoEdicion(): ModoEdicionSolicitud | null {
    return this.contextoEdicion?.modo ?? null;
  }

  /** Pasos que admiten cambios en el modo actual. */
  get pasosEditables(): readonly number[] {
    const modo = this.modoEdicion;
    return modo ? this.reglas.pasosEditables(modo) : [];
  }

  /** true si el paso admite cambios (siempre en creación). */
  pasoEditable(paso: number): boolean {
    const modo = this.modoEdicion;
    return !modo || this.reglas.pasoEditable(paso, modo);
  }

  /** true si el paso se muestra en solo lectura durante la edición. */
  pasoBloqueado(paso: number): boolean {
    return this.esEdicion && !this.pasoEditable(paso);
  }

  /** true si el campo del paso 2 se puede modificar. */
  campoDatosGeneralesEditable(campo: string): boolean {
    const modo = this.modoEdicion;
    return !modo || this.reglas.campoDatosGeneralesEditable(campo, modo);
  }

  /** true cuando no hay diferencias contra la versión guardada. */
  get sinCambios(): boolean {
    return this.diferencias().total === 0;
  }

  /** Título del modo de edición (cabecera del asistente). */
  get tituloModoEdicion(): string {
    return this.modoEdicion === "restringida"
      ? "Modificación restringida"
      : "Edición completa del borrador";
  }

  /** Texto de apoyo del modo de edición. */
  get descripcionModoEdicion(): string {
    return this.modoEdicion === "restringida"
      ? "Esta solicitud ya fue enviada a proveedores: solo puede modificar los bienes y servicios (paso 3) y la fecha de cierre (paso 2). El cambio queda pendiente de aprobación."
      : "Puede ajustar los pasos 2 a 6. La necesidad y el CDP de SICAPITAL (paso 1) se conservan sin cambios.";
  }

  /** Versión vigente del expediente. */
  get versionEdicion(): string {
    return this.contextoEdicion?.solicitud.version ?? "v1.0";
  }

  /**
   * Habilita el guardado del paso 7.
   *
   * En la edición restringida se exige que el cronograma y los ítems sean
   * válidos; en la edición completa se permite guardar avances parciales (es
   * un borrador). La ausencia de cambios no deshabilita el botón: al pulsarlo
   * el asistente explica que la solicitud no se modifica. La justificación del
   * paso 7 se valida en su componente.
   */
  get puedeGuardarEdicion(): boolean {
    if (!this.esEdicion || this.guardando()) {
      return false;
    }
    if (this.modoEdicion === "restringida") {
      return this.datosGeneralesForm.valid && this.itemsForm.valid;
    }
    return true;
  }

  /** Motivo por el que el guardado de la edición está deshabilitado. */
  get ayudaGuardarEdicion(): string {
    if (this.guardando()) {
      return "Guardando los cambios de la solicitud…";
    }
    if (this.sinCambios) {
      return "Sin cambios respecto de la versión guardada: al guardar se indicará que la solicitud no se modifica.";
    }
    if (this.modoEdicion === "restringida") {
      if (!this.datosGeneralesForm.valid) {
        return this.ayudaPaso2();
      }
      if (!this.itemsForm.valid) {
        return this.ayudaPaso3();
      }
    }
    return "";
  }

  /** Carga la fotografía editable (borrador local o expediente) en el formulario. */
  private hidratarEdicion(): void {
    const contexto = this.contextoEdicion;
    if (!contexto) {
      return;
    }

    const borrador = this.edicionDraft.cargar(contexto.solicitud.id);
    const datos = borrador?.datos ?? contexto.valores;

    this.asistenteForm.patchValue({
      necesidad: datos.necesidad,
      datosGenerales: datos.datosGenerales,
      items: datos.items,
      contratacion: datos.contratacion,
      proveedores: datos.proveedores,
      documentos: datos.documentos,
    });

    this.resultadoCruce.set(datos.resultadoCruce);
    this.estadoCruce.set("cargado");
    this.acuerdoAceptado.set(true);

    const paso = borrador?.currentStep ?? SEGUNDO_PASO;
    this.pasoActual = Math.min(ULTIMO_PASO, Math.max(PRIMER_PASO, paso));
    this.pasoAlcanzado = ULTIMO_PASO;
    this.borradorRestaurado.set(!!borrador);

    if (borrador) {
      const guardado = new Date(borrador.savedAt);
      this.estadoMensaje = "Borrador de la edición restaurado";
      this.estadoDetalle = isNaN(guardado.getTime())
        ? "Última edición desconocida · Sesión cifrada SSL 256-bit"
        : `Última edición: ${guardado.toLocaleString("es-CO")} · Sesión cifrada SSL 256-bit`;
    } else {
      this.estadoMensaje = "Edición en curso";
      this.estadoDetalle =
        "Los cambios se guardan automáticamente en este equipo · Sesión cifrada SSL 256-bit Universidad Distrital";
    }

    this.aplicarBloqueos();
    this.actualizarDiferencias();
    this.cargarCalendario();
  }

  /**
   * Deshabilita los campos que no admite el modo de edición.
   *
   * En la modificación restringida solo queda activa la fecha de cierre del
   * paso 2 y los ítems del paso 3; el resto de pasos se deshabilita en bloque.
   * Los valores siguen disponibles con `getRawValue`, así que el borrador y el
   * diff no pierden información.
   */
  private aplicarBloqueos(): void {
    const modo = this.modoEdicion;
    if (!modo) {
      return;
    }

    if (modo === "restringida") {
      [
        "dependenciaSolicitante",
        "dependenciaDestino",
        "fechaApertura",
        "criterioSeleccion",
        "planAccion",
      ].forEach((campo) =>
        this.datosGeneralesForm.get(campo)?.disable({ emitEvent: false }),
      );
      this.datosGeneralesForm.get("fechaCierre")?.enable({ emitEvent: false });
      this.contratacionForm.disable({ emitEvent: false });
      this.proveedoresForm.disable({ emitEvent: false });
      this.documentosForm.disable({ emitEvent: false });
      return;
    }

    this.datosGeneralesForm.enable({ emitEvent: false });
    this.contratacionForm.enable({ emitEvent: false });
    this.proveedoresForm.enable({ emitEvent: false });
    this.documentosForm.enable({ emitEvent: false });
  }

  /** Fotografía editable construida desde el formulario actual. */
  private datosEdicionActuales(): DatosEdicionSolicitud {
    const { necesidad, datosGenerales, items, contratacion, proveedores, documentos } =
      this.asistenteForm.getRawValue() as Omit<
        DatosEdicionSolicitud,
        "resultadoCruce"
      >;

    return {
      necesidad,
      datosGenerales,
      items,
      contratacion,
      proveedores,
      documentos,
      resultadoCruce: this.cruceEdicion(),
    };
  }

  /** Cruce de SICAPITAL del expediente (la edición no consulta de nuevo). */
  private cruceEdicion(): ResultadoCruce {
    const cruce =
      this.resultadoCruce() ?? this.contextoEdicion?.valores.resultadoCruce;
    if (!cruce) {
      throw new Error(
        "La edición requiere el cruce de SICAPITAL guardado en el expediente.",
      );
    }
    return cruce;
  }

  /** Recalcula el resumen de diferencias contra la versión guardada. */
  private actualizarDiferencias(): void {
    const base = this.contextoEdicion?.valores;
    if (!base) {
      return;
    }
    this.diferencias.set(
      this.diferenciasSvc.calcular(base, this.datosEdicionActuales()),
    );
  }

  /** Persiste el avance de la edición en el borrador local de la solicitud. */
  private guardarBorradorEdicion(automatico = false): void {
    const contexto = this.contextoEdicion;
    if (!contexto) {
      return;
    }

    if (
      !this.edicionDraft.guardar(
        contexto.solicitud.id,
        this.datosEdicionActuales(),
        this.pasoActual,
      )
    ) {
      this.estadoMensaje = "No fue posible guardar el avance de la edición";
      this.estadoDetalle =
        "El almacenamiento del navegador no está disponible; continúe sin autoguardado.";
      return;
    }

    const hora = new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    this.estadoMensaje = automatico
      ? "Cambios de la edición autoguardados"
      : "Avance de la edición guardado";
    this.estadoDetalle = `Hoy a las ${hora} · Sesión cifrada SSL 256-bit Universidad Distrital`;

    if (!automatico) {
      void this.alerta.showAlert(
        "Avance guardado",
        "Los cambios diligenciados quedan guardados en este equipo. La solicitud se actualiza cuando guarde los cambios desde el paso 7.",
      );
    }
  }

  /**
   * Guarda la edición en la capa de datos (paso 7).
   *
   * Al completarse emite `guardado` para que el armazón navegue al detalle; el
   * detalle abre la confirmación con el resultado de la nueva versión.
   */
  guardarCambios(): void {
    const contexto = this.contextoEdicion;
    const modo = this.modoEdicion;
    if (!contexto || !modo || this.guardando()) {
      return;
    }

    // El diff se recalcula en el momento de guardar: el debounce del formulario
    // puede no haber alcanzado a reflejar el último cambio antes de pulsar.
    this.actualizarDiferencias();
    this.errorGuardado.set("");

    if (this.sinCambios) {
      this.errorGuardado.set(
        modo === "restringida"
          ? "No se registró ninguna modificación. Ajuste al menos un ítem del paso 3 o la fecha de cierre del paso 2 antes de solicitar la modificación; la solicitud permanece sin cambios."
          : "No se registró ningún cambio. Ajuste al menos un campo antes de guardar; la solicitud permanece igual.",
      );
      return;
    }

    if (!this.puedeGuardarEdicion) {
      return;
    }

    this.guardando.set(true);

    this.solicitudes
      .guardarEdicion(contexto.solicitud.id, this.datosEdicionActuales(), modo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.guardando.set(false);
          this.edicionDraft.eliminar(contexto.solicitud.id);
          this.guardado.emit(resultado);
        },
        error: (error: Error) => {
          this.guardando.set(false);
          this.errorGuardado.set(
            error.message ||
              "No fue posible guardar los cambios de la solicitud. Intente nuevamente.",
          );
        },
      });
  }

  /** Abre la confirmación de descarte de los cambios de la edición. */
  abrirDescartar(): void {
    const contexto = this.contextoEdicion;
    const modo = this.modoEdicion;
    if (!contexto || !modo) {
      return;
    }

    this.solicitudes
      .historialVersiones(contexto.solicitud.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (versiones) => this.abrirDialogoDescarte(versiones),
        error: (error: Error) => {
          void this.alerta.showAlert(
            "No fue posible consultar las versiones",
            error.message ||
              "Vuelva al detalle e intente de nuevo el descarte de la edición.",
          );
        },
      });
  }

  /**
   * Muestra el diálogo de descarte con las versiones guardadas.
   *
   * El usuario puede conservar la versión vigente (solo se descarta el avance
   * sin guardar) o volver a una anterior; en ese caso la capa de datos restaura
   * la fotografía, la fila y la bitácora de esa versión.
   */
  private abrirDialogoDescarte(
    versiones: readonly VersionEdicionSolicitud[],
  ): void {
    const contexto = this.contextoEdicion;
    if (!contexto) {
      return;
    }

    this.dialog
      .open<
        DialogoDescartarComponent,
        DialogoDescartarDatos,
        ResultadoDescartar
      >(DialogoDescartarComponent, {
        data: {
          solicitudId: contexto.solicitud.id,
          modo: this.modoEdicion ?? "completa",
          diferencias: this.diferencias(),
          versiones,
        },
        width: "680px",
        maxWidth: "96vw",
        autoFocus: ".dialogo__seguir",
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (!resultado) {
          return;
        }
        if (!resultado.version) {
          this.edicionDraft.eliminar(contexto.solicitud.id);
          this.descartado.emit();
          return;
        }
        this.solicitudes
          .revertirEdicion(contexto.solicitud.id, resultado.version)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.edicionDraft.eliminar(contexto.solicitud.id);
              void this.alerta.showSuccessAlert(
                `La solicitud volvió a la versión ${resultado.version}. Los cambios guardados posteriores se descartaron.`,
                "Versión restaurada",
              );
              this.descartado.emit();
            },
            error: (error: Error) => {
              void this.alerta.showAlert(
                "No fue posible restaurar la versión",
                error.message ||
                  "Los cambios de la edición se conservan; intente nuevamente.",
              );
            },
          });
      });
  }

  ngOnInit(): void {
    // La hidratación ocurre antes de que los pasos se instancien (el
    // `ngOnInit` del padre corre antes del de sus hijos), así que el paso 1 ya
    // encuentra los valores del expediente o del borrador restaurado.
    if (this.esEdicion) {
      this.hidratarEdicion();
    } else {
      this.restaurarBorrador();
    }

    this.asistenteForm.valueChanges
      .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.esEdicion) {
          this.errorGuardado.set("");
          this.guardarBorradorEdicion(true);
          this.actualizarDiferencias();
          return;
        }
        this.guardarBorrador(true);
      });

    // Las fechas del cronograma determinan los años del calendario: al
    // cambiarlas se consultan los que falten.
    this.datosGeneralesForm.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCalendario());

    // Cuando llegan los festivos, la regla de días hábiles se reevalúa: el
    // validador del cronograma los tiene en cuenta.
    this.calendarioFestivos.cambios$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.datosGeneralesForm.updateValueAndValidity());

    // Un borrador restaurado con la solicitud ya radicada abre el paso 7 en
    // la vista de éxito.
    this.vistaExitosa.set(this.solicitudRadicada);
  }

  /**
   * Consulta el calendario de días festivos que necesita el cronograma.
   *
   * Se piden los años que abrange el rango apertura→cierre más la vigencia
   * elegida: un proceso que abre en diciembre y cierra en enero necesita
   * ambos años. El servicio cachea por año, así que mover las fechas no
   * dispara consultas repetidas.
   */
  private cargarCalendario(): void {
    const vigencia = String(this.resultadoCruce()?.necesidad.vigencia ?? "");
    const apertura = String(
      this.datosGeneralesForm.get("fechaApertura")?.value ?? "",
    );
    const cierre = String(
      this.datosGeneralesForm.get("fechaCierre")?.value ?? "",
    );

    const anios = new Set<number>(aniosDelRango(apertura, cierre));
    if (/^\d{4}$/.test(vigencia)) {
      anios.add(Number(vigencia));
    }

    if (anios.size > 0) {
      this.calendarioFestivos.cargar([...anios].sort((a, b) => a - b));
    }
  }

  get necesidadForm(): FormGroup {
    return this.asistenteForm.get("necesidad") as FormGroup;
  }

  get datosGeneralesForm(): FormGroup {
    return this.asistenteForm.get("datosGenerales") as FormGroup;
  }

  get itemsForm(): FormGroup {
    return this.asistenteForm.get("items") as FormGroup;
  }

  get contratacionForm(): FormGroup {
    return this.asistenteForm.get("contratacion") as FormGroup;
  }

  get proveedoresForm(): FormGroup {
    return this.asistenteForm.get("proveedores") as FormGroup;
  }

  get documentosForm(): FormGroup {
    return this.asistenteForm.get("documentos") as FormGroup;
  }

  get revisionForm(): FormGroup {
    return this.asistenteForm.get("revision") as FormGroup;
  }

  /**
   * Resumen de solo lectura que alimenta la tarjeta 1 del paso 5.
   *
   * Mezcla el cruce de SICAPITAL (objeto y responsable), los datos generales
   * del paso 2 (dependencias y cronograma) y el tipo de necesidad calculado en
   * el paso 3. Cada dato faltante cae a una cadena vacía y la tarjeta lo
   * muestra como guion.
   */
  get resumenProveedores(): ResumenSolicitudProveedores {
    const cruce = this.resultadoCruce();
    const datos = this.datosGeneralesForm.getRawValue() as {
      dependenciaSolicitante?: string;
      fechaApertura?: string;
      fechaCierre?: string;
    };
    const registros = (this.itemsForm.get("registros")?.value ??
      []) as readonly ItemSolicitud[];
    const dependencia =
      DEPENDENCIAS_SOLICITANTES.find(
        (opcion) => opcion.valor === datos.dependenciaSolicitante,
      )?.etiqueta ??
      datos.dependenciaSolicitante ??
      "";

    return {
      objeto: cruce?.solicitud.objeto ?? "",
      numeroCotizacion: cruce?.necesidad.valor ?? "",
      vigencia: cruce?.necesidad.vigencia
        ? String(cruce.necesidad.vigencia)
        : "",
      unidadEjecutora: cruce?.responsable.unidadEjecutora ?? "",
      responsable: cruce
        ? `${cruce.responsable.nombres} ${cruce.responsable.apellidos}`
        : "",
      dependenciaSolicitante: dependencia,
      ordenadorGasto: cruce?.responsable.ordenadorGasto ?? "",
      fechaApertura: datos.fechaApertura ?? "",
      fechaCierre: datos.fechaCierre ?? "",
      tipoNecesidad: resumirItems(registros).tipo,
    };
  }

  /** Siguiente componente según el paso activo. */
  get nombrePasoActual(): string {
    return (
      this.pasos.find((paso) => paso.numero === this.pasoActual)?.nombre ?? ""
    );
  }

  /** Paso resaltado en rojo cuando el cruce con SICAPITAL falló. */
  get pasoConError(): number | null {
    return this.estadoCruce() === "error" && this.pasoActual === PRIMER_PASO
      ? PRIMER_PASO
      : null;
  }

  /**
   * Habilita la acción del paso actual: en el paso 7 se exige que la validación
   * final de los pasos editables esté completa.
   *
   * En edición, los pasos que el modo no permite modificar nunca bloquean el
   * avance: se conservan tal como están en el expediente.
   */
  get pasoValido(): boolean {
    if (this.pasoActual === PRIMER_PASO) {
      return (
        !!this.necesidadForm.valid &&
        this.estadoCruce() === "cargado" &&
        this.acuerdoAceptado()
      );
    }
    if (this.pasoActual === SEGUNDO_PASO) {
      return (
        !this.pasoEditable(SEGUNDO_PASO) || !!this.datosGeneralesForm.valid
      );
    }
    if (this.pasoActual === TERCER_PASO) {
      return !this.pasoEditable(TERCER_PASO) || !!this.itemsForm.valid;
    }
    if (this.pasoActual === CUARTO_PASO) {
      return (
        !this.pasoEditable(CUARTO_PASO) || !!this.contratacionForm.valid
      );
    }
    if (this.pasoActual === QUINTO_PASO) {
      return !this.pasoEditable(QUINTO_PASO) || this.proveedoresCompleto;
    }
    if (this.pasoActual === SEXTO_PASO) {
      // El paso 6 no exige validaciones: el diseño no marca documentos
      // obligatorios en la solicitud (ambos bloques figuran "Por definir").
      return true;
    }
    if (this.pasoActual === SEPTIMO_PASO) {
      return this.pasoPendienteValidacion === null;
    }
    return false;
  }

  /**
   * true si el paso cuenta como válido con el alcance de la edición actual.
   *
   * Un formulario deshabilitado (pasos 4 a 6 en la modificación restringida)
   * informa `valid === false`; por eso los pasos fuera del alcance se excluyen
   * de la validación en lugar de exigirles un estado que no pueden alcanzar.
   */
  private cumplePaso(paso: number, cumple: boolean): boolean {
    return !this.pasoEditable(paso) || cumple;
  }

  /**
   * Validación final centralizada. El checklist y el procesamiento usan estos
   * mismos resultados para evitar que un paso editado quede sin revalidar.
   *
   * Con un modo de edición, los pasos fuera del alcance no se evalúan: el
   * expediente ya los tiene aprobados y el formulario está deshabilitado.
   */
  get validacionFinal(): readonly ValidacionPaso[] {
    const cruce = this.resultadoCruce();
    const presupuestoValido =
      this.necesidadForm.valid &&
      this.estadoCruce() === "cargado" &&
      !!cruce &&
      cruce.presupuesto.disponibilidades.length > 0 &&
      cruce.presupuesto.valorCdp > 0;
    const acuerdoMarcoAplica = !!cruce?.acuerdoMarco;
    const totalPagos = this.parametrosPago.reduce(
      (total, parametro) => total + Number(parametro.porcentaje ?? 0),
      0,
    );
    const actividades = this.actividadesVinculadas.length;
    const detalleFijo = (paso: number, detalle: string): string =>
      this.pasoEditable(paso)
        ? detalle
        : "Se conserva sin cambios: este paso no forma parte de la modificación.";

    return [
      {
        paso: PRIMER_PASO,
        titulo: "Presupuesto asociado",
        detalle: this.cumplePaso(
          PRIMER_PASO,
          presupuestoValido,
        )
          ? "CDP vigente sincronizado con SICAPITAL"
          : "Revise los datos de la necesidad y el cruce presupuestal en el paso 1.",
        cumple: this.cumplePaso(PRIMER_PASO, presupuestoValido),
      },
      {
        paso: PRIMER_PASO,
        titulo: "Acuerdo marco aceptado",
        detalle: detalleFijo(
          PRIMER_PASO,
          !acuerdoMarcoAplica
            ? "No aplica a esta necesidad"
            : this.acuerdoAceptado()
              ? "Acuerdo marco aceptado"
              : "Debe aceptar el acuerdo marco en el paso 1.",
        ),
        cumple: this.cumplePaso(
          PRIMER_PASO,
          !acuerdoMarcoAplica || this.acuerdoAceptado(),
        ),
      },
      {
        paso: SEGUNDO_PASO,
        titulo: "Datos generales y cronograma válidos",
        detalle: this.cumplePaso(
          SEGUNDO_PASO,
          this.datosGeneralesForm.valid,
        )
          ? `Plazo mínimo legal cumplido${this.datosRevision.diasPlazo ? ` (${this.datosRevision.diasPlazo} días)` : ""}`
          : "Complete los campos obligatorios y corrija el cronograma en el paso 2.",
        cumple: this.cumplePaso(SEGUNDO_PASO, this.datosGeneralesForm.valid),
      },
      {
        paso: TERCER_PASO,
        titulo: "Al menos un ítem registrado",
        detalle: this.cumplePaso(TERCER_PASO, this.itemsForm.valid)
          ? `${this.resumenItems.totalItems} ítems cargados exitosamente`
          : "Agregue al menos un ítem al pliego en el paso 3.",
        cumple: this.cumplePaso(TERCER_PASO, this.itemsForm.valid),
      },
      {
        paso: CUARTO_PASO,
        titulo: "Contratación y forma de pago válidas",
        detalle: detalleFijo(
          CUARTO_PASO,
          this.contratacionForm.valid
            ? "Consolidado financiero balanceado (100 %)"
            : `Complete la contratación y ajuste los pagos al 100 % en el paso 4 (actual: ${totalPagos} %).`,
        ),
        cumple: this.cumplePaso(
          CUARTO_PASO,
          this.contratacionForm.valid,
        ),
      },
      {
        paso: QUINTO_PASO,
        titulo: "Proveedores objetivo definidos",
        detalle: detalleFijo(
          QUINTO_PASO,
          this.proveedoresCompleto
            ? `${actividades} actividades CIIU${this.sniesAplicaProveedores ? " y criterios SNIES" : ""} definidos`
            : "Complete las actividades CIIU y los criterios SNIES requeridos en el paso 5.",
        ),
        cumple: this.cumplePaso(QUINTO_PASO, this.proveedoresCompleto),
      },
      {
        paso: SEXTO_PASO,
        titulo: "Documentos requeridos definidos",
        detalle: detalleFijo(
          SEXTO_PASO,
          this.documentosForm.valid && this.documentosRequeridos.length > 0
            ? "Matriz de oferente parametrizada"
            : "Revise la matriz documental del paso 6.",
        ),
        cumple: this.cumplePaso(
          SEXTO_PASO,
          this.documentosForm.valid && this.documentosRequeridos.length > 0,
        ),
      },
    ];
  }

  /** Primer paso que debe corregirse antes de permitir el procesamiento. */
  private get pasoPendienteValidacion(): number | null {
    return (
      this.validacionFinal.find((validacion) => !validacion.cumple)?.paso ??
      null
    );
  }

  /**
   * Valida el paso 5: al menos una actividad CIIU y, cuando la solicitud exige
   * idoneidad técnica (servicios o mixta), el área y el núcleo SNIES.
   */
  private get proveedoresCompleto(): boolean {
    if (!this.proveedoresForm.valid) {
      return false;
    }
    if (!this.sniesAplicaProveedores) {
      return true;
    }
    return (
      !!this.proveedoresForm.get("areaSnies")?.value &&
      !!this.proveedoresForm.get("nucleoSnies")?.value
    );
  }

  /** true cuando el tipo de necesidad del paso 3 exige idoneidad (SNIES). */
  private get sniesAplicaProveedores(): boolean {
    const tipo = this.resumenProveedores.tipoNecesidad;
    return tipo === "servicios" || tipo === "mixta";
  }

  /** Motivo por el que "Continuar" está deshabilitado (título del botón). */
  get ayudaContinuar(): string {
    if (this.pasoActual === SEGUNDO_PASO) {
      return this.ayudaPaso2();
    }
    if (this.pasoActual === TERCER_PASO) {
      return this.ayudaPaso3();
    }
    if (this.pasoActual === CUARTO_PASO) {
      return this.ayudaPaso4();
    }
    if (this.pasoActual === QUINTO_PASO) {
      return this.ayudaPaso5();
    }
    if (this.pasoActual === SEXTO_PASO) {
      return this.ayudaPaso6();
    }
    if (this.pasoActual === SEPTIMO_PASO) {
      return this.ayudaPaso7();
    }
    if (this.pasoActual !== PRIMER_PASO) {
      return "Este paso aún no está implementado en esta fase del desarrollo.";
    }
    switch (this.estadoCruce()) {
      case "error":
        return "Acción bloqueada: debe resolver la sincronización con SICAPITAL.";
      case "cargando":
        return "Espere a que finalice el cruce con SICAPITAL.";
      case "inicial":
        return "Seleccione la necesidad presupuestal para validar el paso.";
      case "cargado":
        break;
    }
    if (!this.necesidadForm.valid) {
      return "Complete los campos obligatorios del paso 1.";
    }
    if (!this.acuerdoAceptado()) {
      return "Debe aceptar el acuerdo marco para continuar.";
    }
    return "";
  }

  /** Explica el bloqueo del paso 2 según el primer error encontrado. */
  private ayudaPaso2(): string {
    const form = this.datosGeneralesForm;
    if (form.get("dependenciaSolicitante")?.invalid) {
      return "Seleccione la dependencia solicitante.";
    }
    if (form.get("dependenciaDestino")?.invalid) {
      return "Seleccione la dependencia destino.";
    }
    if (!form.get("fechaApertura")?.value) {
      return "Indique la fecha de apertura del proceso.";
    }
    if (!form.get("fechaCierre")?.value) {
      return "Indique la fecha de cierre del proceso.";
    }
    if (form.hasError("cronogramaInsuficiente")) {
      return "El cierre debe estar al menos 3 días hábiles después de la apertura.";
    }
    if (form.get("criterioSeleccion")?.invalid) {
      return `El criterio de selección requiere al menos ${MIN_CARACTERES_CRITERIO} caracteres.`;
    }
    if (form.get("planAccion")?.invalid) {
      return `El plan de acción requiere al menos ${MIN_CARACTERES_PLAN} caracteres.`;
    }
    return "";
  }

  /** Explica el bloqueo del paso 3 (siempre: falta al menos un ítem). */
  private ayudaPaso3(): string {
    return "Agregue al menos un ítem al pliego de cotización para continuar.";
  }

  /** Explica el bloqueo del paso 4 según el primer error encontrado. */
  private ayudaPaso4(): string {
    const form = this.contratacionForm;
    if (form.get("tipoContrato")?.invalid) {
      return "Seleccione el tipo de contratación asociada.";
    }
    if (form.get("medioPago")?.invalid) {
      return "Seleccione el medio de pago autorizado por la Tesorería.";
    }
    if (form.get("formaPago")?.invalid) {
      return "Seleccione la forma de pago del contrato.";
    }
    if (form.hasError("sinParametros")) {
      return form.get("formaPago")?.value === FORMA_PAGO_CONTRAENTREGA
        ? "Registre la condición del pago único (100 %) de la contraentrega."
        : "Agregue al menos un parámetro de la forma de pago.";
    }
    if (form.hasError("pagoUnicoIncompleto")) {
      return "La contraentrega admite un único parámetro de pago al 100 %: registre solo la condición del pago final.";
    }
    if (form.hasError("sumaPorcentajes")) {
      const error = form.getError("sumaPorcentajes") as { total: number };
      return `Los porcentajes deben sumar exactamente 100 % (actual: ${error.total} %).`;
    }
    return "";
  }

  /** Explica el bloqueo del paso 5 según el primer criterio faltante. */
  private ayudaPaso5(): string {
    const form = this.proveedoresForm;
    if (form.hasError("sinActividades")) {
      return "Vincule al menos una actividad económica (CIIU).";
    }
    if (this.sniesAplicaProveedores) {
      if (!form.get("areaSnies")?.value) {
        return "Seleccione el área de conocimiento del SNIES.";
      }
      if (!form.get("nucleoSnies")?.value) {
        return "Seleccione el núcleo básico de conocimiento (NBC).";
      }
    }
    return "";
  }

  /** El paso 6 no bloquea el avance: informa el estado de la carga. */
  private ayudaPaso6(): string {
    const anexos = (this.documentosForm.get("anexos")?.value ??
      []) as readonly { estado: string }[];
    if (anexos.some((anexo) => anexo.estado === "subiendo")) {
      return "Espere a que finalice la indexación de los anexos en curso.";
    }
    return "";
  }

  /** Explica qué paso debe corregirse antes de procesar. */
  private ayudaPaso7(): string {
    const pendiente = this.validacionFinal.find(
      (validacion) => !validacion.cumple,
    );
    return pendiente
      ? `Solicitud incompleta: corrija el paso ${pendiente.paso} (${pendiente.titulo}).`
      : "";
  }

  // ── Datos del paso 7 (revisión y procesar) ───────────────────────────────

  /** Ítems cargados en el paso 3 (acordeón y lista de verificación). */
  get itemsRegistrados(): readonly ItemSolicitud[] {
    return (this.itemsForm.get("registros")?.value ??
      []) as readonly ItemSolicitud[];
  }

  /** Resumen numérico de los ítems del paso 3. */
  get resumenItems(): ReturnType<typeof resumirItems> {
    return resumirItems(this.itemsRegistrados);
  }

  /** Parámetros de pago del paso 4 (distribución porcentual). */
  get parametrosPago(): readonly ParametroPago[] {
    return (this.contratacionForm.get("parametros")?.value ??
      []) as readonly ParametroPago[];
  }

  /** Actividades CIIU vinculadas en el paso 5. */
  get actividadesVinculadas(): readonly ActividadVinculada[] {
    return (this.proveedoresForm.get("actividades")?.value ??
      []) as readonly ActividadVinculada[];
  }

  /** Anexos cargados en el paso 6. */
  get anexosCargados(): readonly AnexoSolicitud[] {
    const anexos = this.documentosForm.get("anexos")?.value as
      readonly AnexoSolicitud[] | null | undefined;
    return anexos?.length ? anexos : ANEXOS_SEMILLA;
  }

  /** Matriz de documentos del oferente del paso 6. */
  get documentosRequeridos(): readonly DocumentoOferente[] {
    const requeridos = this.documentosForm.get("requeridos")?.value as
      readonly DocumentoOferente[] | null | undefined;
    return requeridos?.length ? requeridos : DOCUMENTOS_OFERENTE_SEMILLA;
  }

  /**
   * Datos crudos de los pasos 1, 2, 4 y 5 que el acordeón del paso 7 muestra.
   *
   * El acordeón no depende de los catálogos: aquí se resuelven de una vez las
   * etiquetas legibles (medio de pago, tipo de contrato, área y núcleo SNIES) y
   * los formatos de fecha que necesita la vista de revisión.
   */
  get datosRevision(): DatosRevision {
    const contratacion = this.contratacionForm.getRawValue() as {
      tipoContrato?: string;
      medioPago?: string;
    };
    const proveedores = this.proveedoresForm.getRawValue() as {
      areaSnies?: string;
      nucleoSnies?: string;
    };
    const datosGenerales = this.datosGeneralesForm.getRawValue() as {
      dependenciaDestino?: string;
      fechaApertura?: string;
      fechaCierre?: string;
      criterioSeleccion?: string;
      planAccion?: string;
    };
    const necesidad = this.necesidadForm.getRawValue() as {
      numeroNecesidad?: string;
    };
    const cruce = this.resultadoCruce();

    const tipo = TIPOS_CONTRATO.find(
      (opcion) => opcion.valor === contratacion.tipoContrato,
    );
    // El CDP vigente es la primera disponibilidad del cruce; el valor oficial
    // lo reporta el resumen presupuestal de SICAPITAL.
    const disponibilidad = cruce?.presupuesto.disponibilidades[0];

    return {
      numeroNecesidad:
        cruce?.necesidad.valor ?? necesidad.numeroNecesidad ?? "",
      numeroCdp: disponibilidad?.numeroDisponibilidad ?? "",
      rubro: disponibilidad
        ? `${disponibilidad.rubro} - ${disponibilidad.rubroNombre}`
        : "",
      unidadEjecutora: cruce?.responsable.unidadEjecutora ?? "",
      valorCdp: cruce?.presupuesto.valorCdp
        ? formatoCop(cruce.presupuesto.valorCdp)
        : "",
      sede: cruce?.solicitud.sede ?? "",
      dependenciaDestino: this.etiquetaDependenciaDestino(
        datosGenerales.dependenciaDestino ?? "",
      ),
      fechaAperturaLarga: datosGenerales.fechaApertura
        ? formatoFechaLarga(datosGenerales.fechaApertura)
        : "",
      fechaCierreLarga: datosGenerales.fechaCierre
        ? formatoFechaLarga(datosGenerales.fechaCierre)
        : "",
      diasPlazo:
        datosGenerales.fechaApertura && datosGenerales.fechaCierre
          ? diasHabilesEntre(
              datosGenerales.fechaApertura,
              datosGenerales.fechaCierre,
              this.calendarioFestivos.fechasFestivas(),
            )
          : 0,
      // Los dos campos del paso 2 son editores de texto enriquecido: su valor
      // es HTML, así que se convierte a texto plano para la vista de revisión.
      criterioSeleccion: textoPlanoDesdeHtml(
        datosGenerales.criterioSeleccion ?? "",
      ),
      planAccion: textoPlanoDesdeHtml(datosGenerales.planAccion ?? ""),
      tipoContrato: tipo?.etiqueta ?? contratacion.tipoContrato ?? "",
      medioPago: etiquetaCorta(MEDIOS_PAGO, contratacion.medioPago ?? ""),
      areaSnies: proveedores.areaSnies ?? "",
      nucleoSnies: proveedores.nucleoSnies ?? "",
      archivoMatriz: (this.itemsForm.get("archivo")?.value as string) ?? "",
    };
  }

  /** Etiqueta de la dependencia destino (guion cuando falta el dato). */
  private etiquetaDependenciaDestino(valor: string): string {
    if (!valor) {
      return "";
    }
    return (
      DEPENDENCIAS_DESTINO.find((opcion) => opcion.valor === valor)?.etiqueta ??
      valor
    );
  }

  /** El stepper delega en este método; solo se llega a pasos alcanzados. */
  irAlPaso(paso: number): void {
    if (paso < PRIMER_PASO || paso > ULTIMO_PASO || paso > this.pasoAlcanzado) {
      return;
    }
    this.pasoActual = paso;
    if (this.esEdicion) {
      this.actualizarDiferencias();
    }
  }

  /** Avanza tras validar el paso actual. */
  continuar(): void {
    if (!this.pasoValido) {
      this.asistenteForm.markAllAsTouched();
      return;
    }
    this.pasoActual = Math.min(ULTIMO_PASO, this.pasoActual + 1);
    this.pasoAlcanzado = Math.max(this.pasoAlcanzado, this.pasoActual);
    if (this.esEdicion) {
      this.actualizarDiferencias();
      this.guardarBorradorEdicion(true);
      return;
    }
    this.guardarBorrador(true);
  }

  /** Revalida el paso 3 tras una actualización de ítems desde su componente. */
  alCambiarItems(): void {
    this.itemsForm.updateValueAndValidity();
    if (this.esEdicion) {
      this.actualizarDiferencias();
    }
  }

  /** Vuelve al paso anterior o al listado desde el paso 1. */
  regresar(): void {
    if (this.pasoActual > PRIMER_PASO) {
      this.pasoActual -= 1;
      return;
    }
    if (this.esEdicion) {
      this.abrirDescartar();
      return;
    }
    void this.router.navigate(["cotizaciones", "solicitudes"]);
  }

  /**
   * Acción del botón principal. En los pasos 1 a 6 avanza; en el paso 7 delega
   * en el componente de revisión, que abre el diálogo de confirmación.
   */
  finalizarPaso(): void {
    if (this.esEdicion) {
      // En la edición, el paso 7 tiene su propio pie (justificación y
      // guardado); la barra del asistente no ofrece "Procesar solicitud".
      if (this.pasoActual !== SEPTIMO_PASO) {
        this.continuar();
      }
      return;
    }
    if (this.pasoActual === SEPTIMO_PASO) {
      const pasoPendiente = this.pasoPendienteValidacion;
      if (pasoPendiente !== null) {
        this.pasoActual = pasoPendiente;
        this.asistenteForm
          .get(this.grupoFormularioPorPaso(pasoPendiente))
          ?.markAllAsTouched();
        const nombrePaso =
          this.pasos.find((paso) => paso.numero === pasoPendiente)?.nombre ??
          `Paso ${pasoPendiente}`;
        void this.alerta.showAlert(
          "Solicitud incompleta",
          `Corrija las validaciones pendientes de ${nombrePaso} antes de procesar.`,
        );
        return;
      }
      this.pasoRevision?.procesar();
      return;
    }
    this.continuar();
  }

  private grupoFormularioPorPaso(paso: number): string {
    switch (paso) {
      case PRIMER_PASO:
        return "necesidad";
      case SEGUNDO_PASO:
        return "datosGenerales";
      case TERCER_PASO:
        return "items";
      case CUARTO_PASO:
        return "contratacion";
      case QUINTO_PASO:
        return "proveedores";
      case SEXTO_PASO:
        return "documentos";
      default:
        return "";
    }
  }

  /** Subtítulo del botón "Procesar solicitud" (proveedores a notificar). */
  get subtituloProcesar(): string {
    const proveedores = contarProveedoresNotificados(
      this.actividadesVinculadas.length,
    );
    return proveedores ? `Enviar a ${pluralizarProveedores(proveedores)}` : "";
  }

  /** Marca la solicitud como radicada tras la confirmación del paso 7. */
  alRadicar(radicacion: ResumenRadicacion): void {
    this.revisionForm.patchValue({
      radicado: radicacion.numeroCotizacion,
      radicada: true,
    });
    this.guardarBorrador(true);
  }

  /** Sincroniza la vista del paso 7 (revisión ↔ éxito). */
  alCambiarVistaExitosa(exitosa: boolean): void {
    this.vistaExitosa.set(exitosa);
  }

  /** Navega al listado de solicitudes de cotización. */
  irAMisSolicitudes(): void {
    void this.router.navigate(["cotizaciones", "solicitudes"]);
  }

  alCambiarEstadoCruce(estado: EstadoCruce): void {
    this.estadoCruce.set(estado);
  }

  alCambiarAcuerdo(aceptado: boolean): void {
    this.acuerdoAceptado.set(aceptado);
  }

  alCambiarResultadoCruce(resultado: ResultadoCruce | null): void {
    this.resultadoCruce.set(resultado);
    // La vigencia del cruce determina el año del calendario de festivos.
    this.cargarCalendario();
  }

  guardarBorrador(automatico = false): void {
    if (this.esEdicion) {
      this.guardarBorradorEdicion(automatico);
      return;
    }

    const borrador: BorradorSolicitudNueva = {
      version: 1,
      currentStep: this.pasoActual,
      savedAt: new Date().toISOString(),
      formValue: this.asistenteForm.getRawValue() as Record<string, unknown>,
    };

    if (!this.borrador.guardar(borrador)) {
      this.estadoMensaje = "No fue posible guardar el borrador";
      this.estadoDetalle =
        "El almacenamiento del navegador no está disponible; continúe sin autoguardado.";
      return;
    }

    const hora = new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    this.estadoMensaje = automatico
      ? "Borrador de solicitud autoguardado"
      : "Borrador de solicitud guardado";
    this.estadoDetalle = `Hoy a las ${hora} · Sesión cifrada SSL 256-bit Universidad Distrital`;

    if (!automatico) {
      void this.alerta.showAlert(
        "Borrador guardado",
        "Puede cerrar el asistente y retomarlo más tarde: el avance y los datos diligenciados quedan guardados en este equipo.",
      );
    }
  }

  /** Borra el borrador restaurado y vuelve al estado inicial del paso 1. */
  descartarBorrador(): void {
    this.borrador.eliminar();
    this.asistenteForm.reset({
      necesidad: { unidadEjecutora: "", vigencia: "", numeroNecesidad: "" },
      datosGenerales: {
        dependenciaSolicitante: "",
        dependenciaDestino: "",
        fechaApertura: "",
        fechaCierre: "",
        criterioSeleccion: "",
        planAccion: "",
      },
      items: {
        modo: "individual",
        archivo: "",
        procesado: false,
        registros: [],
      },
      contratacion: {
        tipoContrato: "",
        medioPago: "",
        formaPago: "",
        parametros: [],
      },
      proveedores: { actividades: [], areaSnies: "", nucleoSnies: "" },
      documentos: { anexos: [], requeridos: [] },
      revision: { radicado: "", radicada: false },
    });

    this.pasoActual = PRIMER_PASO;
    this.pasoAlcanzado = PRIMER_PASO;
    this.estadoCruce.set("inicial");
    this.acuerdoAceptado.set(false);
    this.resultadoCruce.set(null);
    this.borradorRestaurado.set(false);
    this.estadoMensaje = "Borrador de solicitud autoguardado";
    this.estadoDetalle =
      "Los cambios se guardan automáticamente en este equipo · Sesión cifrada SSL 256-bit Universidad Distrital";
  }

  private restaurarBorrador(): void {
    const borrador = this.borrador.cargar();
    if (!borrador) {
      return;
    }

    this.asistenteForm.patchValue(borrador.formValue);
    this.pasoAlcanzado = Math.min(
      ULTIMO_PASO,
      Math.max(PRIMER_PASO, borrador.currentStep || PRIMER_PASO),
    );
    this.pasoActual = PRIMER_PASO;
    this.borradorRestaurado.set(true);

    const guardado = new Date(borrador.savedAt);
    this.estadoMensaje = "Borrador de solicitud restaurado";
    this.estadoDetalle = isNaN(guardado.getTime())
      ? "Última edición desconocida · Sesión cifrada SSL 256-bit"
      : `Última edición: ${guardado.toLocaleString("es-CO")} · Sesión cifrada SSL 256-bit`;
  }
}
