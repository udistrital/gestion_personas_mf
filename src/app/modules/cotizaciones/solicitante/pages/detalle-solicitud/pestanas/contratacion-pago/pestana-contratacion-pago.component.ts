import { Component, computed, inject } from "@angular/core";
import { AlertService } from "src/app/shared/services/alert.service";
import { formatoCop } from "../../../../../models/necesidad.model";
import {
  ContratacionDetalle,
  PresupuestoDetalle,
  RequisitoGarantia,
  montoHito,
  resumenPagos,
  totalImputado,
} from "../../../../../models/detalle-solicitud.model";
import {
  FORMAS_PAGO,
  MEDIOS_PAGO,
  ParametroPago,
  TIPOS_CONTRATO,
  etiquetaCorta,
  formatoPorcentajePago,
} from "../../../../../models/contratacion.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/**
 * Pestaña "Contratación y pago" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura las condiciones jurídicas de la contratación (tipo,
 * modalidad, plazo y lugar), la información financiera y de pago, y el
 * cronograma de hitos con sus porcentajes y montos proyectados, más la
 * supervisión técnica y las validaciones obligatorias de pago.
 *
 * La solicitud la entrega el armazón a través de `SolicitudDetalleStore`, así
 * que la pestaña no repite la petición ni conoce estados de la solicitud. Los
 * montos de los hitos se derivan del valor total del presupuesto (la misma
 * fuente que la pestaña "Presupuesto") y el porcentaje acumulado se calcula con
 * `resumenPagos`, que reutiliza el cálculo del asistente (S-02).
 */
@Component({
  selector: "app-pestana-contratacion-pago",
  templateUrl: "./pestana-contratacion-pago.component.html",
  styleUrls: ["./pestana-contratacion-pago.component.scss"],
  standalone: false,
})
export class PestanaContratacionPagoComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly alerta = inject(AlertService);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Contratación y pagos; `null` cuando la solicitud aún no los define. */
  readonly contratacion = computed<ContratacionDetalle | null>(
    () => this.solicitud()?.contratacion ?? null,
  );

  /** Hitos contractuales del cronograma. */
  readonly parametros = computed<readonly ParametroPago[]>(
    () => this.contratacion()?.parametros ?? [],
  );

  /** Validaciones obligatorias de pago. */
  readonly garantias = computed<readonly RequisitoGarantia[]>(
    () => this.contratacion()?.garantias ?? [],
  );

  /** Valor total del presupuesto (misma fuente que la pestaña "Presupuesto"). */
  readonly valorTotal = computed<number>(() => {
    const presupuesto: PresupuestoDetalle | null =
      this.solicitud()?.presupuesto ?? null;
    return presupuesto ? totalImputado(presupuesto.imputaciones) : 0;
  });

  /** Resumen porcentual del cronograma (cantidad, total, restante, completo). */
  readonly resumen = computed(() => {
    const contratacion = this.contratacion();
    return contratacion ? resumenPagos(contratacion) : null;
  });

  /** Etiqueta legible del tipo de contrato (desde el catálogo de S-02). */
  readonly tipoContrato = computed(() => {
    const contratacion = this.contratacion();
    return contratacion
      ? etiquetaCorta(TIPOS_CONTRATO, contratacion.tipoContrato)
      : "";
  });

  /** Etiqueta legible del medio de pago (desde el catálogo de S-02). */
  readonly medioPago = computed(() => {
    const contratacion = this.contratacion();
    return contratacion
      ? etiquetaCorta(MEDIOS_PAGO, contratacion.medioPago)
      : "";
  });

  /** Etiqueta legible de la forma de pago (desde el catálogo de S-02). */
  readonly formaPago = computed(() => {
    const contratacion = this.contratacion();
    return contratacion
      ? etiquetaCorta(FORMAS_PAGO, contratacion.formaPago)
      : "";
  });

  /** Formatea un valor en pesos colombianos con el formato local (`es-CO`). */
  moneda(valor: number): string {
    return formatoCop(valor);
  }

  /** Formatea un porcentaje ("40" / "12.5"). */
  porcentaje(valor: number): string {
    return `${formatoPorcentajePago(valor)} %`;
  }

  /** Monto proyectado de un hito a partir del valor total presupuestado. */
  monto(parametro: ParametroPago): number {
    return montoHito(parametro, this.valorTotal());
  }

  /** Descarga simulada del resumen PDF (pendiente del gestor documental). */
  descargarResumen(): void {
    this.alerta.showAlert(
      "Descarga en preparación",
      "El resumen contractual en PDF se generará cuando el gestor documental institucional esté conectado.",
    );
  }
}
