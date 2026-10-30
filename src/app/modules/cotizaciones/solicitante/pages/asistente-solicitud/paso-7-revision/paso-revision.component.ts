import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { formatoFechaCorta } from "../../../../models/datos-generales.model";
import {
  AcordeonRevision,
  ArchivoRevision,
  HASH_RADICADO_MOCK,
  LIBRO_RADICADO_MOCK,
  RequisitoRevision,
  ResumenRadicacion,
  contarProveedoresNotificados,
  formatoFechaHoraRadicacion,
  hashAbreviado,
  numeroRadicado,
  pluralizarOferentes,
  pluralizarProveedores,
} from "../../../../models/revision.model";
import type { ItemVerificacion } from "../../../../models/revision.model";
import {
  ETIQUETAS_TIPO_NECESIDAD,
  ItemSolicitud,
  ResumenItems,
  formatoTamano,
} from "../../../../models/items.model";
import { ParametroPago } from "../../../../models/contratacion.model";
import {
  AREAS_SNIES,
  ActividadVinculada,
  NUCLEOS_SNIES,
  ResumenSolicitudProveedores,
  etiquetaTipoNecesidad,
} from "../../../../models/proveedores.model";
import {
  AnexoSolicitud,
  DocumentoOferente,
  ETIQUETA_FORMATOS,
  TAMANO_MAX_MB,
  etiquetaClasificacion,
} from "../../../../models/documentos.model";
import { AlertService } from "src/app/shared/services/alert.service";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import {
  justificacionMinima,
  MIN_CARACTERES_JUSTIFICACION,
} from "src/app/shared/validators/justificacion.validator";
import { CalendarioFestivosService } from "../../../../services/calendario-festivos.service";
import type {
  ModoEdicionSolicitud,
  ResumenDiferencias,
} from "../../../../models/edicion-solicitud.model";
import { DialogoProcesarComponent } from "./components/dialogo-procesar/dialogo-procesar.component";
import {
  DialogoConfirmarModificacionComponent,
  type DialogoConfirmarModificacionDatos,
} from "./components/dialogo-confirmar-modificacion/dialogo-confirmar-modificacion.component";

/** Segundos que tarda la radicación simulada antes de mostrar el éxito. */
const ESPERA_RADICACION = 1200;

/**
 * Mínimo de caracteres (texto plano) de la justificación de la edición.
 *
 * Es provisional: el mockup de S-04 deja las reglas de trazabilidad de cambios
 * (RF-016) como "por definir", así que se adopta el mínimo de S-02 para los
 * textos largos.
 */
export const MIN_JUSTIFICACION_EDICION = MIN_CARACTERES_JUSTIFICACION;

/**
 * Paso 7 del asistente: "Revisión y procesar".
 *
 * El paso no captura datos: consolida en modo lectura lo diligenciado en los
 * pasos 1 a 6 (acordeones), verifica la completitud del expediente (lista de
 * verificación) y ejecuta la radicación formal. El componente cubre las dos
 * vistas del mockup aprobado:
 *
 * - **Revisión**: banner + acordeones de resumen + checklist lateral.
 * - **Confirmación de éxito**: pantalla de radicación, con el consecutivo
 *   oficial, el tomo y folio del Libro Digital y el hash SHA-256 simulado.
 *
 * El acordeón de cada paso y la lista de verificación viven en componentes
 * hijos; este componente solo compone y deriva los datos.
 */
@Component({
  selector: "paso-revision",
  templateUrl: "./paso-revision.component.html",
  styleUrls: ["./paso-revision.component.scss"],
  standalone: false,
})
export class PasoRevisionComponent {
  /** Resumen de solo lectura que arma el asistente con los pasos 1 a 6. */
  @Input() resumen: ResumenSolicitudProveedores | null = null;

  /** Registros del paso 3 (ítems) para el acordeón de bienes y servicios. */
  @Input() items: readonly ItemSolicitud[] = [];

  /** Resumen numérico de los ítems (lo calcula el asistente). */
  @Input() resumenItems: ResumenItems | null = null;

  /** Parámetros de pago del paso 4 (distribución porcentual). */
  @Input() parametrosPago: readonly ParametroPago[] = [];

  /** Actividades CIIU vinculadas en el paso 5. */
  @Input() actividades: readonly ActividadVinculada[] = [];

