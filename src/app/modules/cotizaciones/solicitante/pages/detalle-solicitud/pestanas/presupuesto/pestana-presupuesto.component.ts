import { Component, computed, inject } from "@angular/core";
import { AlertService } from "src/app/shared/services/alert.service";
import { formatoCop } from "../../../../../models/necesidad.model";
import {
  FirmaAval,
  ImputacionPresupuestal,
  PresupuestoDetalle,
  TonoEstadoPresupuesto,
  totalImputado,
} from "../../../../../models/detalle-solicitud.model";
import { SolicitudDetalle } from "../../../../../models/solicitud.model";
import { SolicitudDetalleStore } from "../../solicitud-detalle.store";

/**
 * Pestaña "Presupuesto" del detalle de una solicitud (S-03).
 *
 * Muestra en solo lectura el certificado de disponibilidad presupuestal (CDP)
 * que SICAPITAL pone a disposición de la contratación: la cifra destacada y su
 * saldo, la tabla de imputación y desagregación, el banner normativo y las
 * firmas de aval electrónico.
 *
 * La solicitud la entrega el armazón a través de `SolicitudDetalleStore`, así
 * que la pestaña no repite la petición ni conoce estados de la solicitud. El
 * total presupuestado se calcula con `totalImputado` a partir de las filas, no
 * se escribe a mano.
 */
@Component({
  selector: "app-pestana-presupuesto",
  templateUrl: "./pestana-presupuesto.component.html",
  styleUrls: ["./pestana-presupuesto.component.scss"],
  standalone: false,
})
export class PestanaPresupuestoComponent {
  private readonly store = inject(SolicitudDetalleStore);
  private readonly alerta = inject(AlertService);

  /** Solicitud resuelta por el armazón. */
  readonly solicitud = computed<SolicitudDetalle | null>(
    () => this.store.solicitud(),
  );

  /** Presupuesto SICAPITAL; `null` cuando la solicitud aún no tiene CDP. */
  readonly presupuesto = computed<PresupuestoDetalle | null>(
    () => this.solicitud()?.presupuesto ?? null,
  );

  /** Filas de la tabla de imputación. */
  readonly imputaciones = computed<readonly ImputacionPresupuestal[]>(
    () => this.presupuesto()?.imputaciones ?? [],
  );

  /** Firmas de aval presupuestal. */
  readonly firmas = computed<readonly FirmaAval[]>(
    () => this.presupuesto()?.firmas ?? [],
  );

  /** Total presupuestado, derivado de las filas de imputación. */
  readonly totalPresupuestado = computed<number>(() =>
    totalImputado(this.imputaciones()),
  );

  /** Formatea un valor en pesos colombianos con el formato local (`es-CO`). */
  moneda(valor: number): string {
    return formatoCop(valor);
  }

  /** Clase del chip de estado de una fila según su tono. */
  claseEstado(tono: TonoEstadoPresupuesto): string {
    switch (tono) {
      case "exito":
        return "chip chip--exito";
      case "info":
        return "chip chip--info";
      case "neutro":
        return "chip chip--neutro";
    }
  }

  /** Descarga simulada del certificado CDP (pendiente del gestor documental). */
  descargarCertificado(): void {
    this.alerta.showAlert(
      "Descarga en preparación",
      "El certificado CDP en PDF se generará cuando el gestor documental institucional esté conectado.",
    );
  }
}
