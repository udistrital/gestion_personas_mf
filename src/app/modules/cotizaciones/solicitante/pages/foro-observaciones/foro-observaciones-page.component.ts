import { Component, DestroyRef, OnInit, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import { ROLES_SOLICITANTE } from "src/app/core/constants/roles.const";
import {
  Observacion,
  RespuestaObservacionEntrada,
} from "../../../models/observacion.model";
import { SolicitudDetalle } from "../../../models/solicitud.model";
import { ObservacionesService } from "../../../services/observaciones.service";
import { SolicitudesService } from "../../../services/solicitudes.service";

type EstadoPaginaForo =
  "cargando" | "listo" | "bloqueado" | "no-encontrada" | "error";

@Component({
  selector: "app-foro-observaciones-page",
  templateUrl: "./foro-observaciones-page.component.html",
  styleUrls: ["./foro-observaciones-page.component.scss"],
  standalone: false,
})
export class ForoObservacionesPageComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly observacionesService = inject(ObservacionesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly roles = inject(RolService);
  private readonly destroyRef = inject(DestroyRef);

  readonly estado = signal<EstadoPaginaForo>("cargando");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly observaciones = signal<readonly Observacion[]>([]);
  readonly errorCarga = signal("");
  readonly cargandoObservaciones = signal(false);
  readonly enviandoId = signal<string | null>(null);
  readonly errorEnvioId = signal<string | null>(null);
  readonly errorEnvio = signal("");
  readonly mensajeExito = signal("");
  readonly enfocarId = signal<string | null>(null);

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Foro de observaciones</b></p>";

  get puedeUsarForo(): boolean {
    const solicitud = this.solicitud();
    return solicitud ? this.permisos.puede("foro", solicitud) : false;
  }

  get soloLectura(): boolean {
    const solicitud = this.solicitud();
    return solicitud ? !this.permisos.puede("foro", solicitud) : true;
  }

  get fechaLimiteVencida(): boolean {
    const fecha = this.solicitud()?.fechaLimiteObservaciones;
    return !!fecha && Date.parse(fecha) <= Date.now();
  }

  get puedeEditarRespuesta(): boolean {
    const fecha = this.solicitud()?.fechaLimiteObservaciones;
    return !!fecha && Date.parse(fecha) > Date.now();
  }

  ngOnInit(): void {
    const id = this.ruta.snapshot.paramMap.get("id");
    if (!id) {
      this.estado.set("no-encontrada");
      return;
    }
    this.cargarSolicitud(id);
  }

  cargarSolicitud(id: string): void {
    this.estado.set("cargando");
    this.errorCarga.set("");
    this.solicitudes
      .obtenerPorId(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (solicitud) => {
          if (!solicitud) {
            this.estado.set("no-encontrada");
            return;
          }
          this.solicitud.set(solicitud);
          if (!this.esSolicitante()) {
            this.estado.set("bloqueado");
            return;
          }
          this.estado.set("listo");
          this.cargarObservaciones();
        },
        error: (error: Error) => {
          this.errorCarga.set(
            error.message ||
              "No fue posible cargar la solicitud. Intente nuevamente.",
          );
          this.estado.set("error");
        },
      });
  }

  cargarObservaciones(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    this.cargandoObservaciones.set(true);
    this.errorCarga.set("");
    this.observacionesService
      .listarObservaciones(solicitud.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (observaciones) => {
          this.observaciones.set(observaciones);
          this.cargandoObservaciones.set(false);
        },
        error: (error: Error) => {
          this.errorCarga.set(
            error.message ||
              "No fue posible cargar las observaciones. Intente nuevamente.",
          );
          this.cargandoObservaciones.set(false);
        },
      });
  }

  responder(entrada: RespuestaObservacionEntrada): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedeUsarForo || this.enviandoId()) {
      return;
    }
    this.enviandoId.set(entrada.observacionId);
    this.errorEnvioId.set(null);
    this.errorEnvio.set("");
    this.mensajeExito.set("");
    this.enfocarId.set(null);
    this.observacionesService
      .responderObservacion(solicitud, entrada)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.observaciones.update((actuales) =>
            actuales.map((actual) =>
              actual.id === actualizada.id ? actualizada : actual,
            ),
          );
          this.enviandoId.set(null);
          this.mensajeExito.set(
            "La respuesta se publicó para todas las personas invitadas.",
          );
          this.enfocarId.set(actualizada.id);
        },
        error: (error: Error) => {
          this.errorEnvioId.set(entrada.observacionId);
          this.errorEnvio.set(
            error.message ||
              "No fue posible enviar la respuesta. Intente nuevamente.",
          );
          this.enviandoId.set(null);
        },
      });
  }

  volverAlDetalle(): void {
    const id = this.solicitud()?.id;
    if (id) {
      void this.router.navigate(["/cotizaciones", "solicitudes", id]);
    } else {
      void this.router.navigate(["/cotizaciones", "solicitudes"]);
    }
  }

  private esSolicitante(): boolean {
    return (
      this.roles.estaCargado() &&
      ROLES_SOLICITANTE.some((rol) => this.roles.tieneRol(rol))
    );
  }

  reintentarCargaSolicitud(): void {
    const id = this.ruta.snapshot.paramMap.get("id");
    if (id) {
      this.cargarSolicitud(id);
    }
  }
}