  /** Anexos cargados en el paso 6. */
  @Input() anexos: readonly AnexoSolicitud[] = [];

  /** Matriz de documentos del oferente del paso 6. */
  @Input() documentos: readonly DocumentoOferente[] = [];

  /** Valores crudos de los pasos 1 y 4 que alimentan los acordeones. */
  @Input() datosRevision: DatosRevision = datosRevisionVacios();

  /** Validación final calculada por el asistente y compartida con el proceso. */
  @Input() verificacionFinal: readonly ItemVerificacion[] = [];

  /**
   * true cuando la solicitud ya fue radicada en una sesión anterior (borrador).
   * Arranca la vista de éxito; al ser un borrador, el asistente lo persiste.
   */
  @Input() set yaRadicada(valor: boolean) {
    this.completado.set(valor);
  }

  /** Pide al asistente volver al paso indicado para corregirlo. */
  @Output() editarPaso = new EventEmitter<number>();

  /** Notifica que la solicitud quedó radicada (para el estado del asistente). */
  @Output() radicada = new EventEmitter<ResumenRadicacion>();

  /** Pide al asistente volver al listado de solicitudes. */
  @Output() irAMisSolicitudes = new EventEmitter<void>();

  /*
   * ── Edición de una solicitud existente (S-04) ───────────────────────────
   *
   * El paso 7 es el punto de guardado de la edición: muestra las diferencias
   * calculadas por el asistente, exige la justificación del cambio y ejecuta
   * el guardado. En la creación estos inputs llegan en sus valores por defecto
   * y la vista no cambia.
   */

  /** Modo de edición habilitado por el estado; `null` en la creación. */
  @Input() modoEdicion: ModoEdicionSolicitud | null = null;

  /** Cambios contra la versión guardada (los calcula el asistente). */
  @Input() diferencias: ResumenDiferencias = { grupos: [], total: 0 };

  /** Pasos que admiten cambios en el modo de edición actual. */
  @Input() pasosEditables: readonly number[] = [];

  /** true mientras el asistente persiste la edición. */
  @Input() guardando = false;

  /** Error del último intento de guardado (vacío = sin error). */
  @Input() errorGuardado = "";

  /** true cuando no hay diferencias contra la versión guardada. */
  @Input() sinCambios = false;

  /** true cuando el asistente autoriza el guardado (validaciones de pasos). */
  @Input() puedeGuardar = false;

  /** Motivo por el que el asistente bloquea el guardado. */
  @Input() ayudaGuardar = "";

  /** Número visible de la solicitud editada. */
  @Input() solicitudId = "";

  /** Versión vigente del expediente ("v1.0"). */
  @Input() versionActual = "v1.0";

  /** Pide al asistente guardar la edición. */
  @Output() guardarEdicion = new EventEmitter<void>();

  /** Pide al asistente confirmar el descarte de los cambios. */
  @Output() descartarEdicion = new EventEmitter<void>();

  /**
   * Notifica el cambio de vista del paso (revisión ↔ éxito).
   *
   * El asistente lo usa para mostrar u ocultar la barra de acciones: en la
   * vista de éxito el expediente ya está radicado y no admite más avance.
   */
  @Output() vistaExitosa = new EventEmitter<boolean>();

  private readonly dialog = inject(MatDialog);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Calendario de días festivos (raíz del inyector).
   *
   * Sólo se consulta para avisar cuando el plazo en días hábiles se calculó
   * sin el calendario oficial.
   */
  private readonly calendario = inject(CalendarioFestivosService);

  /** Temporizadores pendientes (radicación y acuse de copia). */
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();

  /** true cuando la radicación ya se completó: se muestra la vista de éxito. */
  readonly completado = signal(false);

  /** true mientras se anuncia que el radicado se copió al portapapeles. */
  readonly copiado = signal(false);

  /** Momento en que se radicó la solicitud (para el resumen de éxito). */
  readonly fechaRadicacion = signal<Date | null>(null);

  /*
   * ── Edición de una solicitud existente (S-04) ────────────────────────────
   */

  /** Mínimo de caracteres de la justificación, expuesto a la plantilla. */
  readonly minimoJustificacion = MIN_JUSTIFICACION_EDICION;

  /**
   * Justificación de la modificación.
   *
   * Se declara siempre para que el componente conserve una sola forma; solo se
   * pinta y se valida en el modo edición.
   */
  readonly justificacion = new FormControl("", {
    nonNullable: true,
    validators: [
      Validators.required,
      justificacionMinima(MIN_JUSTIFICACION_EDICION),
    ],
  });

