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
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription, debounceTime, interval } from "rxjs";
import type { EstadoSubsanacion } from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  MIN_CARACTERES_JUSTIFICACION,
  justificacionMinima,
} from "src/app/shared/validators/justificacion.validator";
import { ResultadoResolverSolicitud } from "../../../../resolvers/solicitud.resolver";
import { aniosDelRango } from "../../../../models/calendario.model";
import { diasHabilesEntre } from "../../../../models/datos-generales.model";
import { formatoCop } from "../../../../models/necesidad.model";
import { formatoFechaHoraOferente } from "../../../../models/oferente.model";
import {
  fechaCierreSolicitud,
  type SolicitudDetalle,
} from "../../../../models/solicitud.model";
import type {
  DocumentoSubsanable,
  OferenteSubsanacion,
  RegistroSubsanacion,
  ResumenOferenteSubsanacion,
  Subsanacion,
} from "../../../../models/subsanacion.model";
import {
  documentosObservados,
  estadoSubsanacion,
  etiquetaMotivo,
  resumenSubsanacion,
  tieneObservaciones,
} from "../../../../models/subsanacion.model";
import { CalendarioFestivosService } from "../../../../services/calendario-festivos.service";
import {
  BorradorSubsanacionService,
  type BorradorSubsanacion,
} from "../../../../services/borrador-subsanacion.service";
import { SubsanacionService } from "../../../../services/subsanacion.service";
import {
  DialogoSubsanacionComponent,
  type DialogoSubsanacionDatos,
} from "../../../components/dialogo-subsanacion/dialogo-subsanacion.component";

type EstadoVista =
  | "cargando"
  | "listo"
  | "sin-oferentes"
  | "error"
  | "no-encontrado"
  | "no-disponible"
  | "sin-permiso";

type OrigenSubsanacion = "oferentes" | "detalle" | "comparador";

/**
 * Configuración del periodo de subsanación documental (S-12a).
 *
 * Solo se habilita en `en-evaluacion` (respuesta 2 del análisis): antes de esa
 * etapa todavía hay proveedores sin cargar documentos. Si ya existe un periodo,
 * la vista muestra su seguimiento o resultados y no permite crear otro encima.
 */
