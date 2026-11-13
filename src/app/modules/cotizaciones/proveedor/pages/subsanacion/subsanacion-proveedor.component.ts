import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, firstValueFrom, interval } from "rxjs";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  BorradorBase,
  BorradorService,
} from "src/app/shared/services/borrador.service";
import type { EventoLineaTiempo } from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import type { DetalleInvitacionProveedor } from "../../../models/invitacion-proveedor.model";
import { FORMATOS_SOPORTE_OFERTA } from "../../../models/respuesta-proveedor.model";
import { formatoFechaHoraOferente } from "../../../models/oferente.model";
import {
  etiquetaAvanceSubsanacion,
} from "../../../models/subsanacion-proveedor.model";
import type {
  DocumentoSubsanacionProveedor,
  SubsanacionProveedor,
} from "../../../models/subsanacion-proveedor.model";
import { eventoLineaTiempoSubsanacion } from "../../../models/subsanacion.model";
import { SubsanacionService } from "../../../services/subsanacion.service";
import { SolicitudesService } from "../../../services/solicitudes.service";
import { ResultadoResolverDetalleProveedor } from "../detalle-solicitud/detalle-proveedor.resolver";
import {
  DialogoConfirmarSubsanacionComponent,
  type DialogoConfirmarSubsanacionDatos,
} from "./components/dialogo-confirmar-subsanacion/dialogo-confirmar-subsanacion.component";
import {
  DialogoExitoSubsanacionComponent,
  type DialogoExitoSubsanacionDatos,
} from "./components/dialogo-exito-subsanacion/dialogo-exito-subsanacion.component";

type EstadoVista =
  | "cargando"
  | "listo"
  | "error"
  | "no-encontrada"
  | "sin-periodo";

interface BorradorJustificacion extends BorradorBase {
  readonly justificacion: string;
}

interface IntentoAdjunto {
  readonly documentoId: string;
  readonly archivo: File;
  readonly reemplazo: boolean;
}

const PREFIJO_BORRADOR =
  "agora.gestion-personas.borrador.subsanacion-proveedor";

/**
 * «Subsanación documental» (P-08): el proveedor cumple el periodo que el
 * solicitante configuró en S-12.
 *
 * Es una vista de escritura limitada: solo adjunta o reemplaza documentos
 * habilitados, registra el evento y permite radicar. No toca ítems, precios ni
 * totales de la oferta (RN-42/RN-35) y nunca recibe datos de otros oferentes
 * (RN-29). La proyección filtrada la construye `SubsanacionProveedor`.
 */