  /** true mientras se dialoga la confirmación (evita dobles aperturas). */
  private readonly dialogando = signal(false);

  constructor() {
    // Los temporizadores de la radicación y del acuse de copia se cancelan
    // si el usuario abandona el paso antes de que terminen.
    this.destroyRef.onDestroy(() => {
      for (const temporizador of this.temporizadores) {
        clearTimeout(temporizador);
      }
      this.temporizadores.clear();
    });
  }

  // ── Vistas derivadas ─────────────────────────────────────────────────────

  /** Los seis acordeones de resumen (pasos 1 a 6). */
  readonly acordeones = computed<readonly AcordeonRevision[]>(() => [
    this.acordeonPaso1(),
    this.acordeonPaso2(),
    this.acordeonPaso3(),
    this.acordeonPaso4(),
    this.acordeonPaso5(),
    this.acordeonPaso6(),
  ]);

  /**
   * true cuando el plazo en días hábiles se calculó sin el calendario de
   * festivos (la consulta al calendario no pudo completarse).
   */
  readonly calendarioDegradado = computed(() => this.calendario.degradado());

  /** true solo cuando el asistente confirma todos los criterios finales. */
  get verificacionCompleta(): boolean {
    return (
      this.verificacionFinal.length > 0 &&
      this.verificacionFinal.every((item) => item.cumple)
    );
  }

  // ── Edición (S-04) ───────────────────────────────────────────────────────

  /** true cuando el paso 7 forma parte de una edición. */
  get esEdicion(): boolean {
    return this.modoEdicion !== null;
  }

  /** true en una modificación restringida (solicitud ya enviada). */
  get esRestringida(): boolean {
    return this.modoEdicion === "restringida";
  }

  /** Etiqueta del modo de edición, visible en el banner. */
  get modoEtiqueta(): string {
    return this.esRestringida
      ? "Modificación restringida"
      : "Edición de borrador";
  }

  /** Título del banner cuando se modifica una solicitud. */
  get tituloBannerEdicion(): string {
    return this.solicitudId
      ? `Modificar solicitud N.° ${this.solicitudId}`
      : "Modificar solicitud";
  }

  /** Texto de apoyo del banner cuando se modifica una solicitud. */
  get descripcionBannerEdicion(): string {
    return this.esRestringida
      ? "La solicitud ya fue enviada a proveedores: solo se modifican los ítems y la fecha de cierre. El cambio queda pendiente de aprobación."
      : "Está editando un borrador. Los cambios no se envían a proveedores hasta que procese la solicitud; puede regresar en cualquier momento sin perder lo editado.";
  }

  /** Etiqueta del botón de guardado de la edición. */
  get tituloGuardar(): string {
    return this.esRestringida ? "Solicitar modificación" : "Guardar cambios";
  }

  /** Icono del botón de guardado de la edición. */
  get iconoGuardar(): string {
    return this.esRestringida ? "send" : "save";
  }

  /** true si el botón de guardado de la edición está bloqueado. */
  get guardadoDeshabilitado(): boolean {
    if (this.guardando) {
      return true;
    }
    // Sin cambios se permite pulsar: el asistente explica que la solicitud no
    // se modifica. Es el único caso en el que no se exige justificación.
    if (this.sinCambios) {
      return false;
    }
    return !this.puedeGuardar || this.justificacion.invalid;
  }

  /** Explica por qué el guardado de la edición está bloqueado. */
  get ayudaGuardado(): string {
    if (this.guardando) {
      return "Guardando los cambios de la solicitud…";
    }
    if (this.sinCambios) {
      return "No hay cambios respecto de la versión guardada: al pulsar se indicará que la solicitud no se modifica.";
    }
    if (!this.puedeGuardar) {
      return this.ayudaGuardar;
    }
    if (this.justificacion.invalid) {
      return `Escriba una justificación de al menos ${MIN_JUSTIFICACION_EDICION} caracteres.`;
    }
    return "";
  }

  /** true cuando el error de la justificación debe mostrarse. */
  get justificacionInvalida(): boolean {
    return this.justificacion.invalid && this.justificacion.touched;
  }

