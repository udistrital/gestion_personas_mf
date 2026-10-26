import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  AutorObservacion,
  EstadoObservacion,
  estadoObservacion,
  NuevaObservacion,
  Observacion,
  RespuestaObservacionEntrada,
} from "../../models/observacion.model";
import { SolicitudDetalle } from "../../models/solicitud.model";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";

/**
 * Presentación reusable del foro: modo solicitante responde; modo proveedor
 * formula observaciones. El host calcula capacidades y conecta los servicios.
 */
@Component({
  selector: "app-foro-observaciones",
  templateUrl: "./foro-observaciones.component.html",
  styleUrls: ["./foro-observaciones.component.scss"],
  standalone: false,
})
export class ForoObservacionesComponent {
  @Input({ required: true }) solicitud!: SolicitudDetalle;
  @Input() observaciones: readonly Observacion[] = [];
  @Input() modo: "solicitante" | "proveedor" = "solicitante";
  @Input() cargando = false;
  @Input() errorCarga = "";
  @Input() puedeObservar = false;
  @Input() puedeResponder = false;
  @Input() puedeEditarRespuesta = false;
  @Input() fechaLimiteVencida = false;
  @Input() enviandoId: string | null = null;
  @Input() errorEnvioId: string | null = null;
  @Input() errorEnvio = "";
  @Input() enviandoObservacion = false;
  @Input() errorNuevaObservacion = "";
  @Input() mensajeExito = "";
  @Input() enfocarId: string | null = null;

  @Output() reintentar = new EventEmitter<void>();
  @Output() observacionCreada = new EventEmitter<NuevaObservacion>();
  @Output() respuestaEnviada = new EventEmitter<RespuestaObservacionEntrada>();

  busqueda = "";
  estadoFiltro: "" | EstadoObservacion = "";
  autorFiltro = "";
  fechaDesde = "";
  fechaHasta = "";

  get autores(): readonly AutorObservacion[] {
    const vistos = new Set<string>();
    return this.observaciones
      .map((observacion) => observacion.autor)
      .filter((autor) => {
        if (vistos.has(autor.identificacion)) {
          return false;
        }
        vistos.add(autor.identificacion);
        return true;
      });
  }

  get observacionesFiltradas(): readonly Observacion[] {
    const termino = this.busqueda.trim().toLocaleLowerCase("es");
    return this.observaciones.filter((observacion) => {
      const estadoCoincide =
        !this.estadoFiltro ||
        estadoObservacion(observacion) === this.estadoFiltro;
      const autorCoincide =
        !this.autorFiltro ||
        observacion.autor.identificacion === this.autorFiltro;
      const fecha = observacion.fechaIso.slice(0, 10);
      const desdeCoincide = !this.fechaDesde || fecha >= this.fechaDesde;
      const hastaCoincide = !this.fechaHasta || fecha <= this.fechaHasta;
      const texto = [
        observacion.radicado,
        observacion.autor.nombre,
        observacion.autor.identificacion,
        textoPlanoDesdeHtml(observacion.contenidoHtml),
        observacion.respuesta
          ? textoPlanoDesdeHtml(observacion.respuesta.contenidoHtml)
          : "",
      ]
        .join(" ")
        .toLocaleLowerCase("es");
      return (
        estadoCoincide &&
        autorCoincide &&
        desdeCoincide &&
        hastaCoincide &&
        (!termino || texto.includes(termino))
      );
    });
  }

  get pendientes(): number {
    return this.observaciones.filter(
      (observacion) => estadoObservacion(observacion) === "pendiente",
    ).length;
  }

  get respondidas(): number {
    return this.observaciones.length - this.pendientes;
  }

  get hayFiltros(): boolean {
    return !!(
      this.busqueda ||
      this.estadoFiltro ||
      this.autorFiltro ||
      this.fechaDesde ||
      this.fechaHasta
    );
  }

  limpiarFiltros(): void {
    this.busqueda = "";
    this.estadoFiltro = "";
    this.autorFiltro = "";
    this.fechaDesde = "";
    this.fechaHasta = "";
  }
}
