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
import { MatDialog } from "@angular/material/dialog";
import { formatoFechaCorta } from "../../../../models/datos-generales.model";
import {
  AcordeonRevision,
  ArchivoRevision,
  HASH_RADICADO_MOCK,
  ItemVerificacion,
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
  listarCodigos,
} from "../../../../models/proveedores.model";
import {
  AnexoSolicitud,
  DocumentoOferente,
  ETIQUETA_FORMATOS,
  TAMANO_MAX_MB,
  etiquetaClasificacion,
} from "../../../../models/documentos.model";
import { AlertService } from "src/app/shared/services/alert.service";
import { CalendarioFestivosService } from "../../../../services/calendario-festivos.service";
import { DialogoProcesarComponent } from "./components/dialogo-procesar/dialogo-procesar.component";

/** Segundos que tarda la radicación simulada antes de mostrar el éxito. */
const ESPERA_RADICACION = 1200;

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

  /** Criterios de la lista de verificación institucional. */
  readonly verificacion = computed<readonly ItemVerificacion[]>(() => {
    const items = this.itemsResumen;
    const proveedores = this.proveedoresNotificados;
    const codigos = this.codigosCiiu;
    const parametros = this.parametrosPago;
    return [
      {
        titulo: "Presupuesto asociado",
        detalle: "CDP vigente sincronizado con SICAPITAL",
        cumple: !!this.resumen?.numeroCotizacion,
      },
      {
        titulo: "Cronograma válido",
        detalle: `Plazo mínimo legal cumplido${this.diasPlazo ? ` (${this.diasPlazo} días)` : ""}`,
        cumple: !!this.resumen?.fechaCierre,
      },
      {
        titulo: "Al menos un ítem registrado",
        detalle: `${items.totalItems} ítems cargados exitosamente`,
        cumple: items.totalItems > 0,
      },
      {
        titulo: "Forma de pago al 100%",
        detalle: "Consolidado financiero balanceado",
        cumple: this.sumaPagos === 100,
      },
      {
        titulo: "Al menos una actividad CIIU",
        detalle: codigos
          ? `${codigos.split(",").length} códigos clasificados correctamente`
          : "Sin códigos clasificados",
        cumple: !!codigos,
      },
      {
        titulo: "Proveedores identificados (>0)",
        detalle: `${pluralizarProveedores(proveedores)} activos en banco UD`,
        cumple: proveedores > 0,
      },
      {
        titulo: "Documentos requeridos definidos",
        detalle: "Matriz de oferente parametrizada",
        cumple: this.documentos.length > 0,
      },
    ];
  });

  /** true cuando todos los criterios se cumplen. */
  readonly verificacionCompleta = computed(() =>
    this.verificacion().every((item) => item.cumple),
  );

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
    this.editarPaso.emit(numero);
  }

  /** Abre el diálogo de confirmación y, si se acepta, radica la solicitud. */
  procesar(): void {
    if (this.dialogando()) {
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
      this.temporizadores.add(
        setTimeout(() => this.copiado.set(false), 2000),
      );
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
      .map((actividad) => `CIIU ${actividad.codigo} (${actividad.descripcion})`);
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

  private get codigosCiiu(): string {
    return listarCodigos(this.actividades);
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

  private get sumaPagos(): number {
    return this.parametrosPago.reduce(
      (total, parametro) => total + parametro.porcentaje,
      0,
    );
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
      descripcion:
        "Modalidad contractual, periodicidad de giros y desembolsos",
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