  /** true si el paso admite cambios (siempre en la creación). */
  pasoEditable(numero: number): boolean {
    return !this.esEdicion || this.pasosEditables.includes(numero);
  }

  /** Marca la justificación como tocada al salir del editor. */
  alSalirJustificacion(): void {
    this.justificacion.markAsTouched();
  }

  /** Guarda la edición si la justificación y las validaciones lo permiten. */
  guardar(): void {
    if (!this.esEdicion || this.guardando || this.dialogando()) {
      return;
    }

    // Sin cambios no se pide justificación: el asistente muestra el aviso de
    // que la solicitud permanece igual.
    if (this.sinCambios) {
      this.justificacion.markAsUntouched();
      this.guardarEdicion.emit();
      return;
    }

    this.justificacion.markAsTouched();
    if (!this.puedeGuardar || this.justificacion.invalid) {
      return;
    }

    // La modificación de una solicitud enviada es una solicitud formal: se
    // confirma en un diálogo con el detalle de los cambios y la justificación.
    if (this.esRestringida) {
      this.confirmarModificacion();
      return;
    }

    this.guardarEdicion.emit();
  }

  /**
   * Abre la confirmación de la modificación restringida (S-04).
   *
   * El diálogo resume los cambios que se enviarán, muestra la justificación
   * registrada y exige el reconocimiento de que la propuesta queda pendiente
   * de aprobación. Solo al confirmar se delega el guardado en el asistente;
   * cancelar conserva el formulario intacto. El progreso posterior se muestra
   * en el pie de este mismo paso.
   */
  private confirmarModificacion(): void {
    if (this.dialogando()) {
      return;
    }
    this.dialogando.set(true);

    this.dialog
      .open<
        DialogoConfirmarModificacionComponent,
        DialogoConfirmarModificacionDatos,
        boolean
      >(DialogoConfirmarModificacionComponent, {
        data: {
          solicitudId: this.solicitudId,
          versionActual: this.versionActual,
          diferencias: this.diferencias,
          justificacion: textoPlanoDesdeHtml(this.justificacion.value).trim(),
        },
        width: "640px",
        maxWidth: "96vw",
        autoFocus: ".dialogo__seguir",
        restoreFocus: true,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        this.dialogando.set(false);
        if (confirmado === true) {
          this.guardarEdicion.emit();
        }
      });
  }

  /** Pide confirmar el descarte de los cambios de la edición. */
  descartar(): void {
    if (this.guardando) {
      return;
    }
    this.descartarEdicion.emit();
  }

  /** Resumen institucional que alimenta el modal y la vista de éxito. */
  readonly radicacion = computed<ResumenRadicacion>(() => ({
    numeroCotizacion: this.numeroCotizacion,
    vigencia: this.resumen?.vigencia || "2026",
    objeto: this.resumen?.objeto || "—",
    proveedoresNotificados: this.proveedoresNotificados,
    itemsClasificados: `${this.itemsResumen.totalItems} ítems (${this.etiquetaNecesidad})`,
    cierreOfertas: this.cierreCorto || "—",
    presupuesto: this.presupuestoTexto,
    numeroCdp: this.datosRevision.numeroCdp || "—",
    unidadEjecutora: this.resumen?.unidadEjecutora || "—",
    sede: this.datosRevision.sede || "Sede Aduanilla de Paiba",
    plazoRecepcion: this.cierreCorto
      ? `Hasta el ${this.cierreLargo} (17:00 COT)`
      : "Por definir",
    diasHabilesRestantes: this.diasPlazo,
  }));

  /** Fecha y hora de radicación ya formateada (vista de éxito). */
  readonly fechaRadicacionTexto = computed(() => {
    const fecha = this.fechaRadicacion();
    return fecha ? formatoFechaHoraRadicacion(fecha) : "—";
  });

  /** Hash abreviado del certificado de radicación. */
  readonly hashAbreviado = computed(() => hashAbreviado(HASH_RADICADO_MOCK));

  /** Tomo y folio del Libro Digital Oficial. */
  readonly libroOficial = LIBRO_RADICADO_MOCK;

  /** Etiqueta "12 proveedores" reutilizable en la vista de éxito. */
  readonly proveedoresTexto = computed(() =>
    pluralizarProveedores(this.proveedoresNotificados),
  );

  /** Etiqueta "12 oferentes" del resumen institucional de radicación. */
  readonly oferentesTexto = computed(() =>
    pluralizarOferentes(this.proveedoresNotificados),
  );

