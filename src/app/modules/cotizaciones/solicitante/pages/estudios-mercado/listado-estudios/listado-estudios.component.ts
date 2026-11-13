import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { Subscription } from "rxjs";
import {
  ACCIONES_ESTUDIO_MERCADO,
  AccionEstudioMercado,
  ESTADOS_ESTUDIO_MERCADO,
  EstadoEstudioMercado,
} from "src/app/core/constants/estados-solicitud.const";
import { ACCIONES_ESTUDIO_MERCADO_POR_ROL_Y_ESTADO } from "src/app/core/constants/acciones-por-rol-y-estado.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import { CampoFiltro, FiltroRapido } from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ConteosEstudios,
  ETIQUETAS_METODO_PRECIO,
  EstudioMercado,
  FiltroEstudiosMercado,
  GrupoEstudio,
  ResultadoListadoEstudios,
  formatoFechaHoraEstudio,
  invitadosDe,
  respondieronDe,
} from "../../../../models/estudio-mercado.model";
import { formatoCop } from "../../../../models/necesidad.model";
import { EstudiosMercadoService, GRUPOS_ESTUDIO } from "../../../../services/estudios-mercado.service";
import {
  DialogoEstudioEconomicoComponent,
  DialogoEstudioEconomicoDatos,
} from "../components/dialogo-estudio-economico/dialogo-estudio-economico.component";
import { DialogoDetalleEstudioComponent } from "../components/dialogo-detalle-estudio/dialogo-detalle-estudio.component";
import { DialogoExportarEstudioComponent } from "../components/dialogo-exportar-estudio/dialogo-exportar-estudio.component";
import { DialogoDescartarEstudioComponent } from "../components/dialogo-descartar-estudio/dialogo-descartar-estudio.component";

type EstadoVista = "cargando" | "listo" | "error";

/**
 * Listado de estudios de mercado (S-13a).
 *
 * Es una ruta propia, no una pestaña de una solicitud: el estudio tiene su
 * ciclo de vida y su propio modelo. Las acciones de fila se resuelven con la
 * matriz rol+estado de estudios.
 */
