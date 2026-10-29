import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, debounceTime } from "rxjs";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { ImplicitAutenticationService } from "src/app/core/services/implicit_autentication.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type {
  DetalleInvitacionProveedor,
  SolicitudDetalleProveedor,
} from "../../../models/invitacion-proveedor.model";
import {
  calcularTotalesRespuesta,
  ItemRespuestaProveedor,
  ModalidadCotizacion,
  RespuestaProveedor,
  TipoIvaOferta,
} from "../../../models/respuesta-proveedor.model";
import type { ItemSolicitud } from "../../../models/items.model";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import { BorradorRespuestaService } from "../../../services/borrador-respuesta.service";
import { RespuestaProveedorService } from "../../../services/respuesta-proveedor.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "../detalle-solicitud/detalle-proveedor.resolver";
import {
  DialogoDescartarComponent,
  DialogoDescartarDatos,
  ResultadoDescartar,
} from "../../../components/dialogo-descartar/dialogo-descartar.component";
import {
  DialogoExcedePresupuestoComponent,
  DialogoExcedePresupuestoDatos,
  ResultadoExcedePresupuesto,
} from "../../../components/dialogo-excede-presupuesto/dialogo-excede-presupuesto.component";
import {
  DialogoConfirmarEnvioComponent,
  DialogoConfirmarEnvioDatos,
} from "../../../components/dialogo-confirmar-envio/dialogo-confirmar-envio.component";
import {
  DialogoEnvioExitosoComponent,
  DialogoEnvioExitosoDatos,
} from "../../../components/dialogo-envio-exitoso/dialogo-envio-exitoso.component";

type EstadoVista =
  | "cargando"
  | "listo"
  | "error"
  | "no-encontrada"
  | "bloqueada";

const PASO_INICIAL = 1;
const PASO_FINAL = 4;
const FORMATOS_RESPUESTA = ["pdf", "xls", "xlsx", "doc", "docx"] as const;

function maximoTextoEnriquecido(maximo: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const texto = textoPlanoDesdeHtml(String(control.value ?? ""));
    return texto.length <= maximo
      ? null
      : { maxlength: { requiredLength: maximo, actualLength: texto.length } };
  };
}