  // ── Acciones ─────────────────────────────────────────────────────────────

  /** Vuelve al paso que el usuario quiere corregir. */
  alEditar(numero: number): void {
    if (!this.pasoEditable(numero)) {
      return;
    }
    this.editarPaso.emit(numero);
  }

  /** Abre el diálogo de confirmación y, si se acepta, radica la solicitud. */
  procesar(): void {
    if (this.dialogando() || !this.verificacionCompleta) {
      return;
    }
    this.dialogando.set(true);
    this.dialog
      .open(DialogoProcesarComponent, {
        data: { resumen: this.radicacion() },
        width: "560px",
        maxWidth: "96vw",
        autoFocus: ".dialogo__procesar",
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        this.dialogando.set(false);
        if (confirmado === true) {
          this.radicar();
        }
      });
  }

  /** Nuevo procesamiento tras consultar el expediente radicado. */
  reiniciarVista(): void {
    this.completado.set(false);
    this.fechaRadicacion.set(null);
    this.vistaExitosa.emit(false);
  }

  /** Copia el consecutivo de radicación al portapapeles (con acuse visual). */
  copiarRadicado(): void {
    const numero = this.radicacion().numeroCotizacion;
    const portapapeles = navigator.clipboard;
    if (!portapapeles) {
      this.alerta.showAlert(
        "Copia no disponible",
        `El navegador no permite copiar automáticamente. Radicado oficial: ${numero}.`,
      );
      return;
    }
    void portapapeles.writeText(numero).then(() => {
      this.copiado.set(true);
      this.temporizadores.add(setTimeout(() => this.copiado.set(false), 2000));
    });
  }

  /** Simula la descarga del PDF de la solicitud radicada. */
  descargarSolicitud(): void {
    this.alerta.showAlert(
      "Descarga en preparación",
      "El PDF de la solicitud se generará cuando el gestor documental institucional esté conectado.",
    );
  }

  /** Etiquetas de las coincidencias que se notificaron tras la radicación. */
  readonly etiquetasNotificacion = computed<readonly string[]>(() => {
    const etiquetas = this.actividades
      .slice(0, 2)
      .map(
        (actividad) => `CIIU ${actividad.codigo} (${actividad.descripcion})`,
      );
    return [...etiquetas, "Certificado RUP vigente"];
  });

  // ── Datos derivados ──────────────────────────────────────────────────────

  private get numeroCotizacion(): string {
    return numeroRadicado(this.resumen?.numeroCotizacion ?? "");
  }

  private get proveedoresNotificados(): number {
    // El banco de proveedores institucional habilita doce empresas; si el
    // paso 5 no dejó actividades no hay notificación que anunciar.
    return contarProveedoresNotificados(this.actividades.length);
  }

  private get itemsResumen(): ResumenItems {
    if (this.resumenItems) {
      return this.resumenItems;
    }
    return {
      totalItems: this.items.length,
      totalCantidad: 0,
      bienes: 0,
      servicios: 0,
      tipo: "bienes",
    };
  }

  private get etiquetaNecesidad(): string {
    return etiquetaTipoNecesidad(this.resumen?.tipoNecesidad ?? "bienes");
  }

  private get diasPlazo(): number {
    return this.datosRevision.diasPlazo;
  }

  private get presupuestoTexto(): string {
    return this.datosRevision.valorCdp
      ? `${this.datosRevision.valorCdp} COP`
      : "Por definir";
  }

  private get cierreCorto(): string {
    const cierre = this.resumen?.fechaCierre;
    return cierre ? formatoFechaCorta(cierre) : "";
  }

  private get cierreLargo(): string {
    return this.datosRevision.fechaCierreLarga;
  }

  /** Ejecuta la radicación simulada y publica la vista de éxito. */
  private radicar(): void {
    const fecha = new Date();
    this.temporizadores.add(
      setTimeout(() => {
        this.fechaRadicacion.set(fecha);
        this.completado.set(true);
        this.vistaExitosa.emit(true);
        this.radicada.emit(this.radicacion());
      }, ESPERA_RADICACION),
    );
  }

  // ── Construcción de los acordeones ───────────────────────────────────────