@Component({
  selector: "app-listado-estudios",
  templateUrl: "./listado-estudios.component.html",
  styleUrls: ["./listado-estudios.component.scss"],
  standalone: false,
})
export class ListadoEstudiosComponent implements OnInit {
  private readonly servicio = inject(EstudiosMercadoService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly rol = inject(RolService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly dialogo = inject(MatDialog);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ACCIONES = ACCIONES_ESTUDIO_MERCADO;
  readonly ESTADOS = ESTADOS_ESTUDIO_MERCADO;
  readonly moneda = formatoCop;
  readonly formatoFechaHora = formatoFechaHoraEstudio;
  readonly invitadosDe = invitadosDe;
  readonly respondieronDe = respondieronDe;

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Estudios de mercado</b></p>";

  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly anuncio = signal("");

  estudios: readonly EstudioMercado[] = [];
  total = 0;
  pagina = 0;
  porPagina = 10;
  criterios: Partial<FiltroEstudiosMercado> = {
    vigencia: "2026",
    grupo: "todos",
  };
  grupoActivo: GrupoEstudio = "todos";
  conteos: ConteosEstudios = conteosVacios();
  dependencias: readonly string[] = [];
  filaMenuAbierto: string | null = null;

  readonly opcionesPorPagina: readonly number[] = [10, 25, 50];
  readonly columnasEsqueleto: readonly number[] = [
    140, 300, 120, 130, 130, 180, 120, 100, 56,
  ];

  camposFiltro: readonly CampoFiltro[] = [
    {
      clave: "vigencia",
      etiqueta: "Vigencia",
      tipo: "select",
      opciones: [
        { valor: "2026", etiqueta: "2026 (Predeterminada)" },
        { valor: "2025", etiqueta: "2025" },
        { valor: "2024", etiqueta: "2024" },
        { valor: "historico", etiqueta: "Histórico consolidado" },
      ],
      requerido: true,
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "select",
      opciones: [
        { valor: "", etiqueta: "Todos los estados" },
        { valor: "borrador", etiqueta: "Borrador" },
        { valor: "en-recepcion", etiqueta: "En recepción" },
        { valor: "cerrado", etiqueta: "Cerrado" },
        { valor: "aprobado", etiqueta: "Aprobado" },
      ],
    },
    {
      clave: "dependencia",
      etiqueta: "Dependencia",
      tipo: "select",
      opciones: [{ valor: "", etiqueta: "Todas las dependencias" }],
    },
    {
      clave: "busqueda",
      etiqueta: "Buscar por código, objeto o responsable",
      tipo: "texto",
      placeholder: "Ej. EM-2026-0001 o servidores",
    },
  ];

  readonly hayColumnaAcciones = computed(() =>
    this.rol.mostrarAcciones(ACCIONES_ESTUDIO_MERCADO_POR_ROL_Y_ESTADO),
  );

  readonly puedeCrear = computed(() => this.permisos.puedeCrearEstudio());

  private cargaActual?: Subscription;

  get filtrosRapidos(): readonly FiltroRapido[] {
    return GRUPOS_ESTUDIO.map((grupo) => ({
      valor: grupo.valor,
      etiqueta: grupo.etiqueta,
      conteo: this.conteos[grupo.valor],
    }));
  }

  get hayFiltrosAplicados(): boolean {
    return (
      this.grupoActivo !== "todos" ||
      !!this.criterios.busqueda ||
      !!this.criterios.estado ||
      !!this.criterios.dependencia ||
      (!!this.criterios.vigencia && this.criterios.vigencia !== "2026")
    );
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total, (this.pagina + 1) * this.porPagina);
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    const ventana = 5;
    let inicio = Math.max(1, this.pagina + 1 - Math.floor(ventana / 2));
    const fin = Math.min(total, inicio + ventana - 1);
    inicio = Math.max(1, fin - ventana + 1);
    const paginas: number[] = [];
    for (let indice = inicio; indice <= fin; indice++) {
      paginas.push(indice);
    }
    return paginas;
  }

  ngOnInit(): void {
    this.cargar();
    if (
      this.ruta.snapshot.data["abrirNuevo"] ||
      this.ruta.snapshot.queryParamMap.get("nuevo") === "1"
    ) {
      this.abrirNuevo();
    }
  }

  cargar(): void {
    this.cargaActual?.unsubscribe();
    this.vista.set("cargando");
    this.mensajeError.set("");
    this.anuncio.set("Cargando estudios de mercado…");

    this.cargaActual = this.servicio
      .listar(this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoListadoEstudios) => {
          this.estudios = resultado.estudios;
          this.total = resultado.total;
          this.conteos = resultado.conteos;
          this.dependencias = resultado.dependencias;
          this.actualizarDependencias();
          this.anuncio.set(
            `${resultado.total} ${
              resultado.total === 1
                ? "estudio de mercado encontrado"
                : "estudios de mercado encontrados"
            }.`,
          );
          this.vista.set("listo");
        },
        error: (error: Error) => {
          this.mensajeError.set(error.message);
          this.anuncio.set("No fue posible cargar los estudios de mercado.");
          this.vista.set("error");
        },
      });
  }

  filtrar(criterios: Record<string, string>): void {
    this.criterios = { ...criterios, grupo: "todos" } as Partial<FiltroEstudiosMercado>;
    this.grupoActivo = "todos";
    this.pagina = 0;
    this.cargar();
  }

  filtrarRapido(grupo: string): void {
    this.grupoActivo = grupo as GrupoEstudio;
    this.criterios = {
      ...this.criterios,
      estado: "",
      grupo: this.grupoActivo,
    };
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = { vigencia: "2026", grupo: "todos" };
    this.grupoActivo = "todos";
    this.pagina = 0;
    this.cargar();
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino === this.pagina) {
      return;
    }
    this.pagina = destino;
    this.cargar();
  }

  paginaAnterior(): void {
    this.irAPagina(this.pagina - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.pagina + 1);
  }

  primeraPagina(): void {
    this.irAPagina(0);
  }

  ultimaPagina(): void {
    this.irAPagina(this.totalPaginas - 1);
  }

  cambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (!Number.isFinite(valor) || valor === this.porPagina) {
      return;
    }
    this.porPagina = valor;
    this.pagina = 0;
    this.cargar();
  }

  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  accionesDe(estudio: EstudioMercado): readonly AccionEstudioMercado[] {
    return this.permisos.accionesEstudioPermitidas(estudio);
  }

  etiquetaAccion(accion: AccionEstudioMercado): string {
    return this.permisos.etiquetaAccionEstudio(accion);
  }

  esPeligro(accion: AccionEstudioMercado): boolean {
    return this.permisos.esPeligroEstudio(accion);
  }

  ejecutarAccion(accion: AccionEstudioMercado, estudio: EstudioMercado): void {
    switch (accion) {
      case "ver-detalle":
        this.abrirDetalle(estudio);
        return;
      case "editar":
        this.abrirNuevo(estudio);
        return;
      case "invitar-proveedores":
        this.irAProveedores(estudio);
        return;
      case "exportar":
        this.abrirExportar(estudio);
        return;
      case "descartar":
        this.abrirDescartar(estudio);
        return;
    }
  }

  abrirNuevo(estudio: EstudioMercado | null = null): void {
    const ref = this.dialogo.open<
      DialogoEstudioEconomicoComponent,
      DialogoEstudioEconomicoDatos,
      EstudioMercado
    >(DialogoEstudioEconomicoComponent, {
      data: { estudio },
      width: "62rem",
      maxWidth: "96vw",
      maxHeight: "92vh",
      autoFocus: "first-tabbable",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-estudio-titulo",
      ariaDescribedBy: "dialogo-estudio-descripcion",
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado) {
          void this.alerta.showSuccessAlert(
            `El estudio ${resultado.id} quedó guardado. Puede continuar con la invitación de proveedores.`,
            "Estudio de mercado guardado",
          );
          this.cargar();
          if (this.ruta.snapshot.data["abrirNuevo"]) {
            void this.router.navigate(["cotizaciones", "estudios-mercado"]);
          }
        } else if (this.ruta.snapshot.data["abrirNuevo"]) {
          void this.router.navigate(["cotizaciones", "estudios-mercado"]);
        }
      });
  }

  abrirDetalle(estudio: EstudioMercado): void {
    const ref = this.dialogo.open<
      DialogoDetalleEstudioComponent,
      { estudio: EstudioMercado },
      "invitar" | undefined
    >(DialogoDetalleEstudioComponent, {
      data: { estudio },
      width: "58rem",
      maxWidth: "96vw",
      maxHeight: "92vh",
      autoFocus: ".dialogo-detalle__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-detalle-estudio-titulo",
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((accion) => {
        if (accion === "invitar") {
          this.irAProveedores(estudio);
        }
      });
  }

  abrirExportar(estudio: EstudioMercado): void {
    this.dialogo.open(DialogoExportarEstudioComponent, {
      data: { estudio },
      width: "32rem",
      maxWidth: "96vw",
      autoFocus: ".dialogo-exportar__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-exportar-titulo",
    });
  }

  abrirDescartar(estudio: EstudioMercado): void {
    const ref = this.dialogo.open<
      DialogoDescartarEstudioComponent,
      { estudio: EstudioMercado },
      boolean
    >(DialogoDescartarEstudioComponent, {
      data: { estudio },
      width: "32rem",
      maxWidth: "96vw",
      autoFocus: ".dialogo-descartar__seguir",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-descartar-estudio-titulo",
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((descartado) => {
        if (descartado) {
          void this.alerta.showSuccessAlert(
            `El borrador ${estudio.id} fue descartado.`,
            "Borrador descartado",
          );
          this.cargar();
        }
      });
  }

  irAProveedores(estudio: EstudioMercado): void {
    void this.router.navigate([
      "cotizaciones",
      "estudios-mercado",
      estudio.id,
      "proveedores",
    ]);
  }

  etiquetaEstado(estado: EstadoEstudioMercado): string {
    return this.ESTADOS[estado]?.etiqueta ?? estado;
  }

  etiquetaMetodo(estudio: EstudioMercado): string {
    return ETIQUETAS_METODO_PRECIO[estudio.metodoPrecio];
  }

  private dependenciasPrevias = "";

  private actualizarDependencias(): void {
    const clave = this.dependencias.join("|");
    if (clave === this.dependenciasPrevias) {
      return;
    }
    this.dependenciasPrevias = clave;
    this.camposFiltro = this.camposFiltro.map((campo) =>
      campo.clave === "dependencia"
        ? {
            ...campo,
            opciones: [
              { valor: "", etiqueta: "Todas las dependencias" },
              ...this.dependencias.map((dependencia) => ({
                valor: dependencia,
                etiqueta: dependencia,
              })),
            ],
          }
        : campo,
    );
  }
}

function conteosVacios(): ConteosEstudios {
  return {
    todos: 0,
    borrador: 0,
    "en-recepcion": 0,
    cerrado: 0,
    aprobado: 0,
  };
}