@Component({
  selector: "app-responder-solicitud",
  templateUrl: "./responder-solicitud.component.html",
  styleUrls: ["./responder-solicitud.component.scss"],
  standalone: false,
})
export class ResponderSolicitudComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly auth = inject(ImplicitAutenticationService);
  private readonly servicio = inject(RespuestaProveedorService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly borradores = inject(BorradorRespuestaService);
  private readonly alerta = inject(AlertService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private suscripcionAutoguardadoInstalada = false;
  private avisoPresupuestoAbierto = false;

  @ViewChild("inicioPaso") private inicioPaso?: ElementRef<HTMLElement>;

  readonly vista = signal<EstadoVista>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly solicitud = signal<SolicitudDetalleProveedor | null>(null);
  readonly documentos = signal<readonly import("../../../models/documentos.model").DocumentoOferente[]>([]);
  readonly items = signal<readonly ItemSolicitud[]>([]);
  readonly paso = signal(PASO_INICIAL);
  readonly pasoAlcanzado = signal(PASO_INICIAL);
  readonly enviando = signal(false);
  readonly guardando = signal(false);
  readonly confirmandoEnvio = signal(false);
  readonly error = signal("");
  readonly mensajeGuardado = signal("Los cambios se guardan automáticamente en este equipo.");
  readonly documentoIdentidad = signal("");

  paginaItems = 0;
  porPaginaItems = 5;
  paginaRevision = 0;
  porPaginaRevision = 5;
  readonly opcionesPorPagina = [5, 10, 25];
  readonly formatos = FORMATOS_RESPUESTA;
  readonly pasos = [
    { numero: 1, nombre: "Elementos y servicios", subtitulo: "Oferta económica" },
    { numero: 2, nombre: "Vigencia y descuentos", subtitulo: "Condiciones comerciales" },
    { numero: 3, nombre: "Documentos y soportes", subtitulo: "Adjuntos requeridos" },
    { numero: 4, nombre: "Revisión y envío", subtitulo: "Confirmar respuesta" },
  ];

  readonly formulario = this.fb.group({
    paso1: this.fb.group({ items: this.fb.array([]) }),
    paso2: this.fb.group({
      fechaVencimiento: ["", Validators.required],
      descuentoPorcentaje: [null as number | null, [Validators.min(0), Validators.max(100)]],
      condicionesComerciales: ["", maximoTextoEnriquecido(600)],
    }),
    paso3: this.fb.group({
      modalidad: ["individual" as ModalidadCotizacion, Validators.required],
      soporte: [[] as File[], Validators.required],
      requeridos: this.fb.group({}),
    }),
    paso4: this.fb.group({
      notaAdicional: ["", maximoTextoEnriquecido(500)],
      declaracionAceptada: [false, Validators.requiredTrue],
    }),
  });

  get totales() {
    const solicitudes = this.items();
    const ofertas = this.itemsRespuesta();
    return calcularTotalesRespuesta(
      solicitudes,
      ofertas,
      this.formulario.controls.paso2.controls.descuentoPorcentaje.value,
    );
  }

  /** Nombre del archivo de soporte de cotización adjuntado. */
  get nombreSoporte(): string {
    const soporte = this.formulario.controls.paso3.controls.soporte.value;
    return soporte?.[0]?.name ?? "Sin adjuntar";
  }

  claseTipoItem(tipo: ItemSolicitud["tipo"]): string {
    return tipo === "bien" ? "chip chip--bien" : "chip chip--servicio";
  }

  iconoTipoItem(tipo: ItemSolicitud["tipo"]): string {
    return tipo === "bien" ? "devices" : "room_service";
  }

  get totalArchivos(): number {
    const paso3 = this.formulario.controls.paso3.getRawValue();
    const adjuntos = paso3.requeridos as Record<string, File[]>;
    return (
      (paso3.soporte as File[]).length +
      Object.values(adjuntos).reduce(
        (total, archivos) => total + archivos.length,
        0,
      )
    );
  }

  get presupuestoDisponible(): number | null {
    return this.solicitud()?.presupuesto?.valorCdp ?? null;
  }

  get porcentajePresupuesto(): number {
    const presupuesto = this.presupuestoDisponible;
    return presupuesto && presupuesto > 0
      ? (this.totales.total / presupuesto) * 100
      : 0;
  }

  get porcentajeBarraPresupuesto(): number {
    return Math.min(this.porcentajePresupuesto, 100);
  }

  get superaPresupuesto(): boolean {
    const presupuesto = this.presupuestoDisponible;
    return presupuesto !== null && this.totales.total > presupuesto;
  }

  /** Porcentaje de descuento comercial diligenciado (0 si está vacío). */
  get descuentoPorcentaje(): number {
    return this.formulario.controls.paso2.controls.descuentoPorcentaje.value ?? 0;
  }

  /** Suma de las deducciones institucionales estimadas. */
  get totalDeduccionesEstimadas(): number {
    return this.deduccionesProvisionales.reduce(
      (total, deduccion) =>
        total + this.estimacionDeduccion(deduccion.porcentaje),
      0,
    );
  }

  get diasVigencia(): number | null {
    const fechaFin = this.formulario.controls.paso2.controls.fechaVencimiento.value;
    const cierre = this.solicitud()?.cierre;
    if (!fechaFin || !cierre) {
      return null;
    }
    const [dia, mes, anio] = cierre.split("/").map(Number);
    const inicioUtc = Date.UTC(anio, mes - 1, dia);
    const [anioFin, mesFin, diaFin] = fechaFin.split("-").map(Number);
    const finUtc = Date.UTC(anioFin, mesFin - 1, diaFin);
    return Math.max(0, Math.round((finUtc - inicioUtc) / 86_400_000));
  }

  readonly deduccionesProvisionales = [
    { etiqueta: "Estampilla U. Distrital 50 años", porcentaje: 1.1 },
    { etiqueta: "Estampilla Pro-Cultura", porcentaje: 0.5 },
    { etiqueta: "Estampilla Pro-Adulto Mayor", porcentaje: 2 },
  ] as const;

  get archivosResumen(): readonly {
    readonly requisito: string;
    readonly nombre: string;
    readonly tamano: string;
  }[] {
    const paso3 = this.formulario.controls.paso3.getRawValue();
    const documentos = paso3.requeridos as Record<string, File[]>;
    const filas: { requisito: string; nombre: string; tamano: string }[] = [];
    for (const archivo of paso3.soporte as File[]) {
      filas.push({
        requisito: "Soporte de cotización",
        nombre: archivo.name,
        tamano: this.formatearBytes(archivo.size),
      });
    }
    for (const [id, archivos] of Object.entries(documentos)) {
      const requisito =
        this.documentos().find((documento) => documento.id === id)?.nombre ?? id;
      for (const archivo of archivos) {
        filas.push({
          requisito,
          nombre: archivo.name,
          tamano: this.formatearBytes(archivo.size),
        });
      }
    }
    return filas;
  }

  /** Peso total de los archivos seleccionados en el paso 3. */
  get pesoTotalArchivos(): string {
    const paso3 = this.formulario.controls.paso3.getRawValue();
    const requeridos = paso3.requeridos as Record<string, File[]>;
    const archivos = [
      ...(paso3.soporte as File[]),
      ...Object.values(requeridos).flatMap((seleccionados) => seleccionados),
    ];
    return this.formatearBytes(
      archivos.reduce((total, archivo) => total + archivo.size, 0),
    );
  }

  /** Longitud de las observaciones adicionales del paso 4. */
  get longitudNotaAdicional(): number {
    return textoPlanoDesdeHtml(
      String(this.formulario.controls.paso4.controls.notaAdicional.value ?? ""),
    ).length;
  }

  /* ── Paginación de la tabla de revisión (paso 4) ─────────────────────── */
  get itemsRevision(): readonly ItemSolicitud[] {
    const inicio = this.paginaRevision * this.porPaginaRevision;
    return this.items().slice(inicio, inicio + this.porPaginaRevision);
  }

  get totalPaginasRevision(): number {
    return Math.max(
      1,
      Math.ceil(this.totalItemsOferta / this.porPaginaRevision),
    );
  }

  get rangoInicioRevision(): number {
    return this.totalItemsOferta === 0
      ? 0
      : this.paginaRevision * this.porPaginaRevision + 1;
  }

  get rangoFinRevision(): number {
    return Math.min(
      this.totalItemsOferta,
      (this.paginaRevision + 1) * this.porPaginaRevision,
    );
  }

  get paginasVisiblesRevision(): readonly number[] {
    const total = this.totalPaginasRevision;
    const inicio = Math.max(1, this.paginaRevision + 1 - 2);
    const fin = Math.min(total, inicio + 4);
    const paginas: number[] = [];
    for (let numero = Math.max(1, fin - 4); numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  cambiarPorPaginaRevision(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    this.porPaginaRevision = valor;
    this.paginaRevision = 0;
  }

  irAPaginaRevision(indice: number): void {
    if (indice < 0 || indice >= this.totalPaginasRevision) {
      return;
    }
    this.paginaRevision = indice;
  }

  /** Icono Material según la extensión del archivo. */
  iconoArchivo(nombre: string): string {
    const extension = nombre.split(".").pop()?.toLowerCase() ?? "";
    switch (extension) {
      case "pdf":
        return "picture_as_pdf";
      case "xls":
      case "xlsx":
      case "csv":
        return "table_chart";
      case "doc":
      case "docx":
        return "description";
      default:
        return "draft";
    }
  }

  /** Fecha ISO (aaaa-mm-dd) a formato dd/mm/aaaa. */
  formatearFecha(fecha: string): string {
    if (!fecha) {
      return "Sin diligenciar";
    }
    const [anio, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${anio}`;
  }

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Solicitudes de cotización › <b>Responder solicitud</b></p>";

  get filasOferta(): FormArray {
    return this.formulario.controls.paso1.controls.items;
  }

  get itemsPaginados(): readonly ItemSolicitud[] {
    const lista = this.items();
    const inicio = this.paginaItems * this.porPaginaItems;
    return lista.slice(inicio, inicio + this.porPaginaItems);
  }

  get totalItemsOferta(): number {
    return this.items().length;
  }

  get totalPaginasItems(): number {
    return Math.max(1, Math.ceil(this.totalItemsOferta / this.porPaginaItems));
  }

  get rangoInicioItems(): number {
    return this.totalItemsOferta === 0 ? 0 : this.paginaItems * this.porPaginaItems + 1;
  }

  get rangoFinItems(): number {
    return Math.min(this.totalItemsOferta, (this.paginaItems + 1) * this.porPaginaItems);
  }

  get paginasVisiblesItems(): readonly number[] {
    const total = this.totalPaginasItems;
    const inicio = Math.max(1, this.paginaItems + 1 - 2);
    const fin = Math.min(total, inicio + 4);
    const paginas: number[] = [];
    for (let numero = Math.max(1, fin - 4); numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  cambiarPorPaginaItems(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    this.porPaginaItems = valor;
    this.paginaItems = 0;
  }

  irAPaginaItems(indice: number): void {
    if (indice < 0 || indice >= this.totalPaginasItems) {
      return;
    }
    this.paginaItems = indice;
  }

  trackByItem(_indice: number, item: ItemSolicitud): string {
    return item.id;
  }

  get pasoActualValido(): boolean {
    switch (this.paso()) {
      case 1:
        return this.filasOferta.length > 0 && this.filasOferta.valid;
      case 2:
        return (
          this.formulario.controls.paso2.valid &&
          this.fechaOfertaValida
        );
      case 3:
        return this.formulario.controls.paso3.valid;
      default:
        return this.formulario.controls.paso4.valid;
    }
  }

  get fechaOfertaValida(): boolean {
    const fecha = this.formulario.controls.paso2.controls.fechaVencimiento.value;
    const cierre = this.solicitud()?.cierre;
    if (!fecha || !cierre) {
      return false;
    }
    const [dia, mes, anio] = cierre.split("/").map(Number);
    const fechaCierre = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return fecha >= fechaCierre;
  }

  ngOnInit(): void {
    const resultado = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;
    if (resultado.estado === "error") {
      this.error.set(resultado.mensaje);
      this.vista.set("error");
      return;
    }
    if (resultado.estado !== "ok") {
      this.vista.set("no-encontrada");
      return;
    }
    this.detalle.set(resultado.detalle);
    this.solicitud.set(resultado.detalle.solicitud);
    if (!this.permisos.puedeResponderInvitacion(
      resultado.detalle.invitacion,
      resultado.detalle.solicitud,
    )) {
      this.vista.set("bloqueada");
      return;
    }
    void this.inicializar();
  }

  private async inicializar(): Promise<void> {
    try {
      const proveedorId = String(await this.auth.getDocument() ?? "").trim();
      if (!proveedorId) {
        throw new Error("No fue posible identificar al proveedor en la sesión.");
      }
      this.documentoIdentidad.set(proveedorId);
      const detalle = this.detalle();
      if (!detalle) {
        this.vista.set("no-encontrada");
        return;
      }
      const base = await firstValueFrom(
        this.servicio.obtenerBase(detalle, proveedorId),
      );
      this.items.set(base.items);
      this.documentos.set(base.documentos);
      this.configurarFormulario(base.items, base.documentos);
      if (base.respuesta?.estado === "borrador") {
        this.formulario.patchValue({
          paso1: { items: [...base.respuesta.items] },
          paso2: {
            fechaVencimiento: base.respuesta.fechaVencimiento,
            descuentoPorcentaje: base.respuesta.descuentoPorcentaje,
            condicionesComerciales: base.respuesta.condicionesComerciales,
          },
          paso3: { modalidad: base.respuesta.modalidad },
          paso4: { notaAdicional: base.respuesta.notaAdicional },
        });
      }
      const borrador = this.borradores.cargar(detalle.solicitud.id, proveedorId);
      if (borrador) {
        this.formulario.patchValue(borrador.formValue);
        const pasoGuardado = Math.min(Math.max(borrador.currentStep, 1), PASO_FINAL);
        this.paso.set(pasoGuardado);
        this.pasoAlcanzado.set(pasoGuardado);
        this.mensajeGuardado.set("Se restauró el borrador guardado en este equipo.");
      }
      this.vista.set("listo");
      if (!this.suscripcionAutoguardadoInstalada) {
        this.suscripcionAutoguardadoInstalada = true;
        this.formulario.valueChanges
          .pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.autoguardar());
      }
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : "No fue posible cargar la respuesta.",
      );
      this.vista.set("error");
    }
  }

  private configurarFormulario(
    items: readonly ItemSolicitud[],
    documentos: readonly import("../../../models/documentos.model").DocumentoOferente[],
  ): void {
    this.filasOferta.clear();
    this.paginaItems = 0;
    for (const item of items) {
      this.filasOferta.push(
        this.fb.group({
          itemId: [item.id],
          valorUnitario: [null as number | null, [Validators.required, Validators.min(1)]],
          iva: ["19" as TipoIvaOferta, Validators.required],
          nota: ["", Validators.maxLength(500)],
        }),
      );
    }
    const controles: Record<string, AbstractControl> = {};
    for (const documento of documentos) {
      controles[documento.id] = this.fb.control(
        [],
        documento.clasificacion === "obligatorio" ? Validators.required : [],
      );
    }
    this.formulario.controls.paso3.setControl(
      "requeridos",
      this.fb.group(controles),
    );
  }

  private itemsRespuesta(): ItemRespuestaProveedor[] {
    return this.filasOferta.getRawValue() as ItemRespuestaProveedor[];
  }

  ofertaPara(itemId: string): ItemRespuestaProveedor | undefined {
    return this.itemsRespuesta().find((oferta) => oferta.itemId === itemId);
  }

  etiquetaIva(tipo: TipoIvaOferta | undefined): string {
    if (tipo === "excluido" || tipo === "exento") {
      return tipo === "excluido" ? "Excluido" : "Exento";
    }
    return `${tipo ?? "0"} %`;
  }

  ivaDelItem(item: ItemSolicitud): number {
    const oferta = this.ofertaPara(item.id);
    const tarifa =
      oferta?.iva === "19" || oferta?.iva === "5" || oferta?.iva === "0"
        ? Number(oferta.iva)
        : 0;
    return item.cantidad * (oferta?.valorUnitario ?? 0) * (tarifa / 100);
  }

  estimacionDeduccion(porcentaje: number): number {
    return Math.round(this.totales.baseGravable * (porcentaje / 100));
  }

  subtotalConIvaDelItem(item: ItemSolicitud): number {
    const oferta = this.ofertaPara(item.id);
    return (
      item.cantidad * (oferta?.valorUnitario ?? 0) +
      this.ivaDelItem(item)
    );
  }

  /** Valor total del ítem sin IVA: cantidad × valor unitario ofrecido. */
  valorTotalItem(item: ItemSolicitud): number {
    const oferta = this.ofertaPara(item.id);
    return item.cantidad * (oferta?.valorUnitario ?? 0);
  }

  private formatearBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes === 0) {
      return "0 B";
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  mostrarInformacionTributaria(): void {
    void this.alerta.showAlert(
      "Descuentos y retenciones institucionales",
      "Las tasas presentadas son una referencia visual provisional del mockup. La aplicabilidad, base y liquidación oficial dependen de la normativa vigente y del tipo de proveedor.",
    );
  }

  private valorFormulario(): Record<string, unknown> {
    const valor = this.formulario.getRawValue();
    const requeridos: Record<string, never[]> = {};
    for (const documento of this.documentos()) {
      requeridos[documento.id] = [];
    }
    return {
      ...valor,
      paso3: {
        ...valor.paso3,
        soporte: [],
        requeridos,
      },
    };
  }

  private autoguardar(): void {
    const detalle = this.detalle();
    const proveedorId = this.documentoIdentidad();
    if (!detalle || !proveedorId || this.vista() !== "listo") {
      return;
    }
    const guardado = this.borradores.guardar(
      detalle.solicitud.id,
      proveedorId,
      this.valorFormulario(),
      this.paso(),
    );
    this.mensajeGuardado.set(
      guardado
        ? "Borrador guardado automáticamente en este equipo."
        : "No fue posible guardar el borrador en este equipo.",
    );
  }

  async cambiarPaso(paso: number): Promise<void> {
    if (paso < 1 || paso > this.pasoAlcanzado()) {
      return;
    }
    // Avanzar (no retroceder) exige no superar el límite presupuestal.
    if (paso > this.paso() && !(await this.validarLimitePresupuestal())) {
      return;
    }
    this.paso.set(paso);
    this.enfocarPaso();
  }

  async continuar(): Promise<void> {
    const control = this.controlPaso(this.paso());
    if (!this.pasoActualValido) {
      control.markAllAsTouched();
      return;
    }
    if (this.paso() < PASO_FINAL) {
      if (!(await this.validarLimitePresupuestal())) {
        return;
      }
      this.paso.update((actual) => actual + 1);
      this.pasoAlcanzado.update((actual) => Math.max(actual, this.paso()));
      this.enfocarPaso();
    }
  }

  regresarPaso(): void {
    if (this.paso() > PASO_INICIAL) {
      this.paso.update((actual) => actual - 1);
      this.enfocarPaso();
    } else {
      void this.volverAlDetalle();
    }
  }

  /**
   * Lleva la vista al inicio del paso recién activado.
   *
   * El microfrontend se monta dentro del Root, así que el scroll puede vivir
   * en la ventana o en un contenedor intermedio: `scrollIntoView` sube por
   * todos los ancestros desplazables y deja el banner del paso a la vista.
   * El foco se mueve sin desplazar (`preventScroll`) para no competir con la
   * animación y mantener la accesibilidad del cambio de paso.
   */
  private enfocarPaso(): void {
    setTimeout(() => {
      const comportamiento: ScrollBehavior = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
        ? "auto"
        : "smooth";
      const elemento = this.inicioPaso?.nativeElement;
      if (!elemento) {
        window.scrollTo({ top: 0, behavior: comportamiento });
        return;
      }
      elemento.scrollIntoView({ behavior: comportamiento, block: "start" });
      elemento.focus({ preventScroll: true });
    });
  }

  private controlPaso(paso: number): FormGroup {
    switch (paso) {
      case 1:
        return this.formulario.controls.paso1;
      case 2:
        return this.formulario.controls.paso2;
      case 3:
        return this.formulario.controls.paso3;
      default:
        return this.formulario.controls.paso4;
    }
  }

  /**
   * Verifica el límite presupuestal antes de avanzar de paso o radicar.
   * Si la oferta estimada lo supera, despliega el aviso bloqueante y niega
   * el avance; el proveedor solo puede corregir los valores del paso 1.
   */
  private async validarLimitePresupuestal(): Promise<boolean> {
    const limite = this.presupuestoDisponible;
    if (limite === null || !this.superaPresupuesto) {
      return true;
    }
    if (this.avisoPresupuestoAbierto) {
      return false;
    }

    this.avisoPresupuestoAbierto = true;
    try {
      const resultado = await firstValueFrom(
        this.dialog
          .open<
            DialogoExcedePresupuestoComponent,
            DialogoExcedePresupuestoDatos,
            ResultadoExcedePresupuesto
          >(DialogoExcedePresupuestoComponent, {
            data: {
              solicitudId: this.detalle()?.solicitud.id ?? "",
              limite,
              total: this.totales.total,
            },
            width: "680px",
            maxWidth: "96vw",
            autoFocus: ".dialogo__revisar",
          })
          .afterClosed(),
      );
      if (resultado === "revisar") {
        this.paso.set(PASO_INICIAL);
        this.enfocarPaso();
      }
      return false;
    } finally {
      this.avisoPresupuestoAbierto = false;
    }
  }

  formatoMoneda(valor: number): string {
    return valor.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });
  }

  /**
   * Informa que la plantilla de cotización todavía no está publicada.
   *
   * El formato oficial aún no lo define el área usuaria; cuando esté
   * disponible, este método debe descargar el archivo institucional.
   */
  descargarPlantilla(): void {
    void this.alerta.showAlert(
      "Plantilla de cotización",
      "La plantilla de cotización aún no está definida. Estará disponible en una próxima versión; por ahora adjunte su cotización en formato libre (PDF, XLS, XLSX, DOC o DOCX).",
    );
  }

  async guardarBorrador(): Promise<void> {
    const detalle = this.detalle();
    const proveedorId = this.documentoIdentidad();
    if (!detalle || !proveedorId || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.error.set("");
    try {
      const respuesta = this.construirRespuesta("borrador");
      await firstValueFrom(this.servicio.guardarBorrador(respuesta));
      const guardado = this.borradores.guardar(
        detalle.solicitud.id,
        proveedorId,
        this.valorFormulario(),
        this.paso(),
      );
      if (!guardado) {
        throw new Error("El almacenamiento local no está disponible.");
      }
      this.mensajeGuardado.set("Borrador guardado en este equipo.");
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "No fue posible guardar el borrador.");
    } finally {
      this.guardando.set(false);
    }
  }

  async enviar(): Promise<void> {
    if (this.enviando() || this.confirmandoEnvio()) {
      return;
    }
    if (!this.formularioCompletoValido) {
      this.formulario.controls.paso4.markAllAsTouched();
      const primerPasoInvalido = [1, 2, 3, 4].find(
        (paso) => !this.validarPaso(paso),
      );
      if (primerPasoInvalido) {
        this.paso.set(primerPasoInvalido);
        this.pasoAlcanzado.update((actual) =>
          Math.max(actual, primerPasoInvalido),
        );
        this.controlPaso(primerPasoInvalido).markAllAsTouched();
        this.enfocarPaso();
      }
      return;
    }
    if (!(await this.validarLimitePresupuestal())) {
      return;
    }
    const detalle = this.detalle();
    if (
      !detalle ||
      !this.permisos.puedeResponderInvitacion(
        detalle.invitacion,
        detalle.solicitud,
      )
    ) {
      this.error.set(
        "El plazo de respuesta venció o el estado actual ya no permite radicar esta oferta.",
      );
      this.vista.set("bloqueada");
      return;
    }
    this.confirmandoEnvio.set(true);
    let confirmado: boolean | undefined = false;
    try {
      confirmado = await firstValueFrom(
        this.dialog
          .open<
            DialogoConfirmarEnvioComponent,
            DialogoConfirmarEnvioDatos,
            boolean
          >(DialogoConfirmarEnvioComponent, {
            data: {
              solicitudId: detalle.solicitud.id,
              total: this.totales.total,
              diasVigencia: this.diasVigencia,
              fechaVencimiento:
                this.formulario.controls.paso2.controls.fechaVencimiento
                  .value ?? "",
            },
            width: "640px",
            maxWidth: "96vw",
            autoFocus: ".dialogo__revisar",
          })
          .afterClosed(),
      );
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : "No fue posible abrir la confirmación de envío.",
      );
      this.confirmandoEnvio.set(false);
      return;
    }
    this.confirmandoEnvio.set(false);
    if (!confirmado || this.enviando()) {
      return;
    }
    if (
      !this.permisos.puedeResponderInvitacion(
        detalle.invitacion,
        detalle.solicitud,
      )
    ) {
      this.error.set(
        "El plazo de respuesta venció o el estado actual ya no permite radicar esta oferta.",
      );
      this.vista.set("bloqueada");
      return;
    }
    this.enviando.set(true);
    this.error.set("");
    try {
      const enviada = await firstValueFrom(
        this.servicio.enviar(this.construirRespuesta("enviada")),
      );
      const solicitud = this.detalle()?.solicitud;
      const proveedorId = this.documentoIdentidad();
      if (solicitud && proveedorId) {
        this.borradores.eliminar(solicitud.id, proveedorId);
      }
      await this.mostrarAcuseRadicacion(enviada, solicitud?.id ?? enviada.solicitudId);
      await this.volverABandeja();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : "No fue posible enviar la respuesta.");
    } finally {
      this.enviando.set(false);
    }
  }

  /**
   * Despliega el acuse de radicación como modal (no como vista aparte) y
   * espera a que el proveedor confirme para volver a la bandeja.
   */
  private async mostrarAcuseRadicacion(
    respuesta: RespuestaProveedor,
    solicitudId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.dialog
        .open<
          DialogoEnvioExitosoComponent,
          DialogoEnvioExitosoDatos,
          boolean
        >(DialogoEnvioExitosoComponent, {
          data: {
            radicado: respuesta.radicado ?? "Sin radicado",
            solicitudId,
            total: this.totales.total,
            fechaRadicacion:
              respuesta.fechaRadicacion ?? new Date().toISOString(),
          },
          width: "560px",
          maxWidth: "96vw",
          disableClose: true,
          autoFocus: ".dialogo__volver",
        })
        .afterClosed(),
    );
  }

  private construirRespuesta(
    estado: "borrador" | "enviada",
  ): RespuestaProveedor {
    const detalle = this.detalle();
    if (!detalle) {
      throw new Error("No se encontró la solicitud asociada a la invitación.");
    }
    const paso3 = this.formulario.controls.paso3.getRawValue();
    const requeridos = paso3.requeridos as Record<string, File[]>;
    const archivos = [
      ...(paso3.soporte as File[]).map((archivo) => ({
        requisitoId: "soporte-cotizacion",
        archivo,
      })),
      ...Object.entries(requeridos).flatMap(([requisitoId, seleccionados]) =>
        seleccionados.map((archivo) => ({ requisitoId, archivo })),
      ),
    ];
    const paso2 = this.formulario.controls.paso2.getRawValue();
    return {
      id: `RESP-${detalle.invitacion.id}`,
      solicitudId: detalle.solicitud.id,
      invitacionId: detalle.invitacion.id,
      proveedorId: this.documentoIdentidad(),
      estado,
      items: this.itemsRespuesta(),
      fechaVencimiento: paso2.fechaVencimiento ?? "",
      descuentoPorcentaje: paso2.descuentoPorcentaje,
      condicionesComerciales: paso2.condicionesComerciales ?? "",
      modalidad: paso3.modalidad as ModalidadCotizacion,
      archivos,
      notaAdicional: this.formulario.controls.paso4.controls.notaAdicional.value ?? "",
    };
  }

  reintentar(): void {
    const id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.vista.set("cargando");
    this.error.set("");
    void firstValueFrom(this.solicitudes.obtenerDetalleProveedor(id))
      .then((detalle) => {
        if (!detalle) {
          this.vista.set("no-encontrada");
          return;
        }
        this.detalle.set(detalle);
        this.solicitud.set(detalle.solicitud);
        if (!this.permisos.puedeResponderInvitacion(detalle.invitacion, detalle.solicitud)) {
          this.vista.set("bloqueada");
          return;
        }
        return this.inicializar();
      })
      .catch((error: unknown) => {
        this.error.set(
          error instanceof Error ? error.message : "No fue posible consultar la solicitud.",
        );
        this.vista.set("error");
      });
  }

  async volverAlDetalle(): Promise<void> {
    if (this.formulario.dirty) {
      const solicitudId = this.detalle()?.solicitud.id ?? "";
      const resultado = await firstValueFrom(
        this.dialog
          .open<
            DialogoDescartarComponent,
            DialogoDescartarDatos,
            ResultadoDescartar
          >(DialogoDescartarComponent, {
            data: { tipo: "respuesta", solicitudId },
            width: "680px",
            maxWidth: "96vw",
            autoFocus: ".dialogo__seguir",
          })
          .afterClosed(),
      );
      if (!resultado) {
        return;
      }
      const proveedorId = this.documentoIdentidad();
      if (solicitudId && proveedorId) {
        try {
          await firstValueFrom(
            this.servicio.eliminarBorrador(solicitudId, proveedorId),
          );
          this.borradores.eliminar(solicitudId, proveedorId);
        } catch (error) {
          this.error.set(
            error instanceof Error
              ? error.message
              : "No fue posible descartar el borrador.",
          );
          return;
        }
      }
    }
    const id = this.detalle()?.solicitud.id;
    await this.router.navigate(
      id
        ? ["cotizaciones", "bandeja-solicitudes", id]
        : ["cotizaciones", "bandeja-solicitudes"],
    );
  }

  volverABandeja(): void {
    void this.router.navigate(["cotizaciones", "bandeja-solicitudes"]);
  }

  documentoObligatorio(id: string): boolean {
    return this.documentos().some(
      (documento) =>
        documento.id === id && documento.clasificacion === "obligatorio",
    );
  }

  controlArchivo(requisitoId: string): AbstractControl | null {
    return this.formulario.controls.paso3.controls.requeridos.get(requisitoId);
  }

  private get formularioCompletoValido(): boolean {
    return [1, 2, 3, 4].every((paso) => this.validarPaso(paso));
  }

  private validarPaso(paso: number): boolean {
    if (paso === 1) {
      return this.filasOferta.length > 0 && this.filasOferta.valid;
    }
    if (paso === 2) {
      return this.formulario.controls.paso2.valid && this.fechaOfertaValida;
    }
    if (paso === 3) {
      return this.formulario.controls.paso3.valid;
    }
    return this.formulario.controls.paso4.valid;
  }
}
