import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime } from "rxjs";
import { ESTADOS_ESTUDIO_MERCADO } from "src/app/core/constants/estados-solicitud.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  CriteriosProveedoresEstudio,
  ETIQUETAS_ESTADO_INSCRIPCION,
  ETIQUETAS_TIPO_PERSONA_FILTRO,
  EstudioMercado,
  OrdenProveedoresEstudio,
  ProveedorEstudio,
  ResultadoProveedoresEstudio,
  TipoPersonaFiltro,
  asuntoInvitacionEstudio,
  ciudadesProveedores,
  departamentosProveedores,
  estadoEstudioMercado,
  formatoFechaHoraEstudio,
} from "../../../../models/estudio-mercado.model";
import type { ActividadVinculada } from "../../../../models/proveedores.model";
import { EstudiosMercadoService } from "../../../../services/estudios-mercado.service";
import {
  DialogoInvitacionEstudioComponent,
  DialogoInvitacionEstudioDatos,
} from "../components/dialogo-invitacion-estudio/dialogo-invitacion-estudio.component";
import {
  DialogoDetalleProveedorEstudioComponent,
  DialogoDetalleProveedorEstudioDatos,
} from "../components/dialogo-detalle-proveedor-estudio/dialogo-detalle-proveedor-estudio.component";

type EstadoEstudioVista =
  | "cargando"
  | "listo"
  | "error"
  | "no-encontrado"
  | "sin-permiso";

type EstadoProveedores = "inicial" | "cargando" | "listo" | "error";

/**
 * Página de búsqueda e invitación de proveedores por actividad (S-13b).
 *
 * Reutiliza el mismo componente para un estudio existente. La creación
 * económica vive en el modal del listado; esta página solo trabaja sobre un
 * estudio ya creado.
 */