@Component({
  selector: "app-configurar-subsanacion",
  templateUrl: "./configurar-subsanacion.component.html",
  styleUrls: ["./configurar-subsanacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class ConfigurarSubsanacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(SubsanacionService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly dialogo = inject(MatDialog);
  private readonly alerta = inject(AlertService);
  private readonly borrador = inject(BorradorSubsanacionService);
  private readonly calendario = inject(CalendarioFestivosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly moneda = formatoCop;
  readonly minimo = MIN_CARACTERES_JUSTIFICACION;
  readonly etiquetaMotivo = etiquetaMotivo;

  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly candidatos = signal<readonly OferenteSubsanacion[]>([]);
  readonly seleccionados = signal<ReadonlySet<string>>(new Set<string>());
  readonly subsanacion = signal<Subsanacion | null>(null);
  readonly ahora = signal(Date.now());
  readonly busqueda = signal("");
  readonly anuncio = signal("");
  readonly ultimoGuardado = signal<string | null>(null);
  readonly borradorRestaurado = signal(false);
  readonly guardando = signal(false);
  /** Contador que fuerza a recalcular los resúmenes al cambiar el formulario. */
  private readonly formTick = signal(0);

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Subsanación documental</b></p>";

  private origen: OrigenSubsanacion = "oferentes";
  private proveedorId = "";
  private formularioListo = false;
  private aplicandoBorrador = false;
  private vigiaPeriodo?: Subscription;
  private cargaActual?: Subscription;

  /**
   * Valida el rango completo del periodo. Los controles individuales validan
   * obligatoriedad; este validador de grupo cruza cierre, inicio y fin.
   */
  private readonly validarPeriodo = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    const inicio = this.combinar(
      control.get("inicioFecha")?.value as string,
      control.get("inicioHora")?.value as string,
    );
    const fin = this.combinar(
      control.get("finFecha")?.value as string,
      control.get("finHora")?.value as string,
    );
    if (!inicio || !fin) {
      return null;
    }

    const inicioMarca = Date.parse(inicio);
    const finMarca = Date.parse(fin);
    if (!Number.isFinite(inicioMarca) || !Number.isFinite(finMarca)) {
      return { periodo: "Las fechas del periodo no son válidas." };
    }

    const cierre = fechaCierreSolicitud(this.solicitud()?.cierre ?? null);
    if (cierre !== null && inicioMarca <= cierre) {
      return {
        periodo:
          "El inicio de la subsanación debe ser posterior al cierre de la cotización.",
      };
    }
    if (inicioMarca < Date.now() - 5 * 60_000) {
      return { periodo: "El inicio de la subsanación no puede estar en el pasado." };
    }
    if (finMarca <= inicioMarca) {
      return {
        periodo:
          "La fecha de finalización debe ser posterior a la fecha de inicio.",
      };
    }
    if (finMarca <= Date.now()) {
      return { periodo: "La fecha de finalización debe ser futura." };
    }
    return null;
  };

  readonly formulario = new FormGroup(
    {
      inicioFecha: new FormControl("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      inicioHora: new FormControl("08:00", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      finFecha: new FormControl("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      finHora: new FormControl("17:00", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      motivo: new FormControl("", {
        nonNullable: true,
        validators: [
          Validators.required,
          justificacionMinima(MIN_CARACTERES_JUSTIFICACION),
        ],
      }),
      notificar: new FormControl(true, { nonNullable: true }),
      permitirReemplazo: new FormControl(true, { nonNullable: true }),
      oferentes: new FormArray<FormGroup>([]),
    },
    { validators: [this.validarPeriodo] },
  );

  readonly estadoPeriodo = computed<EstadoSubsanacion | null>(() => {
    const periodo = this.subsanacion();
    return periodo ? estadoSubsanacion(periodo, this.ahora()) : null;
  });

  readonly resumenPeriodo = computed(() => {
    const periodo = this.subsanacion();
    return periodo ? resumenSubsanacion(periodo, this.ahora()) : null;
  });

  readonly oferentesSeguimiento = computed<readonly ResumenOferenteSubsanacion[]>(
    () => this.resumenPeriodo()?.porOferente ?? [],
  );

  readonly candidatosFiltrados = computed<readonly OferenteSubsanacion[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) {
      return this.candidatos();
    }
    return this.candidatos().filter((oferente) =>
      `${oferente.nombre} ${oferente.nit} ${oferente.tipoPersona}`
        .toLowerCase()
        .includes(texto),
    );
  });

  readonly proveedoresConObservaciones = computed(
    () => this.candidatos().filter(tieneObservaciones).length,
  );

  readonly totalDocumentosSeleccionados = computed(() => {
    this.formTick();
    return this.contarDocumentosSeleccionados();
  });

  readonly documentosAfectanPuntaje = computed(() => {
    this.formTick();
    let total = 0;
    for (const grupo of this.formulario.controls.oferentes.controls) {
      const candidato = this.candidatoDeGrupo(grupo);
      if (!candidato) {
        continue;
      }
      for (const doc of this.documentosDe(grupo)) {
        if (
          doc.get("subsanable")?.value &&
          candidato.documentos.find(
            (item) => item.id === doc.get("documentoId")?.value,
          )?.afectaPuntaje
        ) {
          total += 1;
        }
      }
    }
    return total;
  });

  readonly duracionDias = computed(() => {
    this.formTick();
    const inicio = this.fechaInicioIso;
    const fin = this.fechaFinIso;
    if (!inicio || !fin || fin < inicio) {
      return 0;
    }
    const festivos = this.calendario.fechasFestivas();
    const dias = diasHabilesEntre(
      inicio.slice(0, 10),
      fin.slice(0, 10),
      festivos,
    );
    const inicioHabil = this.esDiaHabil(inicio.slice(0, 10), festivos);
    return dias + (inicioHabil ? 1 : 0);
  });

  readonly duracionHoras = computed(() => {
    this.formTick();
    const inicio = Date.parse(this.fechaInicioIso);
    const fin = Date.parse(this.fechaFinIso);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      return 0;
    }
    return Math.round((fin - inicio) / 3_600_000);
  });

  readonly calendarioDegradado = computed(() => this.calendario.degradado());

  readonly puedeConfigurar = computed(() => {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return false;
    }
    return this.permisos.puedeConfigurarSubsanacion({
      ...solicitud,
      subsanacion: this.subsanacion(),
    });
  });

  readonly puedeCancelar = computed(() => {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return false;
    }
    return this.permisos.puedeCancelarSubsanacion({
      ...solicitud,
      subsanacion: this.subsanacion(),
    });
  });

  readonly puedeAmpliar = computed(() => {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return false;
    }
    return this.permisos.puedeAmpliarSubsanacion({
      ...solicitud,
      subsanacion: this.subsanacion(),
    });
  });

  readonly esPeriodoVigente = computed(() => {
    const estado = this.estadoPeriodo();
    return estado === "configurada" || estado === "activa";
  });

  readonly etiquetaVolver = computed(() => {
    if (this.origen === "detalle") {
      return "Volver al detalle del proveedor";
    }
    if (this.origen === "comparador") {
      return "Volver al comparador";
    }
    return "Volver al tablero de oferentes";
  });

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;
    this.origen =
      this.ruta.snapshot.queryParamMap.get("volver") === "detalle"
        ? "detalle"
        : this.ruta.snapshot.queryParamMap.get("volver") === "comparador"
          ? "comparador"
          : "oferentes";
    this.proveedorId =
      this.ruta.snapshot.queryParamMap.get("proveedorId") ?? "";

    if (resolucion.estado !== "ok") {
      this.vista.set(
        resolucion.estado === "no-encontrada" ? "no-encontrado" : "error",
      );
      if (resolucion.estado === "error") {
        this.mensajeError.set(resolucion.mensaje);
      }
      return;
    }

    const solicitud = resolucion.solicitud;
    this.solicitud.set(solicitud);
    this.subsanacion.set(solicitud.subsanacion ?? null);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${solicitud.id} › Evaluación › <b>Subsanación documental</b></p>`;

    if (!this.permisos.puedeVerSubsanacionPorRol()) {
      this.vista.set("sin-permiso");
      return;
    }

    if (!this.permisos.puedeVerOfertas(solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    if (!this.permisos.puedeAccederSubsanacion(solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    this.prepararFormulario();
    this.vigilarPeriodo();

    if (this.subsanacion()) {
      this.vista.set("listo");
      // Un periodo cancelado no bloquea uno nuevo: se cargan los candidatos
      // para mostrar el formulario debajo del resumen del periodo cancelado.
      if (
        this.subsanacion()?.cancelacion &&
        this.permisos.puedeConfigurarSubsanacion(solicitud)
      ) {
        this.cargarCandidatos();
      }
      return;
    }

    if (!this.permisos.puedeConfigurarSubsanacion(solicitud)) {
      this.vista.set("no-disponible");
      return;
    }

    this.cargarCandidatos();
  }

  /* ── Carga y formulario ───────────────────────────────────────────────── */

  cargarCandidatos(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    this.cargaActual?.unsubscribe();
    this.cargaActual = this.servicio
      .obtenerOferentesSubsanables(solicitud)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (candidatos) => {
          this.candidatos.set(candidatos);
          if (candidatos.length === 0) {
            this.vista.set("sin-oferentes");
            return;
          }
          try {
            this.inicializarFormulario();
            this.vista.set("listo");
          } catch {
            this.mensajeError.set(
              "No fue posible preparar el formulario de subsanación. Intente nuevamente.",
            );
            this.vista.set("error");
          }
        },
        error: (fallo: Error) => {
          this.mensajeError.set(
            fallo.message ||
              "No fue posible consultar los oferentes subsanables. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  private prepararFormulario(): void {
    this.formulario.controls.inicioFecha.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCalendario());
    this.formulario.controls.finFecha.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarCalendario());

    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update((valor) => valor + 1));

    this.formulario.valueChanges
      .pipe(debounceTime(900), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (
          !this.formularioListo ||
          this.aplicandoBorrador ||
          this.esPeriodoVigente() ||
          this.guardando()
        ) {
          return;
        }
        this.guardarBorrador(false);
      });
  }

  private inicializarFormulario(): void {
    this.aplicandoBorrador = true;
    this.borradorRestaurado.set(false);
    this.ultimoGuardado.set(null);
    try {
      this.formulario.controls.oferentes.clear();
      this.formulario.reset({
        inicioFecha: "",
        inicioHora: "08:00",
        finFecha: "",
        finHora: "17:00",
        motivo: "",
        notificar: true,
        permitirReemplazo: true,
      });

      const candidatos = this.candidatos();
      const observados = candidatos
        .filter(tieneObservaciones)
        .map((oferente) => oferente.proveedorId);
      this.seleccionados.set(new Set(observados));
      this.sincronizarOferentes();

      const borrador = this.solicitud()
        ? this.borrador.cargar(this.solicitud()!.id)
        : null;
      if (borrador && !this.subsanacion()) {
        this.aplicarBorrador(borrador);
      }

      this.formulario.markAsPristine();
      this.formulario.markAsUntouched();
      this.cargarCalendario();
    } finally {
      this.aplicandoBorrador = false;
      this.formularioListo = true;
    }
  }

  private aplicarBorrador(borrador: BorradorSubsanacion): void {
    this.aplicandoBorrador = true;
    try {
      this.seleccionados.set(new Set(borrador.seleccionados));
      this.sincronizarOferentes();
      this.formulario.patchValue(
        borrador.formValue as Parameters<typeof this.formulario.patchValue>[0],
      );
      this.ultimoGuardado.set(borrador.savedAt);
      this.borradorRestaurado.set(true);
      this.anuncio.set("Borrador de subsanación restaurado.");
    } catch {
      // Un borrador viejo o incompatible no debe romper la vista.
      const solicitud = this.solicitud();
      if (solicitud) {
        this.borrador.eliminar(solicitud.id);
      }
      this.borradorRestaurado.set(false);
      this.ultimoGuardado.set(null);
    } finally {
      this.aplicandoBorrador = false;
    }
  }

  private cargarCalendario(): void {
    const inicio = this.formulario.controls.inicioFecha.value;
    const fin = this.formulario.controls.finFecha.value;
    const anios = aniosDelRango(inicio, fin);
    if (anios.length > 0) {
      this.calendario.cargar(anios);
    }
  }

  /* ── Selección de oferentes ───────────────────────────────────────────── */

  estaSeleccionado(proveedorId: string): boolean {
    return this.seleccionados().has(proveedorId);
  }

  toggleOferente(proveedorId: string, evento: { checked: boolean }): void {
    this.seleccionados.update((actuales) => {
      const copia = new Set(actuales);
      if (evento.checked) {
        copia.add(proveedorId);
      } else {
        copia.delete(proveedorId);
      }
      return copia;
    });
    this.sincronizarOferentes();
  }

  seleccionarConObservaciones(): void {
    const ids = this.candidatos()
      .filter(tieneObservaciones)
      .map((oferente) => oferente.proveedorId);
    this.seleccionados.set(new Set(ids));
    this.sincronizarOferentes();
  }

  private sincronizarOferentes(): void {
    const array = this.formulario.controls.oferentes;
    const ids = this.seleccionados();

    for (let indice = array.length - 1; indice >= 0; indice -= 1) {
      const id = array.at(indice).get("proveedorId")?.value as string;
      if (!ids.has(id)) {
        array.removeAt(indice);
      }
    }

    for (const id of ids) {
      if (this.grupoDe(id)) {
        continue;
      }
      const candidato = this.candidatos().find(
        (oferente) => oferente.proveedorId === id,
      );
      if (candidato) {
        array.push(this.crearGrupoOferente(candidato));
      }
    }
  }

  private crearGrupoOferente(candidato: OferenteSubsanacion): FormGroup {
    return new FormGroup({
      proveedorId: new FormControl(candidato.proveedorId, {
        nonNullable: true,
      }),
      documentos: new FormArray<FormGroup>(
        candidato.documentos.map((documento) =>
          this.crearGrupoDocumento(documento),
        ),
      ),
    });
  }

  private crearGrupoDocumento(documento: DocumentoSubsanable): FormGroup {
    const seleccionado = documento.subsanable && documento.seleccionado;
    return new FormGroup({
      documentoId: new FormControl(documento.id, { nonNullable: true }),
      subsanable: new FormControl(seleccionado, { nonNullable: true }),
      observacion: new FormControl(documento.observacion, {
        nonNullable: true,
        validators: seleccionado
          ? [Validators.required, justificacionMinima(this.minimo)]
          : [],
      }),
    });
  }

  private grupoDe(proveedorId: string): FormGroup | null {
    return (
      this.formulario.controls.oferentes.controls.find(
        (grupo) => grupo.get("proveedorId")?.value === proveedorId,
      ) ?? null
    );
  }

  documentosDe(grupo: FormGroup): FormGroup[] {
    return (grupo.get("documentos") as FormArray<FormGroup>).controls;
  }

  candidatoDeGrupo(grupo: FormGroup): OferenteSubsanacion | null {
    const id = grupo.get("proveedorId")?.value as string;
    return (
      this.candidatos().find((oferente) => oferente.proveedorId === id) ?? null
    );
  }

  documentoDeGrupo(
    grupo: FormGroup,
    documentoGrupo: FormGroup,
  ): DocumentoSubsanable | null {
    const candidato = this.candidatoDeGrupo(grupo);
    const id = documentoGrupo.get("documentoId")?.value as string;
    return candidato?.documentos.find((documento) => documento.id === id) ?? null;
  }

  controlObservacion(documentoGrupo: FormGroup): FormControl<string> {
    return documentoGrupo.get("observacion") as FormControl<string>;
  }

  controlSubsanable(documentoGrupo: FormGroup): FormControl<boolean> {
    return documentoGrupo.get("subsanable") as FormControl<boolean>;
  }

  alCambiarSubsanable(
    documentoGrupo: FormGroup,
    evento: MatSlideToggleChange,
  ): void {
    const control = this.controlSubsanable(documentoGrupo);
    control.setValue(evento.checked);
    const observacion = this.controlObservacion(documentoGrupo);
    if (evento.checked) {
      observacion.setValidators([
        Validators.required,
        justificacionMinima(this.minimo),
      ]);
    } else {
      observacion.clearValidators();
    }
    observacion.updateValueAndValidity();
    if (evento.checked && !observacion.value.trim()) {
      observacion.markAsTouched();
    }
  }

  mostrarErrorObservacion(documentoGrupo: FormGroup): boolean {
    const control = this.controlObservacion(documentoGrupo);
    return control.invalid && control.touched;
  }

  marcarObservacionTocada(documentoGrupo: FormGroup): void {
    this.controlObservacion(documentoGrupo).markAsTouched();
  }

  documentosObservadosDe(oferente: OferenteSubsanacion): number {
    return documentosObservados(oferente).length;
  }

  estadoCandidato(oferente: OferenteSubsanacion) {
    if (this.estaSeleccionado(oferente.proveedorId)) {
      return "requiere-subsanacion" as const;
    }
    return tieneObservaciones(oferente)
      ? ("requiere-subsanacion" as const)
      : ("sin-observaciones" as const);
  }

  contarDocumentosSeleccionados(): number {
    return this.formulario.controls.oferentes.controls.reduce(
      (total, grupo) =>
        total +
        this.documentosDe(grupo).filter(
          (documento) => documento.get("subsanable")?.value === true,
        ).length,
      0,
    );
  }

  /* ── Periodo y resumen ────────────────────────────────────────────────── */

  get fechaInicioIso(): string {
    return this.combinar(
      this.formulario.controls.inicioFecha.value,
      this.formulario.controls.inicioHora.value,
    );
  }

  get fechaFinIso(): string {
    return this.combinar(
      this.formulario.controls.finFecha.value,
      this.formulario.controls.finHora.value,
    );
  }

  get minInicio(): Date | null {
    return this.fechaDesdeCorta(this.solicitud()?.cierre ?? null);
  }

  get minFin(): Date | null {
    return this.fechaDesdeCorta(this.formulario.controls.inicioFecha.value);
  }

  get errorPeriodo(): string {
    const error = this.formulario.errors?.["periodo"];
    return typeof error === "string" ? error : "";
  }

  get errorSeleccion(): string {
    if (this.proveedoresSeleccionados === 0) {
      return "Debe seleccionar al menos un oferente para habilitar el periodo de subsanación.";
    }
    if (this.totalDocumentosSeleccionados() === 0) {
      return "Selecciona al menos un documento subsanable en los oferentes elegidos.";
    }
    if (this.proveedoresSinDocumentos() > 0) {
      return "Cada oferente seleccionado debe tener al menos un documento subsanable.";
    }
    return "";
  }

  /** Oferentes seleccionados que todavía no tienen ningún documento marcado. */
  proveedoresSinDocumentos(): number {
    return this.formulario.controls.oferentes.controls.filter((grupo) =>
      this.documentosDe(grupo).every(
        (documento) => documento.get("subsanable")?.value !== true,
      ),
    ).length;
  }

  get proveedoresSeleccionados(): number {
    return this.formulario.controls.oferentes.length;
  }

  get mostrarErrorMotivo(): boolean {
    const control = this.formulario.controls.motivo;
    return control.invalid && (control.touched || control.dirty);
  }

  marcarMotivoTocado(): void {
    this.formulario.controls.motivo.markAsTouched();
  }

  get puedeHabilitar(): boolean {
    return (
      this.vista() === "listo" &&
      !this.guardando() &&
      this.formulario.valid &&
      this.proveedoresSeleccionados > 0 &&
      this.totalDocumentosSeleccionados() > 0 &&
      this.proveedoresSinDocumentos() === 0 &&
      !this.esPeriodoVigente()
    );
  }

  formatear(iso: string): string {
    return formatoFechaHoraOferente(iso);
  }

  /** Duración legible del periodo configurado (para el resumen). */
  duracionPeriodo(periodo: Subsanacion): string {
    const inicio = periodo.inicio.slice(0, 10);
    const fin = periodo.fin.slice(0, 10);
    const festivos = this.calendario.fechasFestivas();
    const dias = diasHabilesEntre(inicio, fin, festivos);
    const inicioHabil = this.esDiaHabil(inicio, festivos);
    const total = dias + (inicioHabil ? 1 : 0);
    return `${total} ${total === 1 ? "día hábil" : "días hábiles"}`;
  }

  private construirRegistro(): RegistroSubsanacion | null {
    this.formulario.markAllAsTouched();
    if (!this.puedeHabilitar) {
      return null;
    }

    const oferentes = this.formulario.controls.oferentes.controls
      .map((grupo) => {
        const proveedorId = grupo.get("proveedorId")?.value as string;
        const documentos = this.documentosDe(grupo)
          .filter((documento) => documento.get("subsanable")?.value === true)
          .map((documento) => ({
            documentoId: documento.get("documentoId")?.value as string,
            observacion: (
              documento.get("observacion")?.value as string
            ).trim(),
          }));
        return { proveedorId, documentos };
      })
      .filter((oferente) => oferente.documentos.length > 0);

    return {
      oferentes,
      inicio: this.fechaInicioIso,
      fin: this.fechaFinIso,
      motivoHtml: this.formulario.controls.motivo.value,
      notificar: this.formulario.controls.notificar.value,
      permitirReemplazo: this.formulario.controls.permitirReemplazo.value,
    };
  }

  /* ── Acciones ─────────────────────────────────────────────────────────── */

  habilitar(): void {
    if (this.guardando()) {
      return;
    }
    const solicitud = this.solicitud();
    const registro = this.construirRegistro();
    if (!solicitud || !registro) {
      return;
    }

    this.guardando.set(true);
    const referencia = this.dialogo.open<
      DialogoSubsanacionComponent,
      DialogoSubsanacionDatos,
      Subsanacion | undefined
    >(DialogoSubsanacionComponent, {
      data: {
        modo: "configurar",
        solicitud,
        registro,
        resumen: {
          oferentes: registro.oferentes.length,
          documentos: registro.oferentes.reduce(
            (total, oferente) => total + oferente.documentos.length,
            0,
          ),
          inicio: registro.inicio,
          fin: registro.fin,
          notificar: registro.notificar,
        },
      },
      width: "40rem",
      maxWidth: "96vw",
      autoFocus: ".dialogo__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-subsanacion-titulo",
    });

    referencia
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((periodo) => {
        this.guardando.set(false);
        if (periodo) {
          this.aplicarPeriodo(periodo);
        }
      });
  }

  cancelarPeriodo(): void {
    const solicitud = this.solicitud();
    if (!solicitud || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    const referencia = this.dialogo.open<
      DialogoSubsanacionComponent,
      DialogoSubsanacionDatos,
      Subsanacion | undefined
    >(DialogoSubsanacionComponent, {
      data: { modo: "cancelar", solicitud },
      width: "38rem",
      maxWidth: "96vw",
      autoFocus: ".dialogo__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-subsanacion-titulo",
    });
    referencia
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((periodo) => {
        this.guardando.set(false);
        if (periodo) {
          this.aplicarPeriodo(periodo);
          this.cargarCandidatos();
        }
      });
  }

  ampliarPeriodo(): void {
    const solicitud = this.solicitud();
    if (!solicitud || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    const referencia = this.dialogo.open<
      DialogoSubsanacionComponent,
      DialogoSubsanacionDatos,
      Subsanacion | undefined
    >(DialogoSubsanacionComponent, {
      data: { modo: "ampliar", solicitud },
      width: "38rem",
      maxWidth: "96vw",
      autoFocus: ".dialogo__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-subsanacion-titulo",
    });
    referencia
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((periodo) => {
        this.guardando.set(false);
        if (periodo) {
          this.aplicarPeriodo(periodo);
        }
      });
  }

  private aplicarPeriodo(periodo: Subsanacion): void {
    this.subsanacion.set(periodo);
    this.solicitud.update((solicitud) =>
      solicitud ? { ...solicitud, subsanacion: periodo } : solicitud,
    );
    this.ahora.set(Date.now());
    this.anuncio.set(
      periodo.cancelacion
        ? "Periodo de subsanación cancelado."
        : "Periodo de subsanación actualizado.",
    );
    if (this.solicitud()) {
      this.borrador.eliminar(this.solicitud()!.id);
    }
    this.vigilarPeriodo();
  }

  guardarBorrador(mostrarMensaje = true): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.formularioListo) {
      return;
    }
    const ahora = new Date().toISOString();
    const guardado = this.borrador.guardar(solicitud.id, {
      version: 1,
      currentStep: 1,
      savedAt: ahora,
      formValue: this.formulario.getRawValue() as Record<string, unknown>,
      seleccionados: [...this.seleccionados()],
    });
    if (!guardado) {
      this.anuncio.set(
        "No fue posible guardar el borrador en este navegador.",
      );
      return;
    }
    this.ultimoGuardado.set(ahora);
    this.anuncio.set("Borrador de subsanación guardado.");
    if (mostrarMensaje) {
      void this.alerta.showSuccessAlert(
        "El avance del formulario quedó guardado en este navegador.",
        "Borrador guardado",
      );
    }
  }

  cancelarFormulario(): void {
    const tieneAvance =
      this.formulario.dirty ||
      this.seleccionados().size > 0 ||
      this.formulario.controls.motivo.value.trim().length > 0;
    if (!tieneAvance) {
      this.volver();
      return;
    }

    void this.alerta
      .showConfirmAlert(
        "Se perderán los cambios no guardados del formulario de subsanación.",
        "Descartar cambios",
      )
      .then((confirmacion) => {
        if (!confirmacion.isConfirmed) {
          return;
        }
        const solicitud = this.solicitud();
        if (solicitud) {
          this.borrador.eliminar(solicitud.id);
        }
        this.volver();
      });
  }

  volver(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes"]);
      return;
    }
    if (this.origen === "detalle" && this.proveedorId) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
        "proveedores",
        this.proveedorId,
      ]);
      return;
    }
    if (this.origen === "comparador") {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
      ]);
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "oferentes",
    ]);
  }

  irAlHistorial(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "subsanacion",
      "historial",
    ]);
  }

  irAlComparador(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "evaluacion",
    ]);
  }

  verCotizacion(proveedorId: string): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate(
      [
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
        "proveedores",
        proveedorId,
      ],
      { queryParams: { volver: "subsanacion", tab: "cotizacion" } },
    );
  }

  reintentarCarga(): void {
    if (this.solicitud()) {
      this.cargarCandidatos();
      return;
    }
    this.reintentarResolucion();
  }

  reintentarResolucion(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }

  /* ── Seguimiento ──────────────────────────────────────────────────────── */

  private vigilarPeriodo(): void {
    this.vigiaPeriodo?.unsubscribe();
    const periodo = this.subsanacion();
    if (
      !periodo ||
      periodo.cancelacion ||
      estadoSubsanacion(periodo, Date.now()) === "vencida"
    ) {
      return;
    }
    this.vigiaPeriodo = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.ahora.set(Date.now());
        if (estadoSubsanacion(periodo, Date.now()) === "vencida") {
          this.vigiaPeriodo?.unsubscribe();
        }
      });
  }

  avanceOferente(resumen: ResumenOferenteSubsanacion): string {
    return `${resumen.subsanados}/${resumen.total}`;
  }

  /* ── Utilidades ───────────────────────────────────────────────────────── */

  private combinar(fecha: string, hora: string): string {
    return fecha && hora ? `${fecha}T${hora}:00-05:00` : "";
  }

  private fechaDesdeCorta(valor: string | null): Date | null {
    if (!valor) {
      return null;
    }
    const [dia, mes, anio] = valor.split("/").map(Number);
    if (!dia || !mes || !anio) {
      return null;
    }
    const fecha = new Date(anio, mes - 1, dia);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private esDiaHabil(
    iso: string,
    festivos: ReadonlySet<string>,
  ): boolean {
    const fecha = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) {
      return false;
    }
    const dia = fecha.getDay();
    return dia !== 0 && dia !== 6 && !festivos.has(iso);
  }
}
