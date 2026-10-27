import { Component, computed, inject } from "@angular/core";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  ActividadVinculada,
  ProveedorObjetivo,
  SegmentacionProveedores,
  buscarProveedores,
  conteoOferentesPorActividad,
  etiquetaAreaSnies,
  etiquetaNucleoSnies,
} from "../../../../../models/proveedores.model";
import { ProveedoresObjetivoDetalle } from "../../../../../models/detalle-solicitud.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/** Proveedores que despliega la muestra representativa (mockup: 3). */
const PROVEEDORES_EN_MUESTRA = 3;

/**
 * Pestaña "Proveedores objetivo" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura la segmentación de los oferentes: las actividades
 * económicas CIIU con su número de oferentes registrados, la clasificación
 * SNIES cuando la naturaleza del objeto la exige, el contador de proveedores
 * objetivo y una muestra representativa de los notificados.
 *
 * La solicitud la entrega el armazón a través de `SolicitudDetalleStore`, así
 * que la pestaña no repite la petición ni conoce estados de la solicitud. El
 * número de proveedores NO se muestra desde un dato guardado: se calcula con
 * `buscarProveedores`, el mismo cruce del paso 5 del asistente (S-02), de modo
 * que el detalle y el asistente llegan al mismo resultado.
 */
@Component({
  selector: "app-pestana-proveedores-objetivo",
  templateUrl: "./pestana-proveedores-objetivo.component.html",
  styleUrls: ["./pestana-proveedores-objetivo.component.scss"],
  standalone: false,
})
export class PestanaProveedoresObjetivoComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly alerta = inject(AlertService);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Segmentación y notificación; `null` cuando aún no hay cruce registral. */
  readonly detalle = computed<ProveedoresObjetivoDetalle | null>(
    () => this.solicitud()?.proveedores ?? null,
  );

  /** Criterios de segmentación registrados (CIIU y SNIES). */
  readonly segmentacion = computed<SegmentacionProveedores | null>(
    () => this.detalle()?.segmentacion ?? null,
  );

  /** Actividades económicas CIIU vinculadas a la solicitud. */
  readonly actividades = computed<readonly ActividadVinculada[]>(
    () => this.segmentacion()?.actividades ?? [],
  );

  /**
   * true cuando la solicitud exige idoneidad técnica (SNIES).
   *
   * Los bienes se segmentan solo por CIIU; los servicios y las mezclas
   * necesitan además núcleo básico de conocimiento.
   */
  readonly aplicaSnies = computed<boolean>(() => {
    const detalle = this.detalle();
    return !!detalle?.requiereIdoneidad && !!detalle.segmentacion.nucleoSnies;
  });

  /** Proveedores que cumplen la segmentación (mismo cruce que el paso 5). */
  readonly proveedores = computed<readonly ProveedorObjetivo[]>(() => {
    const detalle = this.detalle();
    if (!detalle) {
      return [];
    }
    const codigos = detalle.segmentacion.actividades.map(
      (actividad) => actividad.codigo,
    );
    return buscarProveedores(
      codigos,
      detalle.segmentacion.nucleoSnies,
      detalle.requiereIdoneidad,
    );
  });

  /** Total de proveedores objetivo (únicos, sin duplicar notificación). */
  readonly totalProveedores = computed<number>(
    () => this.proveedores().length,
  );

  /** true cuando el cruce no devolvió ninguna coincidencia. */
  readonly sinCoincidencias = computed<boolean>(
    () => this.detalle() !== null && this.totalProveedores() === 0,
  );

  /** Oferentes registrados por cada código CIIU dentro del cruce. */
  readonly conteoPorActividad = computed<ReadonlyMap<string, number>>(() => {
    const codigos = this.actividades().map((actividad) => actividad.codigo);
    return conteoOferentesPorActividad(this.proveedores(), codigos);
  });

  /** Muestra representativa de los proveedores notificados. */
  readonly muestra = computed<readonly ProveedorObjetivo[]>(() =>
    this.proveedores().slice(0, PROVEEDORES_EN_MUESTRA),
  );

  /** Etiqueta legible del área de conocimiento SNIES. */
  readonly areaSnies = computed<string>(() => {
    const valor = this.segmentacion()?.areaSnies ?? "";
    return valor ? etiquetaAreaSnies(valor) : "—";
  });

  /** Etiqueta legible del núcleo básico de conocimiento. */
  readonly nucleoSnies = computed<string>(() => {
    const valor = this.segmentacion()?.nucleoSnies ?? "";
    return valor ? etiquetaNucleoSnies(valor) : "—";
  });

  /** Oferentes registrados de una actividad CIIU. */
  oferentes(actividad: ActividadVinculada): number {
    return this.conteoPorActividad().get(actividad.codigo) ?? 0;
  }

  /**
   * Códigos CIIU por los que un proveedor fue notificado al segmento.
   *
   * Se limita a las actividades de la segmentación, que es lo que explica por
   * qué el proveedor está en la muestra.
   */
  codigosProveedor(proveedor: ProveedorObjetivo): string {
    const codigos = this.actividades().map((actividad) => actividad.codigo);
    const comunes = proveedor.actividades.filter((codigo) =>
      codigos.includes(codigo),
    );
    return (comunes.length > 0 ? comunes : proveedor.actividades).join(", ");
  }

  /** Descarga simulada del registro de segmentación. */
  descargarRegistro(): void {
    this.alerta.showAlert(
      "Descarga en preparación",
      "El registro de segmentación de proveedores objetivo se generará cuando el gestor documental institucional esté conectado.",
    );
  }
}