@Component({
  selector: "app-crear-estudio",
  templateUrl: "./crear-estudio.component.html",
  styleUrls: ["./crear-estudio.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class CrearEstudioComponent implements OnInit {
  private readonly servicio = inject(EstudiosMercadoService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vistaEstudio = signal<EstadoEstudioVista>("cargando");
  readonly vistaProveedores = signal<EstadoProveedores>("inicial");
  readonly estudio = signal<EstudioMercado | null>(null);
  readonly mensajeError = signal("");
  readonly anuncio = signal("");
  readonly proveedores = signal<readonly ProveedorEstudio[]>([]);
  readonly todos = signal<readonly ProveedorEstudio[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly porPagina = signal(10);
  readonly seleccionados = signal<ReadonlySet<string>>(new Set<string>());

  readonly departamentos = departamentosProveedores();
  readonly ciudades = signal<readonly string[]>(ciudadesProveedores(""));
  readonly tiposPersona = Object.entries(ETIQUETAS_TIPO_PERSONA_FILTRO) as [
    TipoPersonaFiltro,
    string,
  ][];
  readonly estadosInscripcion = Object.entries(ETIQUETAS_ESTADO_INSCRIPCION) as [
    string,
    string,
  ][];
  readonly ordenes: readonly { valor: OrdenProveedoresEstudio; etiqueta: string }[] = [
    { valor: "coincidencia", etiqueta: "Mayor coincidencia CIIU" },
    { valor: "razon-social", etiqueta: "Razón social (A-Z)" },
    { valor: "rup", etiqueta: "Fecha validación RUP" },
  ];

  readonly formulario = new FormGroup({
    actividades: new FormControl<readonly ActividadVinculada[]>([], {
      nonNullable: true,
    }),
    areaSnies: new FormControl("", { nonNullable: true }),
    nucleoSnies: new FormControl("", { nonNullable: true }),
    tipoPersona: new FormControl<TipoPersonaFiltro>("todos", {
      nonNullable: true,
    }),
    departamento: new FormControl("", { nonNullable: true }),
    ciudad: new FormControl("", { nonNullable: true }),
    estadoInscripcion: new FormControl("activo", { nonNullable: true }),
    palabraClave: new FormControl("", { nonNullable: true }),
    orden: new FormControl<OrdenProveedoresEstudio>("coincidencia", {
      nonNullable: true,
    }),
  });

  readonly tipoNecesidad = computed(
    () => this.estudio()?.tipoNecesidad ?? "bienes",
  );

  readonly estado = computed(() => {
    const estudio = this.estudio();
    return estudio ? estadoEstudioMercado(estudio) : null;
  });

  readonly puedeInvitar = computed(() => {
    const estado = this.estado();
    return estado === "borrador" || estado === "en-recepcion";
  });

  readonly seleccionadosProveedores = computed(() => {
    const ids = this.seleccionados();
    return this.todos().filter((proveedor) =>
      ids.has(proveedor.proveedor.id),
    );
  });

  readonly seleccionTotal = computed(() => {
    const ids = this.todos()
      .filter((proveedor) => proveedor.estadoInvitacion === "sin-invitar")
      .map((proveedor) => proveedor.proveedor.id);
    return ids.length > 0 && ids.every((id) => this.seleccionados().has(id));
  });

  readonly seleccionParcial = computed(() => {
    const ids = this.todos()
      .filter((proveedor) => proveedor.estadoInvitacion === "sin-invitar")
      .map((proveedor) => proveedor.proveedor.id);
    const marcados = ids.filter((id) => this.seleccionados().has(id)).length;
    return marcados > 0 && marcados < ids.length;
  });

  get breadcrumb(): string {
    const estudio = this.estudio();
    return estudio
      ? `<p>Gestión Proveedor › Cotizaciones › Estudios de mercado › ${estudio.id} › <b>Proveedores</b></p>`
      : "<p>Gestión Proveedor › Cotizaciones › Estudios de mercado › <b>Proveedores</b></p>";
  }

  ngOnInit(): void {
    if (!this.permisos.puedeCrearEstudio()) {
      this.vistaEstudio.set("sin-permiso");
      return;
    }
    this.cargarEstudio();
    this.formulario.controls.departamento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((departamento) => {
        this.ciudades.set(ciudadesProveedores(departamento));
        this.formulario.controls.ciudad.setValue("", { emitEvent: false });
      });
    this.formulario.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.limpiarSeleccion();
        this.pagina.set(0);
        this.buscar();
      });
  }

  reintentarCarga(): void {
    this.cargarEstudio();
  }

  private cargarEstudio(): void {
    const id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.vistaEstudio.set("cargando");
    this.mensajeError.set("");
    this.servicio
      .obtenerPorId(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estudio) => {
          if (!estudio) {
            this.vistaEstudio.set("no-encontrado");
            return;
          }
          this.estudio.set(estudio);
          this.formulario.patchValue({
            actividades: [...estudio.actividades],
            areaSnies: estudio.areaSnies,
            nucleoSnies: estudio.nucleoSnies,
          });
          this.vistaEstudio.set("listo");
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar el estudio de mercado.",
          );
          this.vistaEstudio.set("error");
        },
      });
  }

  buscar(): void {
    const estudio = this.estudio();
    if (!estudio) {
      return;
    }
    const actividades = this.formulario.controls.actividades.value;
    if (actividades.length === 0) {
      this.proveedores.set([]);
      this.todos.set([]);
      this.total.set(0);
      this.vistaProveedores.set("inicial");
      this.anuncio.set(
        "Seleccione al menos una actividad económica para buscar proveedores.",
      );
      return;
    }

    this.vistaProveedores.set("cargando");
    this.mensajeError.set("");
    this.servicio
      .buscarProveedores(this.criterios(estudio))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoProveedoresEstudio) => {
          this.proveedores.set(resultado.proveedores);
          this.todos.set(resultado.todos);
          this.total.set(resultado.total);
          this.vistaProveedores.set("listo");
          this.anuncio.set(
            `${resultado.total} ${
              resultado.total === 1
                ? "proveedor encontrado"
                : "proveedores encontrados"
            } con las actividades seleccionadas.`,
          );
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar el banco de proveedores.",
          );
          this.vistaProveedores.set("error");
        },
      });
  }

  private criterios(estudio: EstudioMercado): CriteriosProveedoresEstudio {
    return {
      estudioId: estudio.id,
      actividades: this.formulario.controls.actividades.value.map(
        (actividad) => actividad.codigo,
      ),
      areaSnies: this.formulario.controls.areaSnies.value,
      nucleoSnies: this.formulario.controls.nucleoSnies.value,
      tipoNecesidad: estudio.tipoNecesidad,
      tipoPersona: this.formulario.controls.tipoPersona.value,
      departamento: this.formulario.controls.departamento.value,
      ciudad: this.formulario.controls.ciudad.value,
      estadoInscripcion: this.formulario.controls.estadoInscripcion.value,
      palabraClave: this.formulario.controls.palabraClave.value,
      orden: this.formulario.controls.orden.value,
      pagina: this.pagina(),
      porPagina: this.porPagina(),
    };
  }

  cambiarPagina(indice: number): void {
    this.pagina.set(indice);
    this.buscar();
  }

  cambiarPorPagina(valor: number): void {
    this.porPagina.set(valor);
    this.pagina.set(0);
    this.buscar();
  }

  toggleProveedor(evento: { id: string; checked: boolean }): void {
    const seleccionados = new Set(this.seleccionados());
    if (evento.checked) {
      seleccionados.add(evento.id);
    } else {
      seleccionados.delete(evento.id);
    }
    this.seleccionados.set(seleccionados);
  }

  toggleTodos(checked: boolean): void {
    const seleccionados = new Set(this.seleccionados());
    for (const proveedor of this.todos()) {
      if (proveedor.estadoInvitacion !== "sin-invitar") {
        continue;
      }
      if (checked) {
        seleccionados.add(proveedor.proveedor.id);
      } else {
        seleccionados.delete(proveedor.proveedor.id);
      }
    }
    this.seleccionados.set(seleccionados);
  }

  limpiarSeleccion(): void {
    this.seleccionados.set(new Set<string>());
  }

  limpiarFiltros(): void {
    this.formulario.patchValue({
      tipoPersona: "todos",
      departamento: "",
      ciudad: "",
      estadoInscripcion: "activo",
      palabraClave: "",
      orden: "coincidencia",
    });
    this.pagina.set(0);
  }

  buscarExplicito(): void {
    this.pagina.set(0);
    this.buscar();
  }

  abrirInvitacion(): void {
    const estudio = this.estudio();
    const proveedores = this.seleccionadosProveedores();
    if (!estudio || proveedores.length === 0) {
      void this.alerta.showAlert(
        "Sin proveedores seleccionados",
        "Seleccione al menos un proveedor para enviar la invitación.",
      );
      return;
    }

    const datos: DialogoInvitacionEstudioDatos = {
      estudio,
      proveedores,
      asunto:
        estudio.asunto ||
        asuntoInvitacionEstudio(estudio.id, estudio.objeto),
      mensaje: estudio.mensaje,
      fechaLimite: estudio.fechaLimite,
    };

    const ref = this.dialogo.open<
      DialogoInvitacionEstudioComponent,
      DialogoInvitacionEstudioDatos,
      EstudioMercado
    >(DialogoInvitacionEstudioComponent, {
      data: datos,
      width: "48rem",
      maxWidth: "96vw",
      maxHeight: "92vh",
      autoFocus: "first-tabbable",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-invitacion-titulo",
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((actualizado) => {
        if (actualizado) {
          this.estudio.set(actualizado);
          this.limpiarSeleccion();
          void this.router.navigate(["cotizaciones", "estudios-mercado"]);
        }
      });
  }

  invitarProveedor(proveedor: ProveedorEstudio): void {
    if (!this.puedeInvitar()) {
      return;
    }
    this.toggleProveedor({ id: proveedor.proveedor.id, checked: true });
    this.abrirInvitacion();
  }

  abrirDetalleProveedor(proveedor: ProveedorEstudio): void {
    const ref = this.dialogo.open<
      DialogoDetalleProveedorEstudioComponent,
      DialogoDetalleProveedorEstudioDatos,
      "invitar" | undefined
    >(DialogoDetalleProveedorEstudioComponent, {
      data: { proveedor, permiteInvitar: this.puedeInvitar() },
      width: "34rem",
      maxWidth: "96vw",
      maxHeight: "92vh",
      autoFocus: ".detalle-proveedor__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "detalle-proveedor-titulo",
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((accion) => {
        if (accion === "invitar") {
          this.toggleProveedor({
            id: proveedor.proveedor.id,
            checked: true,
          });
          this.abrirInvitacion();
        }
      });
  }

  volver(): void {
    void this.router.navigate(["cotizaciones", "estudios-mercado"]);
  }

  etiquetaEstado(): string {
    const estado = this.estado();
    return estado ? ESTADOS_ESTUDIO_MERCADO[estado].etiqueta : "—";
  }

  formatoFecha(valor: string | null): string {
    return formatoFechaHoraEstudio(valor);
  }
}