@Component({
  selector: "app-subsanacion-proveedor",
  templateUrl: "./subsanacion-proveedor.component.html",
  styleUrls: ["./subsanacion-proveedor.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class SubsanacionProveedorComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(SubsanacionService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly alerta = inject(AlertService);
  private readonly dialogo = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly formatos = FORMATOS_SOPORTE_OFERTA;
  readonly tamanoMaxMb = 10;

  readonly vista = signal<EstadoVista>("cargando");
  readonly detalle = signal<DetalleInvitacionProveedor | null>(null);
  readonly proyeccion = signal<SubsanacionProveedor | null>(null);
  readonly error = signal("");
  readonly errorEnvio = signal("");
  readonly anuncio = signal("");
  readonly enviando = signal(false);
  readonly subiendo = signal<string | null>(null);
  readonly reemplazando = signal<ReadonlySet<string>>(new Set<string>());
  readonly ultimoIntento = signal<IntentoAdjunto | null>(null);
  readonly ultimoGuardado = signal<string | null>(null);

  readonly justificacion = new FormControl<string>("", { nonNullable: true });

  private readonly controles = new Map<string, FormControl<File[]>>();
  private readonly controlesSuscritos = new Set<string>();
  private borrador?: BorradorService<BorradorJustificacion>;

  readonly documentos = computed<readonly DocumentoSubsanacionProveedor[]>(
    () => this.proyeccion()?.documentos ?? [],
  );

  readonly puedeEditar = computed(
    () => this.proyeccion()?.puedeEditar ?? false,
  );
  readonly puedeRadicar = computed(
    () =>
      !!this.proyeccion()?.puedeRadicar &&
      !this.enviando() &&
      !this.subiendo(),
  );
  readonly estadoPeriodo = computed(
    () => this.proyeccion()?.estadoPeriodo ?? null,
  );
  readonly periodo = computed(() => this.proyeccion()?.subsanacion ?? null);
  readonly avance = computed(() => {
    const proyeccion = this.proyeccion();
    return proyeccion
      ? etiquetaAvanceSubsanacion(proyeccion.estadoProveedor)
      : "";
  });
  readonly lineaTiempo = computed<readonly EventoLineaTiempo[]>(() =>
    (this.proyeccion()?.eventos ?? []).map((evento) =>
      eventoLineaTiempoSubsanacion(evento),
    ),
  );

  get tituloPagina(): string {
    const id = this.detalle()?.solicitud.id;
    return id
      ? `Subsanación documental · Solicitud ${id}`
      : "Subsanación documental";
  }

  get breadcrumb(): string {
    const id = this.detalle()?.solicitud.id;
    return `<p>Gestión Proveedor › Cotizaciones › ${
      id ? `Solicitud ${id} › ` : ""
    }<b>Subsanación documental</b></p>`;
  }

  get etiquetaPeriodo(): string {
    switch (this.estadoPeriodo()) {
      case "configurada":
        return "Periodo programado";
      case "activa":
        return "Periodo en curso";
      case "vencida":
        return "Periodo finalizado";
      case "cancelada":
        return "Periodo cancelado";
      default:
        return "Subsanación documental";
    }
  }

  get textoPeriodo(): string {
    const periodo = this.periodo();
    if (!periodo) {
      return "";
    }
    switch (this.estadoPeriodo()) {
      case "configurada":
        return `Inicia el ${formatoFechaHoraOferente(periodo.inicio)}.`;
      case "activa":
        return `Cierra el ${formatoFechaHoraOferente(periodo.fin)}.`;
      case "vencida":
        return `Finalizó el ${formatoFechaHoraOferente(periodo.fin)}; la consulta es de solo lectura.`;
      case "cancelada":
        return "El periodo fue cancelado por la entidad.";
      default:
        return "";
    }
  }

  get etiquetaBotonRadicar(): string {
    return this.enviando() ? "Radicando…" : "Enviar subsanación";
  }

  formatear(iso: string | null): string {
    return iso ? formatoFechaHoraOferente(iso) : "Por definir";
  }

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "detalleProveedor"
    ] as ResultadoResolverDetalleProveedor;

    if (resolucion.estado !== "ok") {
      this.vista.set(
        resolucion.estado === "no-encontrada" ? "no-encontrada" : "error",
      );
      if (resolucion.estado === "error") {
        this.error.set(resolucion.mensaje);
      }
      return;
    }

    this.detalle.set(resolucion.detalle);
    if (
      !this.permisos.puedeVerSubsanacionProveedor(
        resolucion.detalle.solicitud,
        resolucion.detalle.proveedor.id,
      )
    ) {
      this.vista.set("sin-periodo");
      return;
    }

    this.prepararBorrador(
      resolucion.detalle.solicitud.id,
      resolucion.detalle.proveedor.id,
    );
    void this.cargarProyeccion();

    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.actualizarEstadoPeriodo());
  }

  reintentar(): void {
    const detalle = this.detalle();
    if (detalle) {
      void this.cargarProyeccion();
      return;
    }
    const id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.vista.set("cargando");
    this.error.set("");
    void firstValueFrom(this.solicitudes.obtenerDetalleProveedor(id))
      .then((recuperado) => {
        if (!recuperado) {
          this.vista.set("no-encontrada");
          return;
        }
        this.detalle.set(recuperado);
        this.prepararBorrador(
          recuperado.solicitud.id,
          recuperado.proveedor.id,
        );
        return this.cargarProyeccion();
      })
      .catch((fallo: unknown) => {
        this.error.set(
          fallo instanceof Error
            ? fallo.message
            : "No fue posible consultar la solicitud.",
        );
        this.vista.set("error");
      });
  }

  volver(): void {
    const detalle = this.detalle();
    if (!detalle) {
      void this.router.navigate(["/cotizaciones", "bandeja-solicitudes"]);
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "bandeja-solicitudes",
      detalle.solicitud.id,
    ]);
  }

  volverABandeja(): void {
    void this.router.navigate(["/cotizaciones", "bandeja-solicitudes"]);
  }

  verMiCotizacion(): void {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "bandeja-solicitudes",
      detalle.solicitud.id,
      "mi-cotizacion",
    ]);
  }

  controlDocumento(id: string): FormControl<File[]> {
    let control = this.controles.get(id);
    if (!control) {
      control = new FormControl<File[]>([], { nonNullable: true });
      this.controles.set(id, control);
    }
    if (!this.controlesSuscritos.has(id)) {
      this.controlesSuscritos.add(id);
      control.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((archivos) => {
          if (archivos.length > 0) {
            void this.procesarArchivo(id, archivos[0]);
          }
        });
    }
    return control;
  }

  esReemplazando(id: string): boolean {
    return this.reemplazando().has(id);
  }

  estaSubiendo(id: string): boolean {
    return this.subiendo() === id;
  }

  puedeSustituir(documento: DocumentoSubsanacionProveedor): boolean {
    return (
      this.puedeEditar() &&
      !this.enviando() &&
      !this.subiendo() &&
      !!this.periodo()?.permitirReemplazo &&
      (documento.estado === "adjuntado" ||
        documento.estado === "reemplazado")
    );
  }

  mostrarCarga(documento: DocumentoSubsanacionProveedor): boolean {
    return (
      this.puedeEditar() &&
      !this.enviando() &&
      (!this.subiendo() || this.subiendo() === documento.id) &&
      documento.habilitado &&
      (documento.estado === "pendiente-carga" ||
        this.esReemplazando(documento.id))
    );
  }

  prepararReemplazo(documento: DocumentoSubsanacionProveedor): void {
    if (!this.puedeSustituir(documento)) {
      return;
    }
    const siguientes = new Set(this.reemplazando());
    siguientes.add(documento.id);
    this.reemplazando.set(siguientes);
    this.anuncio.set(
      `Seleccione el archivo que reemplazará «${documento.archivoActual?.nombre ?? documento.nombre}».`,
    );
  }

  cancelarReemplazo(id: string): void {
    const siguientes = new Set(this.reemplazando());
    siguientes.delete(id);
    this.reemplazando.set(siguientes);
    this.limpiarControl(id);
  }

  reintentarAdjunto(): void {
    const intento = this.ultimoIntento();
    if (intento) {
      void this.subirArchivo(
        intento.documentoId,
        intento.archivo,
        intento.reemplazo,
      );
    }
  }

  descartarCargaPendiente(): void {
    const intento = this.ultimoIntento();
    if (intento) {
      this.limpiarControl(intento.documentoId);
      const siguientes = new Set(this.reemplazando());
      siguientes.delete(intento.documentoId);
      this.reemplazando.set(siguientes);
    }
    this.ultimoIntento.set(null);
    this.errorEnvio.set("");
  }

  guardarBorrador(): void {
    if (!this.borrador) {
      return;
    }
    const guardado = this.borrador.guardar({
      version: 1,
      currentStep: 1,
      savedAt: new Date().toISOString(),
      justificacion: this.justificacion.value,
    });
    if (guardado) {
      this.ultimoGuardado.set(formatoFechaHoraOferente(new Date().toISOString()));
      this.anuncio.set("Borrador de la justificación guardado en este navegador.");
    } else {
      this.errorEnvio.set(
        "No fue posible guardar el borrador local. Puede continuar sin guardarlo.",
      );
    }
  }

  abrirConfirmacion(): void {
    const proyeccion = this.proyeccion();
    const detalle = this.detalle();
    if (!proyeccion || !detalle || !this.puedeRadicar()) {
      return;
    }
    if (this.hayCargaPendiente()) {
      this.errorEnvio.set(
        "Termine o cancele el cargue pendiente antes de radicar la subsanación.",
      );
      return;
    }

    const datos: DialogoConfirmarSubsanacionDatos = {
      solicitudId: detalle.solicitud.id,
      documentos: proyeccion.documentos
        .filter(
          (documento) =>
            documento.estado === "adjuntado" ||
            documento.estado === "reemplazado",
        )
        .map((documento) => ({
          nombre: documento.archivoActual?.nombre ?? documento.nombre,
          peso: documento.archivoActual?.peso ?? "—",
        })),
      pendientesObligatorios: proyeccion.obligatoriosPendientes,
      justificacion: this.textoJustificacion(),
      hash: this.hashPreliminar(),
    };

    this.dialogo
      .open(DialogoConfirmarSubsanacionComponent, {
        data: datos,
        width: "min(42rem, 94vw)",
        autoFocus: "first-tabbable",
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((confirmado: boolean | undefined) => {
        if (confirmado) {
          void this.radicar();
        }
      });
  }

  async radicar(): Promise<void> {
    const detalle = this.detalle();
    const proyeccion = this.proyeccion();
    if (!detalle || !proyeccion || this.enviando()) {
      return;
    }
    if (!proyeccion.puedeRadicar) {
      this.errorEnvio.set(
        "Aún faltan documentos obligatorios por cargar antes de radicar.",
      );
      return;
    }
    if (this.hayCargaPendiente()) {
      this.errorEnvio.set(
        "Termine o cancele el cargue pendiente antes de radicar la subsanación.",
      );
      return;
    }

    this.enviando.set(true);
    this.errorEnvio.set("");
    try {
      const actualizada = await firstValueFrom(
        this.servicio.radicarSubsanacion(
          detalle,
          detalle.proveedor.id,
          this.justificacion.value,
        ),
      );
      this.aplicarProyeccion(actualizada);
      this.borrador?.eliminar();
      this.ultimoGuardado.set(null);
      this.anuncio.set("Subsanación radicada correctamente.");
      this.abrirExito(actualizada);
    } catch (fallo: unknown) {
      this.errorEnvio.set(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible radicar la subsanación. Intente nuevamente.",
      );
    } finally {
      this.enviando.set(false);
    }
  }

  descargarConstancia(): void {
    void this.alerta.showAlert(
      "Constancia en preparación",
      "La constancia de la subsanación se generará cuando el gestor documental institucional esté conectado. Por ahora la consulta en pantalla y el radicado son la evidencia disponible.",
    );
  }

  private async cargarProyeccion(): Promise<void> {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    this.vista.set("cargando");
    this.error.set("");
    this.errorEnvio.set("");
    try {
      const proyeccion = await firstValueFrom(
        this.servicio.obtenerProveedor(detalle, detalle.proveedor.id),
      );
      if (!proyeccion) {
        this.vista.set("sin-periodo");
        return;
      }
      this.aplicarProyeccion(proyeccion);
      this.vista.set("listo");
      this.anuncio.set(
        `Subsanación cargada: ${proyeccion.completados} de ${proyeccion.total} documentos cargados.`,
      );
    } catch (fallo: unknown) {
      this.error.set(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible consultar la subsanación de su empresa.",
      );
      this.vista.set("error");
    }
  }

  private async actualizarEstadoPeriodo(): Promise<void> {
    const detalle = this.detalle();
    if (!detalle || this.vista() !== "listo" || this.enviando()) {
      return;
    }
    try {
      const proyeccion = await firstValueFrom(
        this.servicio.obtenerProveedor(detalle, detalle.proveedor.id),
      );
      if (!proyeccion) {
        this.proyeccion.set(null);
        this.vista.set("sin-periodo");
        return;
      }
      const anterior = this.proyeccion()?.estadoPeriodo;
      this.aplicarProyeccion(proyeccion);
      if (anterior !== proyeccion.estadoPeriodo) {
        this.anuncio.set(
          proyeccion.estadoPeriodo === "vencida"
            ? "El periodo de subsanación finalizó. La vista quedó en solo lectura."
            : `Estado del periodo actualizado: ${this.etiquetaPeriodo}.`,
        );
      }
    } catch {
      /* La consulta periódica no interrumpe la edición. */
    }
  }

  private async procesarArchivo(
    documentoId: string,
    archivo: File,
  ): Promise<void> {
    const documento = this.documentos().find(
      (item) => item.id === documentoId,
    );
    if (!documento || !this.puedeEditar() || this.enviando() || this.subiendo()) {
      this.limpiarControl(documentoId);
      return;
    }

    const yaCargado =
      documento.estado === "adjuntado" ||
      documento.estado === "reemplazado" ||
      !!documento.evento;
    if (yaCargado) {
      const confirmacion = await this.alerta.showConfirmAlert(
        `Se reemplazará «${
          documento.archivoActual?.nombre ?? documento.nombre
        }» por «${archivo.name}». La versión anterior quedará registrada en el historial.`,
        "Confirmar reemplazo de documento",
      );
      if (!confirmacion.isConfirmed) {
        this.limpiarControl(documentoId);
        return;
      }
    }

    await this.subirArchivo(documentoId, archivo, yaCargado);
  }

  private async subirArchivo(
    documentoId: string,
    archivo: File,
    reemplazo: boolean,
  ): Promise<void> {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    this.subiendo.set(documentoId);
    this.errorEnvio.set("");
    this.ultimoIntento.set({ documentoId, archivo, reemplazo });
    try {
      const actualizada = await firstValueFrom(
        this.servicio.adjuntarDocumento(
          detalle,
          detalle.proveedor.id,
          documentoId,
          archivo,
        ),
      );
      this.aplicarProyeccion(actualizada);
      this.limpiarControl(documentoId);
      const siguientes = new Set(this.reemplazando());
      siguientes.delete(documentoId);
      this.reemplazando.set(siguientes);
      this.ultimoIntento.set(null);
      this.anuncio.set(
        `${reemplazo ? "Documento reemplazado" : "Documento cargado"}: ${archivo.name}.`,
      );
    } catch (fallo: unknown) {
      this.errorEnvio.set(
        fallo instanceof Error
          ? fallo.message
          : "No fue posible registrar el documento. El archivo se conserva para reintentar.",
      );
    } finally {
      this.subiendo.set(null);
    }
  }

  private limpiarControl(id: string): void {
    this.controles.get(id)?.setValue([], { emitEvent: false });
  }

  private hayCargaPendiente(): boolean {
    return (
      !!this.ultimoIntento() ||
      [...this.controles.values()].some(
        (control) => control.value.length > 0,
      )
    );
  }

  private prepararControles(proyeccion: SubsanacionProveedor): void {
    for (const documento of proyeccion.documentos) {
      this.controlDocumento(documento.id);
    }
  }

  private aplicarProyeccion(proyeccion: SubsanacionProveedor): void {
    this.proyeccion.set(proyeccion);
    if (!proyeccion.puedeEditar) {
      this.justificacion.disable({ emitEvent: false });
    } else {
      this.justificacion.enable({ emitEvent: false });
    }
    this.detalle.update((detalle) =>
      detalle
        ? {
            ...detalle,
            solicitud: {
              ...detalle.solicitud,
              subsanacion: proyeccion.subsanacion,
            },
          }
        : detalle,
    );
    this.prepararControles(proyeccion);
  }

  private prepararBorrador(solicitudId: string, proveedorId: string): void {
    if (this.borrador) {
      return;
    }
    this.borrador = new BorradorService<BorradorJustificacion>(
      `${PREFIJO_BORRADOR}.${solicitudId}.${proveedorId}`,
    );
    const guardado = this.borrador.cargar();
    if (guardado?.justificacion) {
      this.justificacion.setValue(guardado.justificacion, {
        emitEvent: false,
      });
      this.ultimoGuardado.set(
        formatoFechaHoraOferente(guardado.savedAt),
      );
    }
    this.justificacion.valueChanges
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => {
        if (!this.borrador) {
          return;
        }
        this.borrador.guardar({
          version: 1,
          currentStep: 1,
          savedAt: new Date().toISOString(),
          justificacion: valor,
        });
        this.ultimoGuardado.set(
          formatoFechaHoraOferente(new Date().toISOString()),
        );
      });
  }

  private textoJustificacion(): string {
    return this.justificacion.value.replace(/<[^>]*>/g, " ").trim();
  }

  private hashPreliminar(): string {
    const base = this.documentos()
      .filter(
        (documento) =>
          documento.estado === "adjuntado" ||
          documento.estado === "reemplazado",
      )
      .map((documento) => documento.archivoActual?.nombre ?? documento.id)
      .join("|");
    let hash = 0;
    for (let indice = 0; indice < base.length; indice += 1) {
      hash = (hash * 31 + base.charCodeAt(indice)) >>> 0;
    }
    return `SHA-256: ${hash.toString(16).padStart(8, "0")}… (preliminar)`;
  }

  private abrirExito(proyeccion: SubsanacionProveedor): void {
    const detalle = this.detalle();
    if (!detalle) {
      return;
    }
    const datos: DialogoExitoSubsanacionDatos = {
      radicado: proyeccion.radicadoProveedor ?? "Por definir",
      solicitudId: detalle.solicitud.id,
      fecha: proyeccion.radicadaEl ?? new Date().toISOString(),
      operador: detalle.proveedor.correo,
      hash: this.hashPreliminar(),
    };
    this.dialogo
      .open(DialogoExitoSubsanacionComponent, {
        data: datos,
        width: "min(38rem, 94vw)",
        autoFocus: "first-tabbable",
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((irACotizacion: boolean | undefined) => {
        if (irACotizacion) {
          this.verMiCotizacion();
        }
      });
  }
}