  private acordeonPaso1(): AcordeonRevision {
    const datos = this.datosRevision;
    return {
      numero: 1,
      icono: "account_balance_wallet",
      titulo: "Paso 1: Necesidad y Presupuesto",
      descripcion:
        "Soporte financiero presupuestal y registro presupuestal unificado",
      chip: {
        texto: "Verificado SICAPITAL",
        icono: "check_circle",
        tono: "vino",
      },
      campos: [
        {
          etiqueta: "N.° de necesidad",
          valor: datos.numeroNecesidad || "—",
          tipo: "codigo",
        },
        {
          etiqueta: "Certificado de disponibilidad (CDP)",
          valor: datos.numeroCdp
            ? `${datos.numeroCdp} (${datos.valorCdp})`
            : "—",
          tipo: "codigo",
        },
        {
          etiqueta: "Rubro presupuestal",
          valor: datos.rubro || "—",
        },
        {
          etiqueta: "Unidad ejecutora",
          valor: datos.unidadEjecutora
            ? `${datos.unidadEjecutora}${datos.sede ? ` (${datos.sede})` : ""}`
            : "—",
        },
      ],
      abierto: true,
    };
  }

  private acordeonPaso2(): AcordeonRevision {
    const datos = this.datosRevision;
    return {
      numero: 2,
      icono: "event",
      titulo: "Paso 2: Datos Generales y Cronograma",
      descripcion:
        "Dependencias solicitantes, plazos perentorios y criterios de adjudicación",
      campos: [
        {
          etiqueta: "Dependencia solicitante",
          valor: this.resumen?.dependenciaSolicitante || "—",
        },
        {
          etiqueta: "Dependencia destino",
          valor: datos.dependenciaDestino || "—",
        },
        {
          etiqueta: "Fecha de apertura",
          valor: this.aperturaLarga || "—",
          tipo: "fecha",
        },
        {
          etiqueta: "Fecha de cierre",
          valor: this.cierreLargo || "—",
          tipo: "fecha",
        },
        {
          etiqueta: "Término de respuesta",
          valor: datos.diasPlazo ? `${datos.diasPlazo} días hábiles` : "—",
        },
        {
          etiqueta: "Criterio de selección",
          valor: datos.criterioSeleccion || "—",
        },
        {
          etiqueta: "Plan anual de adquisiciones",
          valor: datos.planAccion || "—",
          tipo: "destacado",
        },
      ],
      abierto: true,
    };
  }

  private acordeonPaso3(): AcordeonRevision {
    const resumen = this.itemsResumen;
    return {
      numero: 3,
      icono: "inventory_2",
      titulo: "Paso 3: Bienes y Servicios a Cotizar",
      descripcion:
        "Desglose de especificaciones técnicas, cantidades y plantilla validada",
      chip: {
        texto: `${resumen.totalItems} ítems`,
        icono: "list_alt",
        tono: "neutro",
      },
      campos: [
        {
          etiqueta: "Naturaleza de la solicitud",
          valor: ETIQUETAS_TIPO_NECESIDAD[resumen.tipo],
          tipo: "destacado",
        },
      ],
      etiquetas: [
        `${resumen.bienes} bienes tecnológicos de cómputo`,
        `${resumen.servicios} servicios conexos (instalación y configuración)`,
      ],
      plantilla: this.datosRevision.archivoMatriz
        ? {
            nombre: this.datosRevision.archivoMatriz,
            estado: "Validación exitosa (100% homologado)",
          }
        : undefined,
    };
  }

  private acordeonPaso4(): AcordeonRevision {
    const datos = this.datosRevision;
    return {
      numero: 4,
      icono: "payments",
      titulo: "Paso 4: Tipo de Contratación y Forma de Pago",
      descripcion: "Modalidad contractual, periodicidad de giros y desembolsos",
      campos: [
        { etiqueta: "Modalidad de contrato", valor: datos.tipoContrato || "—" },
        { etiqueta: "Medio de pago", valor: datos.medioPago || "—" },
      ],
      desembolsos: this.parametrosPago.map(
        (parametro, indice) =>
          `Giro ${indice + 1}: ${parametro.porcentaje}% (${parametro.condicion})`,
      ),
    };
  }

