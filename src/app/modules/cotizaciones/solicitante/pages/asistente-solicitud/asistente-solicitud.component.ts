import {
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { debounceTime } from "rxjs";
import { AlertService } from "src/app/shared/services/alert.service";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import {
  BorradorSolicitudNueva,
  BorradorSolicitudService,
} from "../../../services/borrador-solicitud.service";
import { CalendarioFestivosService } from "../../../services/calendario-festivos.service";
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
          validators: validadorCronograma(
            () => this.calendarioFestivos.fechasFestivas(),
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

    // Se restaura en el constructor para que los valores ya estén puestos
    // antes de que el paso 1 se instancie y dispare el cruce.
    this.restaurarBorrador();
  }

  ngOnInit(): void {
    this.asistenteForm.valueChanges
      .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.guardarBorrador(true));

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
   * Habilita "Continuar": el paso 1 avanza cuando la necesidad es válida, el
   * cruce terminó bien y el acuerdo marco está aceptado (cuando aplica); el
   * paso 2, cuando su formulario (dependencias, cronograma y editores) es válido.
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
      return !!this.datosGeneralesForm.valid;
    }
    if (this.pasoActual === TERCER_PASO) {
      return !!this.itemsForm.valid;
    }
    if (this.pasoActual === CUARTO_PASO) {
      return !!this.contratacionForm.valid;
    }
    if (this.pasoActual === QUINTO_PASO) {
      return this.proveedoresCompleto;
    }
    if (this.pasoActual === SEXTO_PASO) {
      // El paso 6 no exige validaciones: el diseño no marca documentos
      // obligatorios en la solicitud (ambos bloques figuran "Por definir").
      return true;
    }
    if (this.pasoActual === SEPTIMO_PASO) {
      // El paso 7 no valida campos: el botón habilita la confirmación del
      // procesamiento (el propio diálogo advierte su carácter vinculante).
      return true;
    }
    return false;
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

  /** El paso 7 no bloquea el avance: la confirmación la hace el diálogo. */
  private ayudaPaso7(): string {
    return "";
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
      | readonly AnexoSolicitud[]
      | null
      | undefined;
    return anexos?.length ? anexos : ANEXOS_SEMILLA;
  }

  /** Matriz de documentos del oferente del paso 6. */
  get documentosRequeridos(): readonly DocumentoOferente[] {
    const requeridos = this.documentosForm.get("requeridos")?.value as
      | readonly DocumentoOferente[]
      | null
      | undefined;
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
      numeroNecesidad: cruce?.necesidad.valor ?? necesidad.numeroNecesidad ?? "",
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
  }

  /** Avanza tras validar el paso 1 (los demás pasos no avanzan aún). */
  continuar(): void {
    if (!this.pasoValido) {
      this.asistenteForm.markAllAsTouched();
      return;
    }
    this.pasoActual = Math.min(ULTIMO_PASO, this.pasoActual + 1);
    this.pasoAlcanzado = Math.max(this.pasoAlcanzado, this.pasoActual);
    this.guardarBorrador(true);
  }

  /** Vuelve al paso anterior o al listado desde el paso 1. */
  regresar(): void {
    if (this.pasoActual > PRIMER_PASO) {
      this.pasoActual -= 1;
      return;
    }
    void this.router.navigate(["cotizaciones", "solicitudes"]);
  }

  /**
   * Acción del botón principal. En los pasos 1 a 6 avanza; en el paso 7 delega
   * en el componente de revisión, que abre el diálogo de confirmación.
   */
  finalizarPaso(): void {
    if (this.pasoActual === SEPTIMO_PASO) {
      this.pasoRevision?.procesar();
      return;
    }
    this.continuar();
  }

  /** Subtítulo del botón "Procesar solicitud" (proveedores a notificar). */
  get subtituloProcesar(): string {
    const proveedores = contarProveedoresNotificados(
      this.actividadesVinculadas.length,
    );
    return proveedores
      ? `Enviar a ${pluralizarProveedores(proveedores)}`
      : "";
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