  private acordeonPaso5(): AcordeonRevision {
    const nucleo = this.nucleoSnies;
    return {
      numero: 5,
      icono: "group",
      titulo: "Paso 5: Proveedores Objetivo",
      descripcion:
        "Clasificación CIIU, áreas SNIES y padrón habilitado para remisión",
      chip: {
        texto: `${this.proveedoresNotificados} habilitados`,
        icono: "groups",
        tono: "vino",
      },
      campos: [
        {
          etiqueta: "Área de conocimiento / NBC",
          valor: this.areaNbcTexto || "—",
        },
        {
          etiqueta: "Impacto de la convocatoria",
          valor: this.proveedoresNotificados
            ? `${this.proveedoresNotificados} empresas notificadas automáticamente vía ÁGORA`
            : "Sin proveedores por notificar",
          tipo: "destacado",
        },
      ],
      codigos: this.actividades.map(
        (actividad) => `${actividad.codigo} - ${actividad.descripcion}`,
      ),
    };
  }

  private acordeonPaso6(): AcordeonRevision {
    return {
      numero: 6,
      icono: "folder_open",
      titulo: "Paso 6: Documentos y Anexos Requeridos",
      descripcion:
        "Soportes oficiales cargados y checklist exigible al oferente",
      campos: [
        {
          etiqueta: "Formatos y tamaño admitido",
          valor: `${ETIQUETA_FORMATOS} (hasta ${TAMANO_MAX_MB} MB por archivo)`,
        },
      ],
      archivos: this.archivosRevision(),
      requisitos: this.requisitosRevision(),
    };
  }

  // ── Apoyo ────────────────────────────────────────────────────────────────

  private archivosRevision(): readonly ArchivoRevision[] {
    if (this.anexos.length > 0) {
      return this.anexos
        .filter((anexo) => anexo.estado !== "error")
        .map((anexo) => ({
          nombre: anexo.nombre,
          peso: formatoTamano(anexo.pesoBytes),
          icono: anexo.icono,
        }));
    }
    return [];
  }

  private requisitosRevision(): readonly RequisitoRevision[] {
    return this.documentos.map((documento) => ({
      nombre: documento.nombre,
      clasificacion: etiquetaClasificacion(documento.clasificacion),
      obligatorio: documento.clasificacion === "obligatorio",
    }));
  }

  private get aperturaLarga(): string {
    return this.datosRevision.fechaAperturaLarga;
  }

  private get nucleoSnies(): string {
    return this.datosRevision.nucleoSnies;
  }

  private get areaNbcTexto(): string {
    const area = this.datosRevision.areaSnies;
    const nucleo = this.datosRevision.nucleoSnies;
    if (!area && !nucleo) {
      return "";
    }
    const areaTexto =
      AREAS_SNIES.find((opcion) => opcion.valor === area)?.etiqueta ?? area;
    const nucleoTexto =
      NUCLEOS_SNIES.find((opcion) => opcion.valor === nucleo)?.etiqueta ??
      nucleo;
    return nucleo ? `${areaTexto} / ${nucleoTexto}` : areaTexto;
  }
}

/**
 * Datos crudos de los pasos 1, 2, 4 y 5 que el asistente entrega al paso 7.
 *
 * Se pasan ya resueltos (etiquetas legibles incluidas) para que el acordeón no
 * dependa de los catálogos del resto del asistente.
 */
export interface DatosRevision {
  readonly numeroNecesidad: string;
  readonly numeroCdp: string;
  readonly rubro: string;
  readonly unidadEjecutora: string;
  readonly valorCdp: string;
  readonly sede: string;
  readonly dependenciaDestino: string;
  readonly fechaAperturaLarga: string;
  readonly fechaCierreLarga: string;
  readonly diasPlazo: number;
  readonly criterioSeleccion: string;
  readonly planAccion: string;
  readonly tipoContrato: string;
  readonly medioPago: string;
  readonly areaSnies: string;
  readonly nucleoSnies: string;
  readonly archivoMatriz: string;
}

/** Datos de revisión vacíos (estado inicial del asistente). */
export function datosRevisionVacios(): DatosRevision {
  return {
    numeroNecesidad: "",
    numeroCdp: "",
    rubro: "",
    unidadEjecutora: "",
    valorCdp: "",
    sede: "",
    dependenciaDestino: "",
    fechaAperturaLarga: "",
    fechaCierreLarga: "",
    diasPlazo: 0,
    criterioSeleccion: "",
    planAccion: "",
    tipoContrato: "",
    medioPago: "",
    areaSnies: "",
    nucleoSnies: "",
    archivoMatriz: "",
  };
}
